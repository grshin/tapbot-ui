const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 1004;

// 로그 파일 저장 경로
const logFilePath = path.join(__dirname, 'logs.txt');

// Body 파서 설정
app.use(bodyParser.json());

// POST 요청으로 로그 수집
app.post('/logs', (req, res) => {
  const logMessage = req.body.message;
  const timestamp = new Date().toISOString();

  if (!logMessage) {
    return res.status(400).send({ error: 'Log message is required' });
  }

  // 로그를 파일에 저장
  const logEntry = `[${timestamp}] ${logMessage}`;
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
  res.status(200).send({ success: true, message: 'Log saved' });

  // 콘솔에도 출력
  //const log = `[${timestamp}] ${logMessage}`;
  console.log(logMessage); // 콘솔에도 출력
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Log server running on http://localhost:${PORT}`);
});
