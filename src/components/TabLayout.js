import React, { useMemo, useState } from 'react';
import { Tabs, Tab, Box, Button, CircularProgress } from '@mui/material';
import { TabType } from '../constants';
import { useTapbotContext } from '../context/TapbotContext';

import { HOST, PORT } from '../constants';

export default function TabLayout({ currentTab, setCurrentTab, setCurrentMenu, children }) {
    // setCurrentMenu 추가
    const [messageIndex, setMessageIndex] = useState(null);

    const { isConnected, isConnecting, handleConnect, handleDisconnect, activeScreen, maintenancePostureRef } =
        useTapbotContext();

    const tabLabels = useMemo(
        () => ({
            // [TabType.HOME]: 'Home',
            [TabType.DEVICE_MANAGE]: 'Device Manage',
            [TabType.WORK_MANAGE]: 'Work Manage',
            [TabType.SETTING]: 'Setting',
            [TabType.CONTROLLER_TCP]: '컨트롤러 TCP',
        }),
        [],
    );

    const handleChangeTab = (_, newValue) => {
        setCurrentTab(newValue);
        if (activeScreen === 'DeviceManager' && maintenancePostureRef.current) {
            setMessageIndex(1);
            setTimeout(() => setMessageIndex(0), 2000);
        }
    };

    const getConnectionStatus = () => {
        if (isConnecting) return '🟡 연결 중';
        return isConnected ? '🟢 연결됨' : '🔴 끊김';
    };

    const tabStyle = (isActive) => ({
        width: '100%',
        textAlign: 'center',
        padding: '12px',
        marginBottom: '8px',
        backgroundColor: isActive ? 'primary.main' : 'info.main',
        color: 'white !important',
        borderRadius: '4px',
        cursor: 'pointer',
    });

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* 팝업 메시지 */}
            {messageIndex === 1 && (
                <div className="working-overlay">
                    <div className="working-popup">🔄 홈 위치로 로봇을 이동합니다.</div>
                </div>
            )}

            {/* 사이드바 영역 */}
            <Box
                sx={{
                    width: 220,
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }}
            >
                {/* 탭 메뉴 */}
                <Tabs
                    orientation="vertical"
                    value={currentTab}
                    onChange={handleChangeTab}
                    sx={{ width: '100%', flexGrow: 1 }}
                >
                    {Object.keys(tabLabels).map((tabKey) => {
                        const tabValue = Number(tabKey);
                        return (
                            <Tab
                                key={tabValue}
                                label={tabLabels[tabValue]}
                                value={tabValue}
                                sx={tabStyle(currentTab === tabValue)}
                            />
                        );
                    })}
                </Tabs>

                {/* TCP 연결 상태 UI + 연결 버튼 */}
                <Box
                    sx={{
                        padding: '8px',
                        backgroundColor: '#ddd',
                        textAlign: 'center',
                        borderRadius: '4px',
                        marginTop: 2,
                    }}
                >
                    <span>{getConnectionStatus()}</span>
                    {isConnected ? (
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={handleDisconnect}
                            sx={{ width: '100%', mt: 1 }}
                        >
                            연결 끊기
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleConnect(HOST, PORT)}
                            sx={{
                                width: '100%',
                                mt: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                            }}
                        >
                            {isConnecting && <CircularProgress size={20} sx={{ color: 'white' }} />}
                            {isConnecting ? '연결 중...' : '연결'}
                        </Button>
                    )}
                    {/* "홈화면으로" 버튼 추가 */}
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={() => setCurrentMenu('HomeScreen')} // 홈 화면으로 이동
                        sx={{ width: '100%', mt: 2 }}
                    >
                        홈화면으로
                    </Button>
                </Box>
            </Box>

            {/* 컨텐츠 영역 */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>{children}</Box>
        </div>
    );
}
