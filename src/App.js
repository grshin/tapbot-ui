import React, { useState, useEffect } from 'react';
import HomeScreen from './components/HomeScreen';
import Admin from './components/Admin';

import { TapbotProvider } from './context/TapbotContext';
import { Logger } from './utils/Logger';

const logger = new Logger('debug', false, false);
logger.setLevel('log');

function App(props) {
    const [currentMenu, setCurrentMenu] = useState('HomeScreen'); // 기본값 HomeScreen

    useEffect(() => {
        logger.trace('🚀 App.js: server-log 이벤트 리스너 등록됨');

        let logCount = 0;
        const maxLogs = 500;

        const handleServerLog = (event, data) => {
            if (logCount > maxLogs) {
                return;
            }
            logCount++;
            logger.log('[SLOG]', data.toString());
        };

        window.electron.ipcRenderer.on('server-log', handleServerLog);

        return () => {
            logger.trace('App.js: server-log 이벤트 리스너 해제됨');
            window.electron.ipcRenderer.removeListener('server-log', handleServerLog);
        };
    }, []);

    return (
        <TapbotProvider>
            {currentMenu === 'Admin' ? (
                <Admin setCurrentMenu={setCurrentMenu} /> // Admin에서 setCurrentMenu 사용 가능하도록 전달
            ) : (
                <HomeScreen setCurrentMenu={setCurrentMenu} /> // setCurrentMenu 올바르게 전달
            )}
        </TapbotProvider>
    );
}

export default App;
