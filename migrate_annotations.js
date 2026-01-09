const fs = require('fs');
const path = require('path');

// Paths
const inputPath = path.join(__dirname, 'data', 'batch1', 'json', 'label_studio_tasks.json');
const outputPath = path.join(__dirname, 'data', 'batch1', 'json', 'label_studio_tasks_migrated.json');
const backupPath = path.join(__dirname, 'data', 'batch1', 'json', 'label_studio_tasks.backup.json');

console.log('Starting annotation migration...\n');

// Read the original file
console.log(`Reading: ${inputPath}`);
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Create backup
console.log(`Creating backup: ${backupPath}`);
fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));

// Transform the data
let totalAnnotations = 0;
let updatedAnnotations = 0;

data.forEach((task, taskIdx) => {
    if (task.annotations && task.annotations[0] && task.annotations[0].result) {
        task.annotations[0].result.forEach((annotation) => {
            totalAnnotations++;

            if (annotation.value && annotation.value.rectanglelabels) {
                // Change rectanglelabels to ["trailer_id"]
                annotation.value.rectanglelabels = ["trailer_id"];

                // Add text field if it doesn't exist
                if (!annotation.value.hasOwnProperty('text')) {
                    annotation.value.text = "";
                }

                updatedAnnotations++;
            }
        });
    }
});

// Write the migrated data to a NEW file
console.log(`Writing migrated data: ${outputPath}`);
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log('\n✅ Migration complete!');
console.log(`   Total tasks: ${data.length}`);
console.log(`   Total annotations: ${totalAnnotations}`);
console.log(`   Updated annotations: ${updatedAnnotations}`);
console.log(`\n📁 Files created:`);
console.log(`   Backup: ${backupPath}`);
console.log(`   Migrated: ${outputPath}`);
console.log(`\n⚠️  Original file unchanged: ${inputPath}`);
console.log(`\nNext steps:`);
console.log(`1. Review the migrated file: ${outputPath}`);
console.log(`2. If satisfied, rename it to replace the original`);
console.log(`3. Or update server.js to use the new file path`);
