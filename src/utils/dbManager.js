// Import necessary modules
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { app } = require('electron');

const { logToServer } = require('./logToServer'); // utils/log.js 파일 경로

// Initialize database
let dbPath;
// 개발 환경에서는 상대 경로 사용
if (!app.isPackaged) {
    dbPath = path.join(__dirname, '../../dbfile/tapbot.db');
} else {
    //프로덕션 환경에서는 userData 경로 사용
    dbPath = path.join(app.getPath('userData'), 'tapbot.db');
}

const db = new Database(dbPath);

// Function to initialize tables
function initializeTables() {
    console.log('### initializeTables... ');
    // tblWork
    db.exec(`
        CREATE TABLE IF NOT EXISTS tblWork (
            workId TEXT PRIMARY KEY,
            workFileName TEXT,
            workName TEXT,
            partSizeX INTEGER,
            partSizeY INTEGER,
            partThickness REAL,
            initialHeight REAL,
            chamferLength REAL,
            machiningAllowance REAL,
            toolName TEXT,
            rpmIndex INTEGER,
            createDate TEXT,
            isActivation TEXT DEFAULT 'F',
            tappingCount INTEGER,
            isDelete TEXT DEFAULT 'F',
            deleteDate TEXT,
            simulationCount INTEGER,
            lastSimulationDate TEXT,
            playCount INTEGER,
            lastPlayDate TEXT
        );
    `);

    // tblTapping
    db.exec(`
        CREATE TABLE IF NOT EXISTS tblTapping (
            id TEXT PRIMARY KEY,
            workId TEXT NOT NULL,
            x REAL,
            y REAL,
            d REAL,
            t INTEGER,
            FOREIGN KEY (workId) REFERENCES tblWork(workId) ON DELETE CASCADE
        );
    `);

    // tblSetting 테이블 (관리자 암호 추가)
    db.exec(`
        CREATE TABLE IF NOT EXISTS tblSetting (
            defaultTappingIP TEXT,
            defaultRPM INTEGER,
            defaultTorque INTEGER,
            admin_pwd TEXT
        );
   `);

    // tblLog
    db.exec(`
        CREATE TABLE IF NOT EXISTS tblLog (
            logId TEXT PRIMARY KEY,
            workId TEXT NOT NULL,
            kind TEXT,
            writeDate TEXT,
            FOREIGN KEY (workId) REFERENCES tblWork(workId)
        );
    `);

    // 로그인 실패 기록 테이블 추가
    db.exec(`
        CREATE TABLE IF NOT EXISTS tblLoginLog (
            logId INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            status TEXT
        );
    `);

    db.pragma('foreign_keys = ON');

    // 관리자 비밀번호 초기화
    initializeAdminPassword();
}

// 초기 관리자 암호 설정 함수
function initializeAdminPassword() {
    const row = db.prepare('SELECT admin_pwd FROM tblSetting').get();
    if (!row || !row.admin_pwd) {
        const hashedPassword = bcrypt.hashSync('admin', 10);
        db.prepare('INSERT OR REPLACE INTO tblSetting (admin_pwd) VALUES (?)').run(hashedPassword);
        console.log('관리자 비밀번호가 초기화되었습니다.');
    }
}

// 관리자 암호 확인
function verifyAdminPassword(inputPassword) {
    const row = db.prepare('SELECT admin_pwd FROM tblSetting').get();
    if (!row || !row.admin_pwd) return false;

    const isValid = bcrypt.compareSync(inputPassword, row.admin_pwd);

    // 로그인 실패 시 로그 기록
    if (!isValid) {
        logFailedAttempt();
    }

    return isValid;
}

// 관리자 암호 변경
function updateAdminPassword(newPassword) {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE tblSetting SET admin_pwd = ?').run(hashedPassword);
}

// 로그인 실패 기록
function logFailedAttempt() {
    const timestamp = new Date().toISOString();
    db.prepare('INSERT INTO tblLoginLog (timestamp, status) VALUES (?, ?)').run(timestamp, 'failed');
}

// 로그 조회
function getLoginLogs() {
    return db.prepare('SELECT * FROM tblLoginLog ORDER BY timestamp DESC').all();
}

function validateWorkData(newWork) {
    const requiredFields = [
        'workId',
        'workFileName',
        'workName',
        'partSizeX',
        'partSizeY',
        'partThickness',
        'initialHeight',
        'chamferLength',
        'machiningAllowance',
        'toolName',
        'rpmIndex',
        'createDate',
        'isActivation',
        'tappingCount',
        'isDelete',
        'deleteDate',
        'simulationCount',
        'lastSimulationDate',
        'playCount',
        'lastPlayDate',
    ];

    for (const field of requiredFields) {
        if (!(field in newWork)) {
            console.log('### createWork:validateWorkData... ');
            throw new Error(`Missing required field: ${field}`);
        }
    }
}

function createWork(newWork) {
    try {
        // console.log('### dbManager:createWork..newWork... ', newWork);

        // 중복 확인
        const existingWork = db.prepare('SELECT 1 FROM tblWork WHERE workId = ?').get(newWork.workId);
        if (existingWork) {
            return { success: false, error: 'Duplicate workId' };
        }

        //const workWithDefaults = addDefaultValues(newWork); // 기본값 추가

        // 데이터 삽입
        const stmt = db.prepare(`
          INSERT INTO tblWork (
              workId, workFileName, workName, partSizeX, partSizeY, 
              partThickness, initialHeight, chamferLength, machiningAllowance, toolName, rpmIndex, 
              createDate, isActivation, tappingCount, isDelete, deleteDate, simulationCount, lastSimulationDate, playCount, lastPlayDate
          ) VALUES (
              @workId, @workFileName, @workName, @partSizeX, @partSizeY, 
              @partThickness, @initialHeight, @chamferLength, @machiningAllowance, @toolName, @rpmIndex,
              @createDate, @isActivation, @tappingCount, @isDelete, @deleteDate, @simulationCount, @lastSimulationDate, @playCount, @lastPlayDate
          )
        `);

        const result = stmt.run(newWork);
        // console.log('### dbManager:createWork.stmt.run ', result);

        // 삽입된 데이터 반환
        const insertedWork = db.prepare('SELECT * FROM tblWork WHERE workId = ?').get(newWork.workId);
        if (insertedWork) {
            return { success: true, data: insertedWork };
        } else {
            return { success: false, data: null };
        }
    } catch (error) {
        console.error('데이터베이스 삽입 중 오류 발생:', error.message);
        return { success: false, error: error.message };
    }
}

function createWorkWithTapping({ work, tappings }) {
    try {
        const transaction = db.transaction(() => {
            // 1. tblWork에 작업 데이터 삽입
            createWork(work);
            // console.log(`Created Work: ${work.workId}`);

            // 2. tblTapping에 탭 데이터 삽입
            const tappingStmt = db.prepare(`
                INSERT INTO tblTapping (workId, id, x, y, d, t)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            tappings.forEach((tapping) => {
                tappingStmt.run(tapping.workId, tapping.id, tapping.x, tapping.y, tapping.d, tapping.t);
            });
        });

        transaction(); // 트랜잭션 실행

        return { success: true };
    } catch (error) {
        console.error(`Error in create-work-with-tapping: ${error.message}`);
        return { success: false, error: error.message };
    }
}

function readWork({ isDelete, workId }) {
    try {
        let query = 'SELECT * FROM tblWork WHERE isDelete = ?';
        const params = [isDelete];

        // workId가 제공된 경우 조건 추가
        if (workId) {
            query += ' AND workId = ?';
            params.push(workId);
        }

        const stmt = db.prepare(query);
        const data = stmt.all(...params);
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching work:', error.message);
        return { success: false, error: error.message };
    }
}

// 모든 작업을 가져오는 함수 (filters 객체 활용)
function readAllWorks(filters = {}) {
    try {
        let query = `SELECT * FROM tblWork WHERE 1=1`; // 기본 WHERE 조건
        let params = [];

        if (filters.isDelete !== undefined) {
            query += ` AND isDelete = ?`;
            params.push(filters.isDelete);
        }
        if (filters.isActivation !== undefined) {
            query += ` AND isActivation = ?`;
            params.push(filters.isActivation);
        }

        // SQL 실행
        const stmt = db.prepare(query);
        return stmt.all(...params);
    } catch (error) {
        console.error('Error reading works:', error.message);
        return [];
    }
}

// 함수 정의
function updateDeleted(workId, isDelete) {
    try {
        // SQL 문 준비
        const stmt = db.prepare('UPDATE tblWork SET isDelete = ? WHERE workId = ?');

        // SQL 실행
        const result = stmt.run(isDelete, workId);
        console.log(`Rows updated: ${result.changes}`);
        return result;
    } catch (error) {
        console.error('Error updating record:', error);
    }
}

function updateWork(work) {
    const stmt = db.prepare(`
    UPDATE tblWork
    SET workFileName = ?, workName = ?, partSizeX = ?, partSizeY = ?, partThickness = ?, initialHeight = ?, chamferLength = ?, machiningAllowance = ?, 
        toolName = ?, rpmIndex = ?, createDate = ?, isActivation = ?, tappingCount = ?, isDelete = ?, deleteDate = ?,
        simulationCount = ?, lastSimulationDate = ?, playCount = ?, lastPlayDate = ?
    WHERE workId = ?
  `);
    return stmt.run(
        work.workFileName,
        work.workName,
        work.partSizeX,
        work.partSizeY,
        work.partThickness,
        work.initialHeight,
        work.chamferLength,
        work.machiningAllowance,
        work.toolName,
        work.rpmIndex,
        work.createDate,
        work.isActivation,
        work.tappingCount,
        work.isDelete,
        work.deleteDate,
        work.simulationCount,
        work.lastSimulationDate,
        work.playCount,
        work.lastPlayDate,
        work.workId, // Primary Key 조건
    );
}

// 업데이트 함수 정의
function updateWork_Fields(workId, updateFields) {
    try {
        console.log('workId:', workId);
        console.log('updateFields:', updateFields);
        // 업데이트할 필드와 값을 처리
        const keys = Object.keys(updateFields);
        const values = Object.values(updateFields);

        if (keys.length === 0) {
            throw new Error('No fields provided for update');
        }

        // SET 구문 생성
        const setClause = keys.map((key) => `${key} = ?`).join(', ');

        // SQL 쿼리 준비
        const sql = `UPDATE tblWork SET ${setClause} WHERE workId = ?`;

        // 쿼리 실행
        const stmt = db.prepare(sql);
        const result = stmt.run(...values, workId);

        console.log(`Rows updated: ${result.changes}`);
        return { success: true, changes: result.changes };
    } catch (error) {
        console.error('Error updating work:', error);
        return { success: false, error: error.message };
    }
}

function deleteWork(workId) {
    console.log('##dbManager:deleteWork..workId', workId);
    try {
        // DELETE 쿼리 준비
        const stmt = db.prepare('DELETE FROM tblWork WHERE workId = ?');

        // 쿼리 실행
        const result = stmt.run(workId);

        console.log(`삭제된 행 수: ${result.changes}`);

        return result;
    } catch (error) {
        console.error('쿼리 실행 중 오류 발생:', error.message);
    }
}

// tblTapping CRUD
function createTapping(tapping) {
    const stmt = db.prepare(`
    INSERT INTO tblTapping (workId, id, x, y, d, t)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(tapping.workId, tapping.id, tapping.x, tapping.y, tapping.d, tapping.t);

    return result;
}

function readTapping(workId) {
    //logToServer('#### readTapping.workId: ', workId);
    const stmt = db.prepare(`SELECT * FROM tblTapping WHERE workId = ?`);
    return stmt.all(workId); // workId를 자리 표시자로 전달
}

function updateTapping(tapping) {
    logToServer('#### updateTapping.tapping: ', tapping);
    const stmt = db.prepare(`
    UPDATE tblTapping
    SET x = ?, y = ?, d = ?, t = ?
    WHERE workId = ? AND id = ?
  `);
    stmt.run(tapping.x, tapping.y, tapping.d, tapping.workId, tapping.id, tapping.t);
}

function deleteTapping(workId, tappingId) {
    logToServer('#### deleteTapping.workId: ', workId);
    logToServer('#### deleteTapping.tappingId: ', tappingId);
    const stmt = db.prepare(`DELETE FROM tblTapping WHERE workId = ? AND tappingId = ?`);
    stmt.run(workId, tappingId);
}

// tblSetting CRUD
function createSetting(setting) {
    const stmt = db.prepare(`INSERT INTO tblSetting (defaultTappingIP, defaultRPM, defaultTorque) VALUES (?, ?, ?)`);
    stmt.run(setting.defaultTappingIP, setting.defaultRPM, setting.defaultTorque);
}

function readSetting() {
    const stmt = db.prepare(`SELECT * FROM tblSetting LIMIT 1`);
    return stmt.get();
}

function updateSetting(setting) {
    const stmt = db.prepare(`
    UPDATE tblSetting
    SET defaultTappingIP = ?, defaultRPM = ?, defaultTorque = ?
  `);
    stmt.run(setting.defaultTappingIP, setting.defaultRPM, setting.defaultTorque);
}

function deleteSetting() {
    const stmt = db.prepare(`DELETE FROM tblSetting`);
    stmt.run();
}

// tblLog CRUD
function createLog(log) {
    const stmt = db.prepare(`
    INSERT INTO tblLog (logId, kind, workId, writeDate)
    VALUES (?, ?, ?, ?)
  `);
    return stmt.run(log.logId, log.kind, log.workId, log.writeDate);
}

function readLog(logId) {
    const stmt = db.prepare(`SELECT * FROM tblLog WHERE logId = ?`);
    return stmt.get(logId);
}

function updateLog(log) {
    const stmt = db.prepare(`
    UPDATE tblLog
    SET kind = ?, workId = ?, writeDate = ?
    WHERE logId = ?
  `);
    return stmt.run(log.kind, log.workId, log.writeDate, log.logId);
}

function deleteLog(logId) {
    const stmt = db.prepare(`DELETE FROM tblLog WHERE logId = ?`);
    return stmt.run(logId);
}

// Initialize tables
initializeTables();

// Export CRUD functions
module.exports = {
    createWork,
    createWorkWithTapping,
    readWork,
    readAllWorks,
    updateWork,
    updateWork_Fields,
    deleteWork,
    createTapping,
    readTapping,
    updateTapping,
    deleteTapping,
    createSetting,
    readSetting,
    updateSetting,
    deleteSetting,
    createLog,
    readLog,
    updateLog,
    deleteLog,
    verifyAdminPassword,
    updateAdminPassword,
    getLoginLogs,
};
