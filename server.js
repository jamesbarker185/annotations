const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'frontend/dist')));

const DATA_DIR = path.join(__dirname, 'data');
const MERGED_DATASET_PATH = path.join(DATA_DIR, 'batch1', 'json', 'merged_dataset.json');

// Serve images from batch1 directory
app.use('/data/local-files', (req, res, next) => {
    const filename = req.query.d;
    if (!filename) {
        return res.status(400).send('Missing "d" query parameter');
    }

    const safeFilename = path.basename(filename);
    const possiblePath = path.join(DATA_DIR, 'batch1', safeFilename);

    if (fs.existsSync(possiblePath)) {
        return res.sendFile(possiblePath);
    }

    res.status(404).send('Image not found');
});

// Transform COCO format to frontend format
function cocoToFrontend(cocoData) {
    const { images, annotations, categories } = cocoData;

    // Build lookup: imageId -> image data
    const imageMap = new Map(images.map(img => [img.id, img]));

    // Build lookup: imageId -> annotations[]
    const annotationsByImage = new Map();
    annotations.forEach(ann => {
        if (!annotationsByImage.has(ann.image_id)) {
            annotationsByImage.set(ann.image_id, []);
        }
        annotationsByImage.get(ann.image_id).push(ann);
    });

    // Create tasks array
    const tasks = images.map(image => {
        const imageAnnotations = annotationsByImage.get(image.id) || [];

        // Convert COCO annotations to frontend format
        const result = imageAnnotations.map(ann => {
            // COCO bbox: [x, y, width, height] in pixels
            // Frontend needs: {x, y, width, height} in percentages
            const [x, y, width, height] = ann.bbox;
            const xPercent = (x / image.width) * 100;
            const yPercent = (y / image.height) * 100;
            const widthPercent = (width / image.width) * 100;
            const heightPercent = (height / image.height) * 100;

            return {
                id: ann.id,
                from_name: "label",
                to_name: "image",
                type: "rectanglelabels",
                value: {
                    x: xPercent,
                    y: yPercent,
                    width: widthPercent,
                    height: heightPercent,
                    rectanglelabels: ["trailer_id"],
                    text: ann.attributes?.text || ""
                }
            };
        });

        return {
            id: image.id,
            data: {
                image: `/data/local-files/?d=${image.file_name}`
            },
            annotations: [{
                result: result
            }]
        };
    });

    return tasks;
}

// Transform frontend format back to COCO format
function frontendToCoco(tasks, originalCoco) {
    const { categories } = originalCoco;

    // Extract images and annotations from tasks
    const images = [];
    const annotations = [];
    let annotationId = 1;

    tasks.forEach(task => {
        // Extract image info from task
        const fileName = task.data.image.split('d=')[1];

        // Find original image data to preserve width/height
        const originalImage = originalCoco.images.find(img => img.file_name === fileName);
        if (!originalImage) {
            console.warn(`Image not found in original data: ${fileName}`);
            return;
        }

        images.push(originalImage);

        // Convert annotations
        const result = task.annotations?.[0]?.result || [];
        result.forEach(box => {
            // Frontend: {x, y, width, height} in percentages
            // COCO: [x, y, width, height] in pixels
            const xPixel = (box.value.x / 100) * originalImage.width;
            const yPixel = (box.value.y / 100) * originalImage.height;
            const widthPixel = (box.value.width / 100) * originalImage.width;
            const heightPixel = (box.value.height / 100) * originalImage.height;

            annotations.push({
                id: box.id || annotationId++,
                image_id: originalImage.id,
                category_id: 1,
                bbox: [
                    Math.round(xPixel),
                    Math.round(yPixel),
                    Math.round(widthPixel),
                    Math.round(heightPixel)
                ],
                area: Math.round(widthPixel * heightPixel),
                iscrowd: 0,
                attributes: {
                    text: box.value.text || "",
                    confidence: 1.0
                }
            });
        });
    });

    return {
        images,
        annotations,
        categories
    };
}

// API to get tasks (load from merged_dataset.json)
app.get('/api/tasks', (req, res) => {
    try {
        if (!fs.existsSync(MERGED_DATASET_PATH)) {
            return res.status(404).json({ error: 'merged_dataset.json not found' });
        }

        const data = fs.readFileSync(MERGED_DATASET_PATH, 'utf8');
        const cocoData = JSON.parse(data);
        const tasks = cocoToFrontend(cocoData);

        res.json(tasks);
    } catch (err) {
        console.error('Error loading tasks:', err);
        res.status(500).json({ error: 'Failed to load tasks' });
    }
});

// API to save tasks (save back to merged_dataset.json)
app.post('/api/save', (req, res) => {
    try {
        // Load original COCO data to preserve structure
        const originalData = JSON.parse(fs.readFileSync(MERGED_DATASET_PATH, 'utf8'));

        // Transform frontend data back to COCO
        const cocoData = frontendToCoco(req.body, originalData);

        // Save to merged_dataset.json
        fs.writeFileSync(MERGED_DATASET_PATH, JSON.stringify(cocoData, null, 2));

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving tasks:', err);
        res.status(500).json({ error: 'Failed to save tasks' });
    }
});

// Endpoint to run OCR
const { exec } = require('child_process');
const crypto = require('crypto');

app.post('/api/ocr', (req, res) => {
    const { image } = req.body;
    if (!image) {
        return res.status(400).json({ error: 'No image data provided' });
    }

    // Decode base64 image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Create a temp file
    const tempFileName = `temp_ocr_${crypto.randomBytes(4).toString('hex')}.png`;
    const tempFilePath = path.join(__dirname, tempFileName);

    fs.writeFile(tempFilePath, buffer, (err) => {
        if (err) {
            console.error('Error writing temp file:', err);
            return res.status(500).json({ error: 'Failed to process image' });
        }

        // Run Python OCR script
        exec(`python ocr_script.py "${tempFilePath}"`, (error, stdout, stderr) => {
            // Clean up temp file
            fs.unlink(tempFilePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
            });

            if (error) {
                console.error(`OCR Execution Error: ${error}`);
                return res.status(500).json({ error: 'OCR processing failed' });
            }

            // Trim whitespace
            const text = stdout.trim();
            res.json({ text });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using data source: ${MERGED_DATASET_PATH}`);
});
