import React, { useState, useEffect, useRef } from 'react';
import {
    Container,
    Typography,
    TextField,
    Button,
    Grid,
    TableContainer,
    Table,
    TableBody,
    TableRow,
    TableCell,
    Toolbar,
    Slider,
    Box,
    CircularProgress,
} from '@mui/material';

import { useTapbotContext } from '../../context/TapbotContext'; // Context 훅 추가
import { Logger } from '../../utils/Logger';
const logger = new Logger('debug', false);
logger.setLevel('debug');

const { ipcRenderer } = window.electron;

const MAX_RPM_LEVEL = 16;
const maxRpm = 490;
const rpmLevels = Array.from({ length: MAX_RPM_LEVEL }, (_, i) => ({
    label: `단계 ${i + 1}`,
    rpm: Math.round((maxRpm / MAX_RPM_LEVEL) * (i + 1)),
}));
// const rpmLevels = [
//     { label: '단계 1', rpm: 30.625 },
//     { label: '단계 2', rpm: 61.25 },
//     ...
//     { label: '단계 16', rpm: 490 },
// ];

// 로봇 서버의 IP와 포트
//const HOST = '127.0.0.1'; // 로봇 앱 서버 IP
//const HOST = '192.168.137.100'; // 로봇 앱 서버 IP
//const PORT = 20002; // 로봇 앱 서버 포트

function DeviceManager() {
    //const [ip, setIp] = useState(HOST);
    // localStorage에서 rpmIndex 값 가져오기 (없으면 기본값 8)
    const [rpmIndex, setRpmIndex] = useState(() => {
        const savedIndex = localStorage.getItem('rpmIndex');
        return savedIndex !== null ? Number(savedIndex) : 8;
    });

    const [motorState, setMotorState] = useState('정지');
    const [airState, setAirState] = useState('정지');
    const [oilState, setOilState] = useState('정지');
    const [oilDuration, setOilDuration] = useState('25');
    const [coolingFanState, setCoolingFantate] = useState('정지');
    const [softStartState, setSoftStartState] = useState('100ms');

    const [maintenancePosture, setMaintenancePosture] = useState(false);
    const [tapbotStatus, setTapbotStatus] = useState(false);

    const [xCoordinate, setXCoordinate] = useState(2); // 기본값 2
    const [yCoordinate, setYCoordinate] = useState(2); // 기본값 2

    const [xReach, setReachX] = useState(480); // 기본값 480
    const [yReach, setReachY] = useState(480); // 기본값 480

    const { connectionRef, isWorking, handleConnect, setIsWorking, setActiveScreen, maintenancePostureRef } =
        useTapbotContext();

    useEffect(() => {
        setActiveScreen('DeviceManager');

        return () => {
            // console.log('🗑️ DeviceManager 언마운트됨!', maintenancePostureRef.current);
            if (maintenancePostureRef.current) {
                handleMaintenancePosture('off'); // 홈으로 이동
                maintenancePostureRef.current = false;
            }
        };
    }, [setActiveScreen]);

    // rpmIndex 변경될 때마다 localStorage에 저장
    useEffect(() => {
        localStorage.setItem('rpmIndex', rpmIndex);
    }, [rpmIndex]);

    const handleSave = () => {
        logger.log('Saved values:', { rpm: rpmLevels[rpmIndex].rpm });
    };

    // const handleConnectClick = () => {
    //     handleConnect(ip, 20002);
    // };

    const sendData = (commandRequest) => {
        return new Promise((resolve, reject) => {
            if (connectionRef.current === null) {
                logger.error('TCP 서버와 연결되지 않은 상태에서 데이터를 전송하려고 시도했습니다.');
                alert('TCP 서버와 연결되지 않았습니다. 먼저 연결을 확인하세요.');
                reject('TCP 서버 연결 없음');
                return;
            }

            // const jsonString = JSON.stringify(commandRequest);
            // const byteLength = new TextEncoder().encode(jsonString).length;
            // const dataToSend = `HEAD:${byteLength}\n${jsonString}`;

            const dataToSend = JSON.stringify(commandRequest);

            // const jsonString = JSON.stringify(commandRequest);
            // const base64String = btoa(unescape(encodeURIComponent(jsonString))); // UTF-8 안전하게 인코딩

            // const byteLength = base64String.length; // BASE64 길이 기준
            // const dataToSend = `LEN:${byteLength}\n${base64String}`;

            try {
                ipcRenderer.send('send-tcp-data', dataToSend);

                ipcRenderer.once('send-tcp-data-response', (event, result) => {
                    if (result.success) {
                        logger.log('TCP 데이터 전송 성공:', result.response);
                        resolve(result.response);
                    } else {
                        logger.error('TCP 데이터 전송 실패:', result.error);
                        alert(`TCP 데이터 전송 실패: ${result.error}`);
                        reject(result.error);
                    }
                });
            } catch (error) {
                logger.error('TCP 전송 오류:', error.message);
                alert('TCP 전송 오류 발생.');
                reject(error.message);
            }
        });
    };

    // 'motor_cw', 'motor_ccw'
    const handleMotorAction = async (action) => {
        logger.log('handleMotorAction:', action);
        const commandRequest = {
            type: 'command',
            payload: {
                motor: {
                    mode: 'operation-on',
                    rpmIndex: rpmIndex + 1, // 1~16 단계로, 사람이 인식하는 값으로 변경
                    action: action,
                },
            },
        };

        try {
            await sendData(commandRequest);
            if (action === 'motor_cw') {
                setMotorState('정방향 회전');
            } else if (action === 'motor_ccw') {
                setMotorState('역방향 회전');
            }
        } catch (error) {
            logger.error('Motor action failed:', error);
        }
    };

    const handleMotorStop = async () => {
        logger.log('handleMotorStop 실행');

        const commandRequest = {
            type: 'command',
            payload: {
                motor: {
                    action: 'stop',
                },
            },
        };

        try {
            await sendData(commandRequest);
            setMotorState('정지');
        } catch (error) {
            logger.error('Motor stop failed:', error);
        }
    };

    const handleAirInjector = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                airInjector: mode,
            },
        };

        try {
            await sendData(commandRequest);
            setAirState(mode === 'on' ? '실행' : '멈춤');
        } catch (error) {
            logger.error('Air Injector failed:', error);
        }
    };

    const handleOilInjector = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                oilInjector: mode,
                oilDuration: oilDuration,
            },
        };

        try {
            await sendData(commandRequest);
            setOilState(mode === 'on' ? '실행' : '정지');
        } catch (error) {
            logger.error('Oil Injector failed:', error);
        }
    };

    const handleSoftStart = async (motor_mode, value) => {
        logger.log('handleSoftStart 실행:', motor_mode, value);

        const commandRequest = {
            type: 'command',
            payload: {
                motor: {
                    mode: motor_mode, //'soft_start'
                    value: value, // 100
                },
            },
        };

        try {
            await sendData(commandRequest);
            setSoftStartState(value === 100 ? '100ms' : '200ms');
        } catch (error) {
            logger.error('Motor mode change failed:', error);
        }
    };

    const handleMotorMode = async (motor_mode, value) => {
        logger.log('handleMotorMode 실행:', motor_mode);

        const commandRequest = {
            type: 'command',
            payload: {
                motor: {
                    mode: motor_mode,
                    value: value,
                },
            },
        };

        try {
            await sendData(commandRequest);
            if (motor_mode == 'operation') {
                setMotorState(value === 'on' ? '동작 설정' : '무동작 설정');
            }
        } catch (error) {
            logger.error('Motor mode change failed:', error);
        }
    };

    const handleWorkPiece = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                workPiece: {
                    mode: mode,
                    ...(mode === 'check' && { x: xCoordinate, y: yCoordinate }),
                    ...(mode === 'goto_ref_origin' && { x: 0, y: 0 }),
                },
            },
        };

        try {
            await sendData(commandRequest);
            setIsWorking(true);
            logger.log(`Base metal ${mode} at (${xCoordinate}, ${yCoordinate}) 성공`);
        } catch (error) {
            logger.error('Base metal failed:', error);
        }
    };

    const handleReachArea = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                reachArea: {
                    mode: mode,
                    ...(mode === 'check' && { x: xReach, y: yReach }),
                    ...(mode === 'goto_ref_origin' && { x: 0, y: 0 }),
                },
            },
        };

        try {
            await sendData(commandRequest);
            setIsWorking(true);
        } catch (error) {
            logger.error('handleReachArea failed:', error);
        }
    };

    // TODO: CoolingFan 지원 모델이 경우 아래 코드 적용
    // sig_10 쿨링팬을 태핑 상태처리를 위해서 사용
    const handleCoolingFan = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                coolingFan: mode,
            },
        };
        try {
            await sendData(commandRequest);
            if (mode === 'on') {
                setCoolingFantate('실행');
            } else if (mode === 'off') {
                setCoolingFantate('정지');
            }
        } catch (error) {
            logger.error('Error sending data to TCP server:', error.message);
            alert('데이터 전송 중 오류가 발생했습니다.');
        }
    };

    const handleMaintenancePosture = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                maintenancePosture: mode,
            },
        };
        try {
            await sendData(commandRequest);
            setIsWorking(true);
            if (mode === 'on') {
                setMaintenancePosture(true);
                maintenancePostureRef.current = true;
            } else if (mode === 'off') {
                setMaintenancePosture(false);
                maintenancePostureRef.current = false;
            }
        } catch (error) {
            logger.error('Error sending data to TCP server:', error.message);
            alert('데이터 전송 중 오류가 발생했습니다.');
        }
    };

    const handleTapbotStatus = async (mode) => {
        const commandRequest = {
            type: 'command',
            payload: {
                tapbotStatus: mode,
            },
        };

        try {
            await sendData(commandRequest);
            if (mode === 'on') {
                setTapbotStatus(true);
            } else if (mode === 'off') {
                setTapbotStatus(false);
            }
        } catch (error) {
            logger.error('Error sending data to TCP server:', error.message);
            alert('데이터 전송 중 오류가 발생했습니다.');
        }
    };

    return (
        <Container maxWidth="sm" className="container-device-manager">
            {/* ✅ 화면 전체 팝업 */}
            {isWorking && (
                <div className="working-overlay">
                    <div className="working-popup">🦾로봇 작업 중...</div>
                </div>
            )}
            <h2 style={{ textAlign: 'left' }}>SPTek Tapping - 장치 관리</h2>
            <Grid container direction="column" alignItems="flex-start">
                <TableContainer>
                    <Table className="table-device-manager">
                        <TableBody>
                            {/* <TableRow>
                                <TableCell className="table-cell-header">로봇 IP 주소</TableCell>
                                <TableCell className="table-cell-body">
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        value={ip}
                                        onChange={(e) => setIp(e.target.value)}
                                    />
                                    {isConnected ? (
                                        <Button variant="contained" color="secondary" onClick={handleDisconnect}>
                                            연결 끊기
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleConnectClick}
                                            disabled={isConnecting} // 연결 중이면 버튼 비활성화
                                        >
                                            {isConnecting ? <CircularProgress size={24} /> : '연결'}
                                        </Button>
                                    )}{' '}
                                </TableCell>
                            </TableRow> */}
                            <TableRow>
                                <TableCell className="table-cell-header">RPM</TableCell>
                                <TableCell>
                                    <Box sx={{ width: 400, padding: 2 }}>
                                        {/* <Typography gutterBottom>RPM 설정</Typography> */}
                                        <Slider
                                            value={rpmIndex}
                                            onChange={(_, newValue) => setRpmIndex(newValue)}
                                            step={1}
                                            min={0}
                                            max={15}
                                        />
                                        <Typography>
                                            선택된 RPM: {rpmLevels[rpmIndex].rpm} RPM ({rpmIndex + 1}){' '}
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">모터 상태</TableCell>
                                <TableCell className="table-cell-body">
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMotorAction('motor_cw')}
                                    >
                                        정방향 회전
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMotorAction('motor_ccw')}
                                    >
                                        역방향 회전
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMotorStop()}
                                    >
                                        정지
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMotorMode('operation', 'off')}
                                    >
                                        무동작
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMotorMode('operation', 'on')}
                                    >
                                        동작
                                    </Button>

                                    <Typography style={{ textAlign: 'left' }}>현재 상태: {motorState}</Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">에어 상태</TableCell>
                                <TableCell className="table-cell-body">
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleAirInjector('on')}
                                    >
                                        실행
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleAirInjector('off')}
                                    >
                                        정지
                                    </Button>
                                    <Typography style={{ textAlign: 'left' }}>현재 상태: {airState}</Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">오일 상태</TableCell>
                                <TableCell className="table-cell-body">
                                    {/* oilDuration 입력 필드 */}
                                    <TextField
                                        label="X 좌표"
                                        type="number"
                                        variant="outlined"
                                        size="small"
                                        value={oilDuration}
                                        onChange={(e) => setOilDuration(Number(e.target.value))}
                                        sx={{ width: 100, marginRight: 2 }}
                                    />

                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleOilInjector('on')}
                                    >
                                        실행
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleOilInjector('off')}
                                    >
                                        정지
                                    </Button>
                                    <Typography style={{ textAlign: 'left' }}>현재 상태: {oilState}</Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">쿨링팬</TableCell>
                                <TableCell className="table-cell-body">
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleCoolingFan('on')}
                                    >
                                        실행
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleCoolingFan('off')}
                                    >
                                        정지
                                    </Button>
                                    <Typography style={{ textAlign: 'left' }}>현재 상태: {coolingFanState}</Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">소프트 Start</TableCell>
                                <TableCell className="table-cell-body">
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleSoftStart('soft_start', 100)}
                                    >
                                        100ms 설정
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleSoftStart('soft_start', 200)}
                                    >
                                        200ms 설정
                                    </Button>
                                    <Typography style={{ textAlign: 'left' }}>현재 상태: {softStartState}</Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">가공물 위치</TableCell>
                                <TableCell className="table-cell-body">
                                    {/* X 좌표 입력 필드 */}
                                    <TextField
                                        label="X 좌표"
                                        type="number"
                                        variant="outlined"
                                        size="small"
                                        value={xCoordinate}
                                        onChange={(e) => setXCoordinate(Number(e.target.value))}
                                        sx={{ width: 100, marginRight: 2 }}
                                    />
                                    {/* Y 좌표 입력 필드 */}
                                    <TextField
                                        label="Y 좌표"
                                        type="number"
                                        variant="outlined"
                                        size="small"
                                        value={yCoordinate}
                                        onChange={(e) => setYCoordinate(Number(e.target.value))}
                                        sx={{ width: 100, marginRight: 2 }}
                                    />
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleWorkPiece('check')}
                                        disabled={maintenancePosture}
                                    >
                                        모재 측정
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleWorkPiece('goto_ref_origin')}
                                        disabled={maintenancePosture}
                                    >
                                        원점 이동
                                    </Button>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">리치 확인</TableCell>
                                <TableCell className="table-cell-body">
                                    {/* X 좌표 입력 필드 */}
                                    <TextField
                                        label="X 좌표"
                                        type="number"
                                        variant="outlined"
                                        size="small"
                                        value={xReach}
                                        onChange={(e) => setReachX(Number(e.target.value))}
                                        sx={{ width: 100, marginRight: 2 }}
                                    />
                                    {/* Y 좌표 입력 필드 */}
                                    <TextField
                                        label="Y 좌표"
                                        type="number"
                                        variant="outlined"
                                        size="small"
                                        value={yReach}
                                        onChange={(e) => setReachY(Number(e.target.value))}
                                        sx={{ width: 100, marginRight: 2 }}
                                    />
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleReachArea('check')}
                                        disabled={maintenancePosture}
                                    >
                                        리치 확인
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleReachArea('goto_ref_origin')}
                                        disabled={maintenancePosture}
                                    >
                                        원점 이동
                                    </Button>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">정비자세</TableCell>
                                <TableCell className="table-cell-body">
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMaintenancePosture('on')}
                                    >
                                        정비자세로
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleMaintenancePosture('off')}
                                    >
                                        홈으로
                                    </Button>
                                    <Typography style={{ textAlign: 'left' }}>
                                        현재 상태: {maintenancePosture ? '작업 실행 중...' : '작업 실행'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="table-cell-header">로봇종료</TableCell>
                                <TableCell className="table-cell-body">
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleTapbotStatus('on')}
                                    >
                                        로봇앱 구동
                                    </Button>
                                    <Button
                                        variant="contained"
                                        className="button-action"
                                        onClick={() => handleTapbotStatus('off')}
                                    >
                                        로봇앱 종료
                                    </Button>
                                    <Typography style={{ textAlign: 'left' }}>
                                        현재 상태: {tapbotStatus ? '로봇앱 실행 중...' : '로봇앱 종료'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    {/* <Toolbar className="toolbar-device-manager" style={{ justifyContent: 'flex-start' }}>
                        <Button variant="contained" className="button-save" onClick={handleSave}>
                            저장
                        </Button>
                    </Toolbar> */}
                </TableContainer>
            </Grid>
        </Container>
    );
}

export default DeviceManager;
