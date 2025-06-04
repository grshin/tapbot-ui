import React, { useState, useEffect } from 'react';
import './App.scss'; // SCSS 파일 import
const { ipcRenderer } = window.electron;

function App() {
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);
    const [showErrorPopup, setShowErrorPopup] = useState(false);

    // 요청 전송
    const sendCommand = () => {
        const commandRequest = {
            type: 'command',
            payload: {
                motor: {
                    rpm: 1000,
                    direction: 'forward',
                },
                coolingFan: 'on',
                airInjector: 'off',
                oilInjector: 'on',
            },
        };

        console.log('sendCommand', commandRequest);

        ipcRenderer.send('send-to-robot', commandRequest);
    };

    // 에러 메시지 팝업 닫기
    const closeErrorPopup = () => {
        setShowErrorPopup(false);
        setError(null);
    };

    // React와 Electron 간 메시지 처리
    useEffect(() => {
        const handleResponse = (event, data) => {
            setResponse(JSON.parse(data));
        };

        const handleError = (event, errorMessage) => {
            setError(errorMessage);
            setShowErrorPopup(true); // 에러 발생 시 팝업 표시
        };

        // 리스너 추가
        ipcRenderer.on('robot-response', handleResponse);
        ipcRenderer.on('robot-error', handleError);

        // 컴포넌트 언마운트 시 리스너 제거
        return () => {
            ipcRenderer.removeListener('robot-response', handleResponse);
            ipcRenderer.removeListener('robot-error', handleError);
        };
    }, []);

    return (
        <div className="app-container">
            <button onClick={sendCommand}>Send Command</button>
            {response && <pre>{JSON.stringify(response, null, 2)}</pre>}

            {showErrorPopup && (
                <div className="error-popup">
                    <div className="error-popup-content">
                        <p>{error}</p>
                        <button onClick={closeErrorPopup}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
