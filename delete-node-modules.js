// delete-node-modules.js
const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
    console.log(`Deleted: ${folderPath}`);
  }
}

function findAndDeleteFolder(startPath, folderName) {
  fs.readdirSync(startPath, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === folderName) {
        deleteFolderRecursive(fullPath);
      } else {
        findAndDeleteFolder(fullPath, folderName);
      }
    }
  });
}

const targetDirectory = path.resolve('.'); // 현재 디렉토리 기준
const folderToDelete = process.argv[2] || 'node_modules';

findAndDeleteFolder(targetDirectory, folderToDelete);
console.log(`All '${folderToDelete}' folders deleted.`);
