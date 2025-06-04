const fs = require('fs');
const path = require('path');

// 제외할 폴더 목록
const excludedFolders = ['node_modules', 'dist', 'build', 'backup', '.idea', 'gcode_samples'];

/**
 * 폴더와 파일을 백업 폴더로 복사합니다.
 * @param {string} sourceDir 소스 디렉토리 경로
 * @param {string} destDir 대상 디렉토리 경로
 */
function copyFolderRecursive(sourceDir, destDir) {
    // 대상 디렉토리가 없으면 생성
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    // 소스 디렉토리 내의 파일 및 폴더 목록 가져오기
    const items = fs.readdirSync(sourceDir, { withFileTypes: true });

    items.forEach((item) => {
        const sourcePath = path.join(sourceDir, item.name);
        const destPath = path.join(destDir, item.name);

        // 제외 폴더 확인
        if (excludedFolders.includes(item.name)) {
            console.log(`Skipping excluded folder: ${sourcePath}`);
            return;
        }

        if (item.isDirectory()) {
            // 디렉토리인 경우 재귀적으로 복사
            copyFolderRecursive(sourcePath, destPath);
        } else if (item.isFile()) {
            // 파일인 경우 복사
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Copied file: ${sourcePath} -> ${destPath}`);
        }
    });
}

// 실행 경로에서 작업
//const projectRoot = path.join(__dirname); // 프로젝트 루트 경로
const projectRoot = path.join(__dirname, '..'); // 프로젝트 루트 경로 (한 단계 상위 폴더)
const backupDirectory = path.join(projectRoot, 'backup'); // 백업 폴더 경로

// 백업 실행
try {
    console.log('Starting backup...');
    copyFolderRecursive(projectRoot, backupDirectory);
    console.log('Backup completed successfully!');
} catch (error) {
    console.error('Error during backup:', error);
}
