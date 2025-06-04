import React, { useState, useEffect } from 'react';
import { Container, Grid, TextField, Button, Typography } from '@mui/material';

import { useTapbotContext } from '../../context/TapbotContext';

const { ipcRenderer } = window.electron;

const ControllerTCP = () => {
    const [ip, setIp] = useState('192.168.137.201');
    const [port, setPort] = useState(20002);
    const [status, setStatus] = useState('Disconnected');
    const [log, setLog] = useState([]);
    const [rpm, setRpm] = useState(980);
    const [maxRpm, setMaxRpm] = useState(980);
    const [direction, setDirection] = useState('CW');
    const [fanState, setFanState] = useState('OFF');
    const [airState, setAirState] = useState('OFF');
    const [oilState, setOilState] = useState('OFF');

    const { setActiveScreen } = useTapbotContext();

    useEffect(() => {
        setActiveScreen('ControllerTCP');

        return () => {
            // console.log('🗑️ ControllerTCP 언마운트됨!');
        };
    }, [setActiveScreen]);

    useEffect(() => {
        ipcRenderer.on('server-log', (_, message) => {
            console.log('Received Log:', message); // 디버깅용 콘솔 출력
            setLog((prev) => [...prev, message]);
        });

        ipcRenderer.on('tcp-data-response', (_, response) => {
            console.log('Received TCP Response:', response); // 응답 디버깅

            if (response.includes('ACK')) {
                setLog((prev) => [...prev, `[ACK Received] ${response.trim()}`]);
            } else {
                setLog((prev) => [...prev, `[Response] ${response.trim()}`]);
            }
        });

        return () => {
            ipcRenderer.removeAllListeners('server-log');
            ipcRenderer.removeAllListeners('tcp-data-response');
        };
    }, []);

    const connectToController = () => {
        ipcRenderer.send('tcp-connect', { ip, port });
        ipcRenderer.once('tcp-connect-response', (_, res) => {
            if (res.success) {
                setStatus('Connected');
            } else {
                setStatus('Connection Failed');
            }
        });
    };

    const disconnectFromController = () => {
        ipcRenderer.send('tcp-disconnect');
        ipcRenderer.once('tcp-disconnect-response', () => {
            setStatus('Disconnected');
        });
    };

    const sendCommand = (command) => {
        ipcRenderer.send('send-tcp-data', command);
        ipcRenderer.once('send-tcp-data-response', (_, res) => {
            if (res.success) {
                setLog((prev) => [...prev, `[Sent] ${command}`]);
            } else {
                setLog((prev) => [...prev, `[Sent] ${command} -> [Error] ${res.error}`]);
            }
        });
    };

    const toggleFan = () => {
        const newState = fanState === 'ON' ? 'OFF' : 'ON';
        sendCommand(`FAN;${newState}`);
        setFanState(newState);
    };

    const toggleAir = () => {
        const newState = airState === 'ON' ? 'OFF' : 'ON';
        sendCommand(`AIR;${newState}`);
        setAirState(newState);
    };

    const toggleOil = () => {
        const newState = oilState === 'ON' ? 'OFF' : 'ON';
        sendCommand(`OIL;${newState}`);
        setOilState(newState);
    };

    return (
        <Container maxWidth="sm">
            <Typography variant="h4" gutterBottom>
                Controller - TCP
            </Typography>

            {/* 연결 상태 */}
            <Typography variant="h6" color={status === 'Connected' ? 'green' : 'red'}>
                Status: {status}
            </Typography>

            <Grid container spacing={2}>
                {/* IP & Port 설정 */}
                <Grid item xs={6}>
                    <TextField fullWidth label="IP Address" value={ip} onChange={(e) => setIp(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                    <TextField fullWidth label="Port" value={port} onChange={(e) => setPort(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                    {status === 'Connected' ? (
                        <Button variant="contained" color="secondary" onClick={disconnectFromController}>
                            연결해제
                        </Button>
                    ) : (
                        <Button variant="contained" color="primary" onClick={connectToController}>
                            연결
                        </Button>
                    )}
                </Grid>

                {/* 모터 속도 설정 */}
                <Grid item xs={12}>
                    <TextField
                        type="number"
                        label="RPM"
                        value={rpm}
                        onChange={(e) => setRpm(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => sendCommand(`SPD;${rpm}`)}>
                        RPM 설정
                    </Button>
                </Grid>
                {/* 모터 최대속도 설정 */}
                <Grid item xs={12}>
                    <TextField
                        type="number"
                        label="MaxRPM"
                        value={maxRpm}
                        onChange={(e) => setMaxRpm(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => sendCommand(`MAXSPD;${maxRpm}`)}>
                        MaxRPM 설정
                    </Button>
                </Grid>

                {/* 모터 방향 설정 */}
                <Grid item xs={12}>
                    <TextField
                        label="모터방향 (CW/CCW)"
                        value={direction}
                        onChange={(e) => setDirection(e.target.value)}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => sendCommand(`DIR;${direction}`)}>
                        모터방향 설정 (CW/CCW)
                    </Button>
                </Grid>

                {/* 모터 시작/정지 */}
                <Grid item xs={12}>
                    <Button variant="contained" color="success" onClick={() => sendCommand('RUN;')}>
                        Run Motor
                    </Button>
                    <Button variant="contained" color="error" onClick={() => sendCommand('STOP;')}>
                        Stop Motor
                    </Button>
                </Grid>

                {/* 컨트롤러 장치 제어 (Fan, Air, Oil) */}
                <Grid item xs={12}>
                    <Button variant="contained" onClick={toggleFan}>
                        Fan {fanState === 'ON' ? 'Off' : 'On'}
                    </Button>
                    <Button variant="contained" onClick={toggleAir}>
                        Air {airState === 'ON' ? 'Off' : 'On'}
                    </Button>
                    <Button variant="contained" onClick={toggleOil}>
                        Oil {oilState === 'ON' ? 'Off' : 'On'}
                    </Button>
                </Grid>
                <Grid item xs={12}>
                    <Button variant="contained" onClick={() => sendCommand(`STAT;`)}>
                        장치 상태 요청
                    </Button>
                </Grid>

                {/* 로그 출력 */}
                <Grid item xs={12}>
                    <Typography variant="h6">Logs</Typography>
                    <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f4f4f4', padding: '10px' }}>
                        {log.join('\n')}
                    </pre>
                </Grid>
            </Grid>
        </Container>
    );
};

export default ControllerTCP;
