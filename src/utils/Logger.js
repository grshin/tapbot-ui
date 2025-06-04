import StackTrace from 'stacktrace-js';

class Logger {
    static levels = { trace: 0, log: 1, debug: 2, info: 3, warn: 4, error: 5 };

    constructor(level = 'info', useTimestamp = true, useCallerInfo = false) {
        this.currentLevel = Logger.levels[level] ?? Logger.levels.info;
        this.useTimestamp = useTimestamp;
        this.useCallerInfo = useCallerInfo; // 🔹 옵션 추가
    }

    setLevel(level) {
        this.currentLevel = Logger.levels[level] ?? Logger.levels.info;
    }

    enableTimestamp(enable) {
        this.useTimestamp = enable;
    }

    async getCallerInfo() {
        try {
            const stackFrames = await StackTrace.get();
            const caller = stackFrames.find((frame) => !frame.fileName.includes('Logger.js')); // Logger.js 제외

            if (caller) {
                const filePath = caller.fileName.split('/').slice(-2).join('/'); // 경로 정리
                return `${filePath}:${caller.lineNumber}`;
            }
        } catch (error) {
            return 'unknown';
        }
        return 'unknown';
    }

    async consoleLog(level, message, ...args) {
        if (Logger.levels[level] >= this.currentLevel) {
            const timestamp = this.useTimestamp ? `[${new Date().toISOString()}]` : '';
            let callerInfo = '';

            if (this.useCallerInfo) {
                callerInfo = await this.getCallerInfo(); // 🔹 선택적으로 호출
                callerInfo = `(${callerInfo})`;
            }

            const logMethod = console[level] || console.log;
            logMethod(`${timestamp} [${level.toUpperCase()}] ${callerInfo} ${message}`, ...args);
        }
    }

    trace(message, ...args) {
        this.consoleLog('trace', message, ...args);
    }

    log(message, ...args) {
        this.consoleLog('log', message, ...args);
    }

    debug(message, ...args) {
        this.consoleLog('debug', message, ...args);
    }

    info(message, ...args) {
        this.consoleLog('info', message, ...args);
    }

    warn(message, ...args) {
        this.consoleLog('warn', message, ...args);
    }

    error(message, ...args) {
        this.consoleLog('error', message, ...args);
    }
}

export { Logger };
