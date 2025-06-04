import React, { useState, useEffect } from 'react';
import { Container, Grid, TextField, Button, Typography } from '@mui/material';

const { ipcRenderer } = window.electron;

const ControllerRS232 = () => {
    const [port, setPort] = useState('/dev/ttyUSB0');
    const [baudRate, setBaudRate] = useState(9600);
    const [status, setStatus] = useState('Disconnected');
    const [log, setLog] = useState([]);
    const [rpm, setRpm] = useState(980);
    const [maxRpm, setMaxRpm] = useState(980);
    const [direction, setDirection] = useState(0x00);
    const [fanState, setFanState] = useState(0x00);
    const [airState, setAirState] = useState(0x00);
    const [oilState, setOilState] = useState(0x00);

    useEffect(() => {
        ipcRenderer.on('serial-log', (_, message) => {
            setLog((prev) => [...prev, message]);
        });

        return () => {
            ipcRenderer.removeAllListeners('serial-log');
        };
    }, []);

    const calculateChecksum = (data) => {
        return data.reduce((acc, byte) => acc ^ byte, 0xaa);
    };

    const sendCommand = (commandCode, data = []) => {
        const packet = [0xaa, commandCode, ...data];
        packet.push(calculateChecksum(packet));
        ipcRenderer.send('send-serial-data', packet);
        setLog((prev) => [...prev, `[Sent] ${packet.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`]);
    };

    const connectToController = () => {
        ipcRenderer.send('serial-connect', { port, baudRate });
        ipcRenderer.once('serial-connect-response', (_, res) => {
            setStatus(res.success ? 'Connected' : 'Connection Failed');
        });
    };

    const disconnectFromController = () => {
        ipcRenderer.send('serial-disconnect');
        ipcRenderer.once('serial-disconnect-response', () => {
            setStatus('Disconnected');
        });
    };

    return (
        <Container maxWidth="sm">
            <Typography variant="h4" gutterBottom>
                Controller - RS232
            </Typography>
            <Typography variant="h6" color={status === 'Connected' ? 'green' : 'red'}>
                Status: {status}
            </Typography>

            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <TextField fullWidth label="Serial Port" value={port} onChange={(e) => setPort(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        fullWidth
                        label="Baud Rate"
                        value={baudRate}
                        onChange={(e) => setBaudRate(e.target.value)}
                    />
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

                <Grid item xs={12}>
                    <TextField
                        type="number"
                        label="RPM"
                        value={rpm}
                        onChange={(e) => setRpm(Number(e.target.value))}
                        fullWidth
                    />
                    <Button variant="contained" onClick={() => sendCommand(0x01, [(rpm >> 8) & 0xff, rpm & 0xff])}>
                        RPM 설정
                    </Button>
                </Grid>

                <Grid item xs={12}>
                    <Button variant="contained" onClick={() => sendCommand(0x02, [direction])}>
                        모터 방향 설정
                    </Button>
                    <Button variant="contained" color="error" onClick={() => sendCommand(0x03)}>
                        비상 정지
                    </Button>
                </Grid>

                <Grid item xs={12}>
                    <Button variant="contained" onClick={() => sendCommand(0x05, [fanState === 0x00 ? 0x01 : 0x00])}>
                        Fan {fanState === 0x00 ? 'On' : 'Off'}
                    </Button>
                    <Button variant="contained" onClick={() => sendCommand(0x06, [airState === 0x00 ? 0x01 : 0x00])}>
                        Air {airState === 0x00 ? 'On' : 'Off'}
                    </Button>
                    <Button variant="contained" onClick={() => sendCommand(0x07, [oilState === 0x00 ? 0x01 : 0x00])}>
                        Oil {oilState === 0x00 ? 'On' : 'Off'}
                    </Button>
                </Grid>

                <Grid item xs={12}>
                    <Button variant="contained" onClick={() => sendCommand(0x08)}>
                        장치 상태 요청
                    </Button>
                </Grid>

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

export default ControllerRS232;
