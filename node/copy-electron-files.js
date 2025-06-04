const fs = require('fs');
const path = require('path');

const filesToCopy = ['electron.js', 'preload.js'];
const sourceDirectory = path.join(__dirname, '../src'); // 파일이 위치한 src 디렉토리
const destinationDirectory = path.join(__dirname, '../build'); // 파일을 복사할 build 디렉토리

// 빌드 폴더가 없으면 생성
if (!fs.existsSync(destinationDirectory)) {
    fs.mkdirSync(destinationDirectory, { recursive: true });
}

filesToCopy.forEach((file) => {
    const sourcePath = path.join(sourceDirectory, file);
    const destinationPath = path.join(destinationDirectory, file);

    if (fs.existsSync(sourcePath)) {
        try {
            fs.copyFileSync(sourcePath, destinationPath);
            console.log(`Copied ${file} from ${sourceDirectory} to ${destinationDirectory}`);
        } catch (error) {
            console.error(`Failed to copy ${file}:`, error);
        }
    } else {
        console.warn(`File not found: ${sourcePath}`);
    }
});
