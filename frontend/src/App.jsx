import React, { useState, useEffect } from 'react';
import { Layout, Save, Trash2, Plus, ChevronLeft, ChevronRight, Download, CheckCircle, Box as BoxIcon, ScanLine } from 'lucide-react';
import Canvas from './components/Canvas';
import './index.css';
import './App.css';

function App() {
    const [tasks, setTasks] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedBoxId, setSelectedBoxId] = useState(null);
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [ocrLoading, setOcrLoading] = useState(false);

    // Load initial data
    useEffect(() => {
        fetch('http://localhost:3000/api/tasks')
            .then(res => res.json())
            .then(data => {
                setTasks(data);
                setSelectedIndices(new Set(data.map((_, i) => i))); // Default select all
                setLoading(false);
            })
            .catch(err => console.error(err));
    }, []);

    const currentTask = tasks[currentIdx];

    // Extract annotations from the weird Label Studio format
    // Structure: task.annotations[0].result[] -> list of boxes
    // We'll edit `task.annotations[0].result` directly for simplicity
    const boxes = currentTask?.annotations?.[0]?.result || [];

    const handleBoxChange = (idx, newBox) => {
        const newTasks = [...tasks];
        newTasks[currentIdx].annotations[0].result[idx] = newBox;
        setTasks(newTasks);
    };

    const handleAddBox = (initialProps) => {
        const newBox = {
            "from_name": "label",
            "to_name": "image",
            "type": "rectanglelabels",
            "value": {
                x: initialProps.x,
                y: initialProps.y,
                width: initialProps.width,
                height: initialProps.height,
                rectanglelabels: ["trailer_id"],
                text: ""
            }
        };

        const newTasks = [...tasks];
        if (!newTasks[currentIdx].annotations[0]) {
            newTasks[currentIdx].annotations[0] = { result: [] };
        }
        newTasks[currentIdx].annotations[0].result.push(newBox);
        setTasks(newTasks);
        setSelectedBoxId(newTasks[currentIdx].annotations[0].result.length - 1);
    };

    const handleDeleteBox = () => {
        if (selectedBoxId === null) return;
        const newTasks = [...tasks];
        newTasks[currentIdx].annotations[0].result.splice(selectedBoxId, 1);
        setTasks(newTasks);
        setSelectedBoxId(null);
    };

    const handleTextChange = (e) => {
        if (selectedBoxId === null) return;
        const text = e.target.value;
        const newTasks = [...tasks];

        // Update the text field, not rectanglelabels
        newTasks[currentIdx].annotations[0].result[selectedBoxId].value.text = text;
        setTasks(newTasks);
    };

    const handleRunOCR = async () => {
        if (selectedBoxId === null) return;
        setOcrLoading(true);

        try {
            const box = boxes[selectedBoxId];
            const { x, y, width, height } = box.value;
            const imgSrc = `http://localhost:3000${currentTask.data.image}`;

            // Load image to crop
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = imgSrc;

            await new Promise((resolve, reject) => {
                if (img.complete) resolve();
                else {
                    img.onload = resolve;
                    img.onerror = reject;
                }
            });

            // Calculate pixel coordinates
            // x, y, w, h are in percentages (0-100)
            const pixelX = (x / 100) * img.naturalWidth;
            const pixelY = (y / 100) * img.naturalHeight;
            const pixelW = (width / 100) * img.naturalWidth;
            const pixelH = (height / 100) * img.naturalHeight;

            // Crop via temporary canvas
            const canvas = document.createElement('canvas');
            canvas.width = pixelW;
            canvas.height = pixelH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);

            const base64Image = canvas.toDataURL('image/png');

            // Send to OCR API
            const response = await fetch('http://localhost:3000/api/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image })
            });

            const data = await response.json();

            if (data.error) {
                console.error(data.error);
                alert("OCR Error: " + data.error);
                return;
            }

            if (data.text) {
                // Update text field
                const newTasks = [...tasks];
                newTasks[currentIdx].annotations[0].result[selectedBoxId].value.text = data.text;
                setTasks(newTasks);
            } else {
                alert("No text detected");
            }

        } catch (err) {
            console.error("OCR Failed:", err);
            alert("OCR process failed");
        } finally {
            setOcrLoading(false);
        }
    };

    const toggleSelection = (index) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIndices.size === tasks.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(tasks.map((_, i) => i)));
        }
    };

    const saveResults = () => {
        fetch('http://localhost:3000/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tasks)
        })
            .then(res => res.json())
            .then(() => alert('Saved!'))
            .catch(err => alert('Error saving'));
    };

    const handleDownload = () => {
        const selectedTasks = tasks.filter((_, i) => selectedIndices.has(i));
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedTasks, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "label_studio_tasks.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    if (loading) return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>Loading data...</div>;

    return (
        <div className="app-container">

            {/* Sidebar / List */}
            {/* Sidebar / List */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            checked={tasks.length > 0 && selectedIndices.size === tasks.length}
                            onChange={toggleSelectAll}
                            style={{ marginRight: 8, cursor: 'pointer' }}
                        />
                        <span>Tasks ({selectedIndices.size}/{tasks.length})</span>
                    </div>
                    <div style={{ display: 'flex' }}>
                        <button onClick={saveResults} className="save-btn" title="Save">
                            <Save size={20} />
                        </button>
                        <button onClick={handleDownload} className="save-btn" title="Export JSON" style={{ marginLeft: 8 }}>
                            <Download size={20} />
                        </button>
                    </div>
                </div>

                <div className="task-list">
                    {tasks.map((task, i) => {
                        const boxCount = task.annotations?.[0]?.result?.length || 0;
                        const isAnnotated = boxCount > 0;

                        return (
                            <div
                                key={i}
                                className={`task-item ${i === currentIdx ? 'active' : ''}`}
                                onClick={() => {
                                    setCurrentIdx(i);
                                    setSelectedBoxId(null);
                                }}
                            >
                                <div className="task-item-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIndices.has(i)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => toggleSelection(i)}
                                            className="custom-checkbox"
                                        />
                                        <span className="task-id">ID: {i}</span>
                                    </div>
                                    {isAnnotated && <CheckCircle size={14} className="status-icon" />}
                                </div>

                                <div className="task-filename" title={task.data.image}>
                                    {task.data.image ? task.data.image.split('d=')[1] || task.data.image : 'Image'}
                                </div>

                                <div className="task-meta">
                                    <BoxIcon size={12} />
                                    <span>{boxCount} {boxCount === 1 ? 'Box' : 'Boxes'}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Area */}
            <div className="main-area">
                {/* Toolbar */}
                <div className="toolbar">
                    <div className="nav-controls">
                        <button className="icon-btn" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}>
                            <ChevronLeft size={16} />
                        </button>
                        <span className="nav-text">
                            {currentIdx + 1} / {tasks.length}
                        </span>
                        <button className="icon-btn" onClick={() => setCurrentIdx(Math.min(tasks.length - 1, currentIdx + 1))}>
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="help-text">
                        Click on image to add box • Click box to select
                    </div>
                </div>

                <Canvas
                    imageSrc={currentTask ? `http://localhost:3000${currentTask.data.image}` : ''}
                    annotations={boxes}
                    selectedBoxId={selectedBoxId}
                    onBoxSelect={setSelectedBoxId}
                    onBoxChange={handleBoxChange}
                    onAddBox={handleAddBox}
                />
            </div>

            {/* Properties Panel */}
            <div className="properties-panel">
                <h2 className="panel-title">Properties</h2>

                {selectedBoxId !== null ? (
                    <div className="properties-content">
                        <div className="prop-group">
                            <label className="prop-label">Label Category</label>
                            <input
                                className="prop-input"
                                value={boxes[selectedBoxId].value.rectanglelabels?.[0] || ''}
                                disabled
                                style={{ backgroundColor: '#27272a', cursor: 'not-allowed', opacity: 0.7 }}
                            />
                        </div>

                        <div className="prop-group">
                            <label className="prop-label">
                                Text Value
                                <button
                                    className="ocr-btn"
                                    onClick={handleRunOCR}
                                    disabled={ocrLoading}
                                    title="Run PaddleOCR on this box"
                                >
                                    {ocrLoading ? (
                                        <span className="sc-loading">...</span>
                                    ) : (
                                        <>
                                            <ScanLine size={12} style={{ marginRight: 4 }} />
                                            Run OCR
                                        </>
                                    )}
                                </button>
                            </label>
                            <input
                                className="prop-input"
                                value={boxes[selectedBoxId].value.text || ''}
                                onChange={handleTextChange}
                                placeholder="Enter trailer ID (e.g., R10108)"
                            />
                        </div>

                        <div className="debug-info">
                            <div>X: {boxes[selectedBoxId].value.x.toFixed(1)}%</div>
                            <div>Y: {boxes[selectedBoxId].value.y.toFixed(1)}%</div>
                            <div>W: {boxes[selectedBoxId].value.width.toFixed(1)}%</div>
                            <div>H: {boxes[selectedBoxId].value.height.toFixed(1)}%</div>
                        </div>

                        <button
                            onClick={handleDeleteBox}
                            className="delete-btn"
                        >
                            <Trash2 size={16} />
                            Delete Box
                        </button>
                    </div>
                ) : (
                    <div className="help-text">
                        Select a box to edit its properties.
                    </div>
                )}
            </div>

        </div>
    )
}

export default App
