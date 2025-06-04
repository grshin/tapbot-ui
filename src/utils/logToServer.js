const axios = require('axios'); // HTTP 요청 라이브러리
const fs = require('fs');
const path = require('path');

// 로그 파일 경로 설정
const logFilePath = path.join(__dirname, 'app.log');

const isReactEnv = typeof window !== 'undefined' && window.document; // Check if running in React (browser) environment

const logMessage = (...args) => {
    const message = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
    if (isReactEnv) {
        console.log(message); // Use console.log in React environment
    } else {
        logToServer(message); // Use logToServer in Node/Electron environment
    }
};

// 로그 메시지를 파일로 저장
function writeLogToFile(message) {
    return; // 임시적용

    fs.appendFile(logFilePath, message, (err) => {
        if (err) {
            console.error('Failed to write log to file:', err);
        }
    });
}

// 로그를 서버로 전송
function sendLogToServer(logMessage) {
    return axios.post('http://localhost:1004/logs', { message: logMessage }).catch(() => {
        // 서버가 비활성화된 경우 파일로 출력
        const fallbackMessage = `[Fallback to File] ${logMessage}`;
        writeLogToFile(fallbackMessage);
    });
}

// 로그 출력 함수
const logToServer = (...args) => {
    const message = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
    console.log(message); // 콘솔에도 출력

    // 로그를 서버로 전송
    sendLogToServer(message).catch(() => {
        // 서버로 전송 실패 시, 파일로 출력
        writeLogToFile(message);
    });
};

// logToServer를 내보냄
module.exports = {
    logToServer,
    logMessage,
};
