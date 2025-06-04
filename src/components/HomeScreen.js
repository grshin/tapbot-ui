import React, { useRef, useState } from 'react';
import { Card, CardActionArea, CardContent, Typography, Grid, Box } from '@mui/material';
import { FaRobot, FaFolderOpen, FaPlayCircle, FaUserShield } from 'react-icons/fa';
import { useTapbotContext } from '../context/TapbotContext';
import PreviewManager from './PreviewManager';
import { toast, Toaster } from 'react-hot-toast';
import { HOST, PORT, ICON_SIZE } from '../constants';
import AdminLoginPopup from './AdminLoginPopup';
import { Logger } from '../utils/Logger';

const logger = new Logger('debug', false);
logger.setLevel('log');

const HomeScreen = ({ setCurrentMenu }) => {
    const { isConnected, isConnecting, handleConnect, handleDisconnect, ip, port } = useTapbotContext();
    const previewManagerRef = useRef(null);
    const [isAdminPopupOpen, setAdminPopupOpen] = useState(false);

    const handleAdminScreen = () => {
        setAdminPopupOpen(true);
    };

    const handleAdminLoginSuccess = () => {
        setAdminPopupOpen(false);
        setCurrentMenu('Admin');
    };

    const handleRobotConnection = () => {
        if (isConnected) {
            handleDisconnect();
        } else {
            handleConnect(HOST, PORT);
        }
    };

    const handleFileOpen = () => {
        logger.log('파일 열기 클릭');
        if (!isConnected) {
            toast.error('먼저 연결 설정을 진행하세요!!', { duration: 2000, position: 'top-center' });
            return;
        }
        if (previewManagerRef.current) {
            previewManagerRef.current.handleLoadFile();
        }
    };

    const handleContinueProcessing = () => {
        logger.log('handleContinueProcessing');

        if (!previewManagerRef.current) {
            toast.error('먼저 G코드 파일을 로드하세요!', { duration: 2000, position: 'top-center' });
            return;
        }

        const success = previewManagerRef.current.handleContinue();
        if (!success) {
            toast.error('먼저 G코드 파일을 로드하세요!', { duration: 2000, position: 'top-center' });
        }
    };

    const menuItems = [
        {
            title: isConnected ? '연결 해제' : '로봇 연결',
            icon: <FaRobot size={ICON_SIZE} />,
            color: isConnected ? '#E57373' : '#FF8A65',
            action: handleRobotConnection,
        },
        {
            title: 'G코드 파일 열기',
            icon: <FaFolderOpen size={ICON_SIZE} />,
            color: '#4FC3F7',
            action: handleFileOpen,
        },
        {
            title: '계속 가공',
            icon: <FaPlayCircle size={ICON_SIZE} />,
            color: '#9575CD',
            action: handleContinueProcessing,
        },
        {
            title: '관리자 기능',
            icon: <FaUserShield size={ICON_SIZE} />,
            color: '#66BB6A',
            action: handleAdminScreen,
        },
    ];

    return (
        <Box
            sx={{
                position: 'relative',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Toaster />
            <Box
                sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    padding: '8px 16px',
                    borderRadius: 4,
                    bgcolor: '#333',
                    color: '#fff',
                    fontSize: '14px',
                }}
            >
                {isConnecting ? '🟡 연결 중...' : isConnected ? `🟢 연결됨 (${ip}:${port})` : '🔴 연결 안됨'}
            </Box>

            <Grid container spacing={3} justifyContent="center">
                {menuItems.map((item, index) => (
                    <Grid item key={index}>
                        <Card
                            sx={{
                                width: 250,
                                height: 250,
                                borderRadius: 4,
                                bgcolor: item.color,
                                transition: '0.3s',
                                '&:hover': { bgcolor: '#555', transform: 'scale(1.05)' },
                                boxShadow: 3,
                            }}
                        >
                            <CardActionArea
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                                onClick={item.action}
                            >
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        color: '#fff',
                                    }}
                                >
                                    {item.icon}
                                    <Typography variant="h6" sx={{ mt: 2, fontWeight: 'bold' }}>
                                        {item.title}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <PreviewManager ref={previewManagerRef} />
            {isAdminPopupOpen && (
                <AdminLoginPopup
                    open={isAdminPopupOpen} // <== Dialog가 열리도록 변경
                    onClose={() => setAdminPopupOpen(false)}
                    onSuccess={handleAdminLoginSuccess}
                />
            )}
        </Box>
    );
};

export default HomeScreen;
