// electron.js
console.log('Electron is starting...'); // 앱 시작 시 로그 출력

const fs = require('fs');
const path = require('path');
const url = require('url');

const { app, BrowserWindow, Menu, dialog, globalShortcut, ipcMain, session } = require('electron');
const axios = require('axios'); // React 서버 상태 확인을 위한 라이브러리
const net = require('net');

const dbManager = require('./utils/dbManager');
const { logToServer } = require('./utils/logToServer'); // utils/log.js 파일 경로

// const window_width = 1280;
// const window_height = 720;
const window_width = 1920;
const window_height = 1080;

let mainWindow = null;
let tcpSocket = null; // TCP 클라이언트 싱글톤
let pingInterval = null;

logToServer('-----------------------------');
logToServer('ElectronApp started');
logToServer('-----------------------------');

let reconnectAttempts = 0; // 재연결 횟수 추적
let maxReconnectAttempts = 5; // 최대 재시도 횟수
let reconnectTimeout = null; // 재연결 타이머 저장

function createTCPConnection(event, ip, port) {
    // 기존 tcpSocket 존재하고, 연결 중이거나 이미 열린 상태면 새로운 연결을 방지
    if (tcpSocket) {
        if (tcpSocket.readyState === 'open') {
            console.log('[Electron] 이미 TCP 연결이 존재합니다.');
            return tcpSocket;
        }

        // 혹시 이전 tcpSocket 닫혔지만 남아 있다면 강제로 제거
        console.log('[Electron] 기존 TCP 소켓 제거 후 재연결 시도');
        tcpSocket.destroy();
        tcpSocket = null;

        return;
    }

    tcpSocket = new net.Socket();

    return new Promise((resolve, reject) => {
        tcpSocket.connect(port, ip, () => {
            console.log(`[Electron] TCP 서버 (${ip}:${port}) 연결 성공!`);
            mainWindow?.webContents.send('server-log', `[Electron] TCP 서버 (${ip}:${port}) 연결 성공!`);

            tcpSocket.setKeepAlive(true, 10000); // 10초마다 Keep-Alive 패킷 전송
            reconnectAttempts = 0; // 성공하면 재시도 횟수 초기화
            // 일정 주기로 ping 체크 시작 (5초 간격)
            // startPingCheck(event);

            resolve(tcpSocket);
        });

        let buffer = ''; // 데이터 조각들을 임시 저장할 버퍼

        tcpSocket.on('data', (data) => {
            buffer += data.toString(); // 버퍼에 수신된 데이터를 추가
            let boundary = buffer.indexOf('\r\n'); // 메시지 구분 기준 (줄바꿈)

            while (boundary !== -1) {
                const message = buffer.substring(0, boundary).trim(); // 한 줄씩 처리
                buffer = buffer.substring(boundary + 2); // 처리된 부분 제거
                boundary = buffer.indexOf('\r\n'); // 다음 메시지 위치 찾기

                let parsedData;
                try {
                    parsedData = JSON.parse(message);
                } catch (error) {
                    console.error('[Electron] JSON 파싱 실패: continue 처리...', error);
                    continue; // JSON 파싱 실패 시 다음 메시지 처리
                }

                if (parsedData && parsedData.type) {
                    switch (parsedData.type) {
                        case 'DEBUG':
                            console.log('[Electron] DEBUG: ', parsedData);
                            mainWindow?.webContents.send('server-log', '[Electron] DEBUG: ', parsedData);
                            break;
                        case 'TCP-RESPONSE':
                            console.log('[Electron] TCP-RESPONSE: ', parsedData);
                            mainWindow?.webContents.send('tcp-data-response', parsedData);
                            break;
                        case 'tapping':
                        case 'previewPosition':
                        case 'workPiece':
                        case 'reachArea':
                        case 'maintenancePosture':
                            mainWindow?.webContents.send('tcp-tapping-response', parsedData);
                            break;
                        default:
                            console.warn('[Electron] 알 수 없는 응답:', parsedData);
                            mainWindow?.webContents.send('server-log', parsedData);
                            break;
                    }
                } else {
                    if (message.startsWith('ACK;')) {
                        console.log('[Electron] 명령 확인 응답: ', message);
                        mainWindow?.webContents.send('tcp-data-response', message);
                    } else if (message.startsWith('STAT;')) {
                        console.log('[Electron] 명령 확인 응답: ', message);
                        mainWindow?.webContents.send('tcp-data-response', message);
                    } else if (message.startsWith('ERR;')) {
                        console.error('[Electron] 명령 실행 실패: ', message);
                        mainWindow?.webContents.send('tcp-data-response', message);
                    } else {
                        console.warn('[Electron] 예기치 않은 응답: ', message);
                        mainWindow?.webContents.send('tcp-data-response', message);
                    }
                }
            }

            if (data.length === 0) {
                console.warn('[Electron] 빈 데이터 수신! 연결이 끊어질 수 있음.');
            }
        });

        tcpSocket.on('close', () => {
            console.log('[Electron] TCP 연결이 예상치 못하게 종료되었습니다!');
            mainWindow?.webContents.send('server-log', '[Electron] TCP 연결이 예상치 못하게 종료되었습니다!');
            mainWindow?.webContents.send('tcp-disconnected', '[Electron] TCP 연결이 예상치 못하게 종료되었습니다!');
            tcpSocket = null;
            // attemptReconnect(ip, port);
        });

        tcpSocket.on('error', (err) => {
            console.error('[Electron] TCP 연결 오류 발생:', err.message);
            mainWindow?.webContents.send('server-log', '[Electron] TCP 연결 오류 발생:', err.message);
            mainWindow?.webContents.send('tcp-disconnected', '[Electron] TCP 연결 오류 발생:', err.message);
            tcpSocket.destroy();
            tcpSocket = null;
            // attemptReconnect(ip, port);
            reject(err);
        });
    });
}

function attemptReconnect(ip, port) {
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('[Electron] 최대 재연결 시도 횟수를 초과했습니다.');
        mainWindow?.webContents.send('server-log', '[Electron] 최대 재연결 시도 횟수를 초과했습니다.');
        return;
    }

    const delay = Math.min(5000, 1000 * 2 ** reconnectAttempts); // 1초 → 2초 → 4초 → 5초 (최대)
    console.log(`[Electron] ${delay / 1000}초 후 TCP 서버 재연결 시도... (시도: ${reconnectAttempts + 1})`);

    reconnectTimeout = setTimeout(() => {
        reconnectAttempts++;
        createTCPConnection(ip, port);
    }, delay);
}

// JSON 데이터 로그 출력 함수
function displayLog(data) {
    if (data.mode === 'DEBUG') {
        const { id, mode, text, posx, posj } = data;

        console.log(`[${mode}] Robot ID: ${id}`);
        console.log(`Text: ${text}`);
        console.log(`Target Positions X: ${posx}`);
        console.log(`Target Positions J: ${posj}`);
    } else {
        console.log(`Received non-DEBUG message: ${JSON.stringify(data)}`);
    }
}

const checkReactServer = async (url, retries = 60, interval = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await axios.get(url);
            logToServer('React server is ready');
            return true;
        } catch (error) {
            logToServer(`React server not ready yet, retrying... (${i + 1}/${retries})`);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }
    logToServer('React server is not ready after retries.');
    return false;
};

process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

const createWindow = async () => {
    // 로딩 창 생성
    const loadingWindow = new BrowserWindow({
        width: window_width,
        height: window_height,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences: {
            contextIsolation: false, // 기본값 true
            nodeIntegration: true, // 기본값 false
            devTools: true, // DevTools 활성화
        },
    });

    // 로딩 화면 표시
    try {
        logToServer('Loading loading.html...');
        await loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
        console.log('loading.html loaded successfully');
    } catch (error) {
        logToServer(`Failed to load loading.html: ${error.message}`);
    }

    // 메인 화면 생성
    mainWindow = new BrowserWindow({
        width: window_width,
        height: window_height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: true, // 기본값 false
        },
    });

    // 기본 메뉴 제거
    Menu.setApplicationMenu(null);

    const isDev = process.env.NODE_ENV === 'development';
    const startUrl = isDev
        ? 'http://localhost:3000'
        : url.format({
              pathname: path.join(__dirname, '../build/index.html'),
              protocol: 'file:',
              slashes: true,
          });

    logToServer(`Electron load path: ${startUrl}`);

    if (isDev) {
        const serverReady = await checkReactServer(startUrl);
        if (serverReady) {
            try {
                logToServer(`Loading main window URL: ${startUrl}`);
                await mainWindow.loadURL(startUrl);
                logToServer('Main window loaded successfully');
            } catch (error) {
                logToServer(`Failed to load main window: ${error.message}`);
            }
        } else {
            logToServer('Failed to load React server in development mode.');
        }
    } else {
        try {
            await mainWindow.loadURL(startUrl);
        } catch (error) {
            logToServer(`Failed to load file: ${error.message}`);
        }
    }

    // 로딩 창 닫기
    loadingWindow.close();
    mainWindow.show(); // 창이 준비되면 보여주기
    mainWindow.focus(); // 창에 포커스 맞추기

    mainWindow.on('close', (event) => {
        event.preventDefault();

        const choice = dialog.showMessageBoxSync(mainWindow, {
            type: 'question',
            buttons: ['취소', '확인'],
            title: '앱 종료',
            message: '앱을 종료하시겠습니까?',
            defaultId: 1, // '확인' 기본 선택
            cancelId: 0, // '취소' 버튼 ID
        });

        mainWindow = null;

        if (choice === 1) {
            app.exit(); // 앱 완전 종료
        }
    });
};

app.on('ready', () => {
    session.defaultSession.clearCache().then(() => {
        console.log('Cache cleared');
    });

    console.log('App is ready, createWindow...');

    createWindow();

    logToServer('App is ready, registering shortcuts...');
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
            console.log('DevTools toggled via shortcut');
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll(); // 모든 단축키 해제
    app.exit(0); // 명시적 종료
    console.log('All shortcuts unregistered');
});

app.on('activate', () => {
    console.log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
        logToServer('App is quitting');
    }
});

// Electron 종료 시 TCP 연결 종료
app.on('before-quit', () => {
    if (tcpSocket) {
        tcpSocket.destroy(); // TCP 연결 해제
        console.log('TCP connection destroyed');
        tcpSocket = null; // 클라이언트 초기화
    }
});

////////////////////////////////////////////////////
// fetch-work 핸들러
ipcMain.handle('fetch-work-old', async (event, args = {}) => {
    try {
        //const isDelete = args.isDelete || 'F'; // 기본값: 삭제되지 않은 데이터만 조회
        //const work = workId ? dbManager.readWork({ isDelete: 'F', workId }) : dbManager.readAllWorks(); // 작업 ID에 따라 읽기
        const work = dbManager.readWork({ isDelete: 'F', workId: null });

        //console.log('#### ipcMain:fetch-work... ', work);
        //console.log('#### ipcMain:fetch-work...result ', work.success);
        return { success: true, data: work };
    } catch (error) {
        console.error('Error fetching works:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('fetch-work-old2', async (_, isDelete = 'F') => {
    try {
        const rows = dbManager.readAllWorks(isDelete);
        return { success: true, data: rows };
    } catch (error) {
        console.error('Error fetching works:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('fetch-work', async (_, filters = {}) => {
    try {
        const rows = dbManager.readAllWorks(filters); // filters 객체를 그대로 전달
        return { success: true, data: rows };
    } catch (error) {
        console.error('Error fetching works:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-work', async (_, workData) => {
    try {
        const work = dbManager.createWork(workData);
        if (work.success == true) {
            return { success: true, data: work };
        } else {
            return { success: false };
        }
    } catch (error) {
        console.log(`ipcMain.create-work_Error creating work: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-work', async (_, workData) => {
    try {
        const result = dbManager.updateWork(workData);
        logToServer(`Updated Work: ${workData.workId}`);
        //return { success: true };
        return result;
    } catch (error) {
        logToServer(`Error updating work: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-work-fields', async (_, { workId, updateFields }) => {
    try {
        const result = dbManager.updateWork_Fields(workId, updateFields);

        logToServer('update-work-fields');
        logToServer('workId: ', workId);
        logToServer('updateFields: ', updateFields);
        return result;
    } catch (error) {
        logToServer(`Error updating work: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-work', async (_, workId) => {
    try {
        const result = dbManager.deleteWork(workId);
        return result;
    } catch (error) {
        console.log(`Error deleting work: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// IPC 핸들러 - tblTapping
ipcMain.handle('fetch-tapping', async (_, workId) => {
    try {
        const tapping = dbManager.readTapping(workId);
        //console.log(`### Fetched Tapping: `, tapping);
        return { success: true, data: tapping };
    } catch (error) {
        console.log(`Error fetching tapping: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-tapping', async (_, tappingData) => {
    try {
        const result = dbManager.createTapping(tappingData);
        //console.log(`Created Tapping:result ${result}`);
        return { success: true, response: result };
    } catch (error) {
        console.log(`Error creating tapping: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-work-with-tapping', async (_, { work, tappings }) => {
    try {
        dbManager.createWorkWithTapping({ work: work, tappings: tappings });
        console.log(`createWorkWithTapping: ${work.workId}, ${tappings.workId}`);
        return { success: true };
    } catch (error) {
        console.log(`Error creating tapping: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-tapping', async (_, tappingData) => {
    try {
        dbManager.updateTapping(tappingData);
        console.log(`Updated Tapping: ${tappingData.tappingId}`);
        return { success: true };
    } catch (error) {
        logToServer(`Error updating tapping: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-tapping', async (_, { workId, tappingId }) => {
    try {
        dbManager.deleteTapping(workId, tappingId);
        console.log(`Deleted Tapping: ${workId} - ${tappingId}`);
        return { success: true };
    } catch (error) {
        console.log(`Error deleting tapping: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// IPC 핸들러 - tblSetting
ipcMain.handle('fetch-setting', async () => {
    try {
        const setting = dbManager.readSetting();
        console.log(`Fetched Setting`);
        return { success: true, data: setting };
    } catch (error) {
        logToServer(`Error fetching setting: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-setting', async (_, settingData) => {
    try {
        dbManager.createSetting(settingData);
        console.log(`Created Setting`);
        return { success: true };
    } catch (error) {
        console.log(`Error creating setting: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-setting', async (_, settingData) => {
    try {
        dbManager.updateSetting(settingData);
        console.log(`Updated Setting`);
        return { success: true };
    } catch (error) {
        console.log(`Error updating setting: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-setting', async () => {
    try {
        dbManager.deleteSetting();
        console.log(`Deleted Setting`);
        return { success: true };
    } catch (error) {
        console.log(`Error deleting setting: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// IPC 핸들러 - tblLog
ipcMain.handle('fetch-log', async (_, logId) => {
    try {
        const log = dbManager.readLog(logId);
        console.log(`Fetched Log: ${logId}`);
        return { success: true, data: log };
    } catch (error) {
        console.log(`Error fetching log: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-log', async (_, logData) => {
    try {
        dbManager.createLog(logData);
        console.log(`Created Log: ${logData.logId}`);
        return { success: true };
    } catch (error) {
        console.log(`Error creating log: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-log', async (_, logId) => {
    try {
        dbManager.deleteLog(logId);
        console.log(`Deleted Log: ${logId}`);
        return { success: true };
    } catch (error) {
        console.log(`Error deleting log: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// 관리자 암호 확인
ipcMain.handle('verify-admin-password', async (_, password) => {
    return dbManager.verifyAdminPassword(password);
});

// 관리자 암호 변경
ipcMain.handle('update-admin-password', async (_, newPassword) => {
    dbManager.updateAdminPassword(newPassword);
    return { success: true };
});

// 로그인 실패 로그 조회
ipcMain.handle('fetch-login-logs', async () => {
    return dbManager.getLoginLogs();
});

// 렌더러 프로세스에서 tcp-connect 요청 처리
ipcMain.on('tcp-connect', async (event, { ip, port }) => {
    console.log(`[Electron] TCP 연결 요청 수신: ${ip}:${port}`);
    try {
        const tcpSocket = await createTCPConnection(event, ip, port);
        if (tcpSocket) {
            console.log('[Electron] TCP 연결 성공!');
            event.reply('tcp-connect-response', { success: true });
        } else {
            throw new Error('[Electron] TCP 연결 실패!!!!');
        }
    } catch (error) {
        console.error('[Electron] TCP 연결 중 오류 발생:', error.message);
        event.reply('tcp-connect-response', { success: false, error: error.message });
    }
});

ipcMain.on('tcp-disconnect', (event) => {
    if (tcpSocket) {
        tcpSocket.destroy(); // TCP 연결 해제
        tcpSocket = null; // 클라이언트 초기화
        console.log('TCP connection closed');
        event.reply('tcp-disconnect-response', { success: true }); // 연결 해제 응답 추가
    } else {
        event.reply('tcp-disconnect-response', { success: false, error: 'No active TCP connection' });
    }
});
// 렌더러 프로세스에서 데이터 전송 요청 처리
ipcMain.on('send-tcp-data', (event, data) => {
    if (!tcpSocket) {
        event.reply('send-tcp-data-response', { success: false, error: 'No active TCP connection' });
        return tcpSocket;
    }

    try {
        console.log('Sending data to TCP server:', data);
        //data += '\n'; // 개행 문자 추가하여 데이터가 정확히 구분되도록 함
        // @.@ --> 이 부분은 Lua와 통신하면서 전체 데이터 바이트 수를 같이 보내는 로직 적용하면서 제거함
        // 연결 직후 바로 write()하지 않고 200ms 대기
        setTimeout(() => {
            const response = tcpSocket.write(data, (err) => {
                if (err) {
                    console.error('Error writing to TCP server:', err.message);
                    event.reply('send-tcp-data-response', { success: false, error: err.message });
                    return null;
                }

                event.reply('send-tcp-data-response', { success: true, response: 'Data sent successfully' });
            });

            return response;
        }, 200); // ✅ 200ms delay before first write
    } catch (error) {
        console.error('Error sending data to TCP server:', error.message);
        event.reply('send-tcp-data-response', { success: false, error: error.message });
    }
});
