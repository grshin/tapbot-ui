const fs = require('fs');
const path = require('path');

// 삭제할 폴더 경로 (기본값은 dist)
const buildDir = path.join(__dirname, '../dist');

// 폴더 삭제 함수
function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const currentPath = path.join(folderPath, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
                // 디렉터리라면 재귀적으로 삭제
                deleteFolderRecursive(currentPath);
            } else {
                // 파일 삭제
                fs.unlinkSync(currentPath);
            }
        });
        // 폴더 자체 삭제
        fs.rmdirSync(folderPath);
        console.log(`Deleted: ${folderPath}`);
    } else {
        console.log(`Folder not found: ${folderPath}`);
    }
}

// 실행
deleteFolderRecursive(buildDir);
