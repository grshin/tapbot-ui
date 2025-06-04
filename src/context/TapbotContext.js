import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';

import NotificationPopup from '../components/NotificationPopup';

import { Logger } from '../utils/Logger';
const logger = new Logger('debug', false);
logger.setLevel('log');

const TapbotContext = createContext();

export const TapbotProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false); // 로딩 상태 추가
    const [isWorking, setIsWorking] = useState(false); // 작업 진행 상태 추가
    const [ip, setIp] = useState(null);
    const [port, setPort] = useState(null);

    const [activeWork, setActiveWork] = useState(null);
    const [activeScreen, setActiveScreen] = useState('home');

    const [notification, setNotification] = useState(null); // Notification 상태 추가

    const connectionRef = useRef(null); // 연결 상태 유지
    const maintenancePostureRef = useRef(false); // 관리자세 상태 유지

    useEffect(() => {
        window.electron.ipcRenderer.on('tcp-tapping-response', (event, result) => {
            setIsWorking(false); // 즉시 상태 변경하여 UI 반영 우선

            setTimeout(() => {
                logger.log('📩 로봇 작업 완료 응답 수신:', result); // 로그는 비동기로 처리
            }, 0);

            setNotification({
                type: result.type,
                payload: {
                    status: result.payload.status,
                    executionTime: result.payload.executionTime,
                    message: result.payload.message,
                },
            });
        });

        return () => {
            window.electron.ipcRenderer.removeAllListeners('tcp-tapping-response');
        };
    }, []);

    // TCP 연결 응답 핸들러
    const handleConnectResponse = useCallback(
        (event, result) => {
            logger.log('React: tcp-connect-response 이벤트 수신됨!', result);
            setIsConnecting(false); // 연결 완료 → 로딩 해제

            if (result.success) {
                logger.log('React: TCP 연결 성공!');
                setIsConnected(true);
                connectionRef.current = { ip, port };
            } else {
                logger.log('React: TCP 연결 실패!', result.error);
                setIsConnected(false);
                connectionRef.current = null;
                alert(`React: TCP 연결 실패!: ${result.error || '알 수 없는 오류'}`);
            }
        },
        [ip, port],
    );

    // TCP 연결 해제 응답 핸들러
    const handleDisconnectResponse = useCallback((event, result) => {
        logger.log('React: tcp-disconnect-response 이벤트 수신됨', result);

        setIsConnected(false); // 안전장치: UI 반영 보장
        connectionRef.current = null;

        if (!result.success) {
            logger.error('React: TCP 연결 해제 실패!', result.error);
        }
    }, []);

    const handleDisconnected = useCallback((event, result) => {
        logger.log('[React] TCP 연결이 강제로 종료되었습니다.');
        setIsConnected(false); // 서버 측에서 연결 종료 시 UI 반영
        connectionRef.current = null;
    }, []);

    useEffect(() => {
        logger.log('React: TCP 이벤트 리스너 등록됨');

        // 기존 리스너 제거 후 새 리스너 등록
        window.electron.ipcRenderer.removeAllListeners('tcp-connect-response');
        window.electron.ipcRenderer.removeAllListeners('tcp-disconnect-response');

        window.electron.ipcRenderer.on('tcp-connect-response', handleConnectResponse);
        window.electron.ipcRenderer.on('tcp-disconnect-response', handleDisconnectResponse);
        window.electron.ipcRenderer.on('tcp-disconnected', handleDisconnected);

        return () => {
            logger.log('React: TCP 이벤트 리스너 해제됨');
            window.electron.ipcRenderer.removeAllListeners('tcp-connect-response');
            window.electron.ipcRenderer.removeAllListeners('tcp-disconnect-response');
            window.electron.ipcRenderer.removeAllListeners('tcp-disconnected');
        };
    }, [handleConnectResponse, handleDisconnectResponse, handleDisconnected]);

    const handleConnect = (newIp, newPort) => {
        logger.log('### TapbotProvider:handleConnect', newIp, newPort);
        if (!newIp || !newPort) {
            logger.error('IP or Port is missing');
            return;
        }

        setIp(newIp);
        setPort(newPort);
        setIsConnecting(true); // 연결 시도 중 상태 설정

        // 기존 연결 유지 (새로운 연결 요청 방지)
        if (isConnected && connectionRef.current?.ip === newIp && connectionRef.current?.port === newPort) {
            logger.log('### 이미 연결된 상태입니다.');
            return;
        }

        // TCP 연결 요청
        window.electron.ipcRenderer.send('tcp-connect', { ip: newIp, port: Number(newPort) });
    };

    const handleDisconnect = () => {
        logger.log('### TapbotProvider:handleDisconnect');

        setIsConnected(false); // 연결 끊기 버튼 클릭 즉시 UI 반영
        connectionRef.current = null;

        window.electron.ipcRenderer.send('tcp-disconnect');
    };

    return (
        <TapbotContext.Provider
            value={{
                isConnected,
                isConnecting,
                ip,
                port,
                handleConnect,
                handleDisconnect,
                isWorking,
                setIsWorking,
                activeWork,
                setActiveWork,
                activeScreen,
                setActiveScreen,
                connectionRef,
                maintenancePostureRef,
            }}
        >
            {children}
            <NotificationPopup data={notification} /> {/* 🔹 NotificationPopup 추가 */}
        </TapbotContext.Provider>
    );
};

export const useTapbotContext = () => {
    const context = useContext(TapbotContext);
    if (!context) {
        throw new Error('useTcpConnection must be used within a TapbotProvider');
    }
    return context;
};
