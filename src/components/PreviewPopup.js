import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, Button, TextField } from '@mui/material';
import WorkPieceDrawer from './WorkPieceDrawer';
import '../assets/styles/preview-popup.scss';
import { useTapbotContext } from '../context/TapbotContext';
import { getCurrentTime } from '../utils/time';
import { Logger } from '../utils/Logger';
import { toolToTap, toolToRadius, toolToColor } from '../utils/workManager';

const logger = new Logger('debug', false);
logger.setLevel('log');

const { ipcRenderer } = window.electron;

const PreviewPopup = ({ work = [], taps = [], open, onClose }) => {
    const [toolGroups, setToolGroups] = useState({});
    const [activeTool, setActiveTool] = useState(0);
    const [animationKey, setAnimationKey] = useState(0);
    const [allCircles, setAllCircles] = useState([]);
    const [checkWorkpiece, setCheckWorkpiece] = useState('on');

    const [tapInfo, setTapInfo] = useState({
        partSizeX: 480,
        partSizeY: 600,
        initialHeight: 5.0,
        partThickness: 1.6,
        chamferLength: 1.6,
        machiningAllowance: 1.6,
        tapSize: 'M3', // 기본값 설정
        rpmIndex: 11,
        checkWorkpiece: 'on',
    });

    const { isWorking, setIsWorking } = useTapbotContext();

    useEffect(() => {
        console.log('initialHeight', tapInfo.initialHeight);
        console.log('partThickness', tapInfo.partThickness);
        console.log('chamferLength', tapInfo.chamferLength);
        console.log('machiningAllowance', tapInfo.machiningAllowance);
        console.log('rpmIndex', tapInfo.rpmIndex);
    }, [tapInfo]);

    useEffect(() => {
        if (Array.isArray(work) && Array.isArray(taps) && taps.length > 0) {
            const groupedTools = {};
            const allCirclesArray = [];

            taps.forEach((tap) => {
                const tool = tap.t;
                const toolName = toolToTap[tool] || `Tool-${tool}`;
                const radius = toolToRadius[tool] / 2 || 2;
                const color = toolToColor[tool] || 'gray';

                const circle = { x: tap.x, y: tap.y, r: radius, color, tool };
                allCirclesArray.push(circle);

                if (!groupedTools[tool]) {
                    groupedTools[tool] = { toolName, circles: [] };
                }
                groupedTools[tool].circles.push(circle);
            });

            setToolGroups(groupedTools);
            setAllCircles(allCirclesArray);
            setActiveTool(Object.keys(groupedTools).length > 0 ? parseInt(Object.keys(groupedTools)[0], 10) : 0);
        }
    }, [work, taps]);

    const handleChange = (e) => {
        const { id, value } = e.target;

        const newValue = e.target.value;
        if (/^\d*\.?\d*$/.test(newValue)) {
            setTapInfo((prev) => ({
                ...prev,
                [id]: parseFloat(newValue),
            }));
        }
    };

    const handleRestart = () => {
        setAnimationKey(Date.now());
    };

    const handlePreview = async () => {
        let isSuccess = false;

        const filteredTaps = taps.filter((tap) => tap.t === activeTool);
        const foundWork = work.find((workItem) => {
            // toolName에서 숫자만 추출
            const match = workItem.toolName.match(/T(\d+)/);
            const toolNumber = match ? parseInt(match[1], 10) : null;

            // activeTool과 숫자 비교
            const isMatch = toolNumber === activeTool;

            return isMatch;
        });
        logger.log('##### foundWork:', foundWork);
        logger.log('##### activeTool:', activeTool);
        logger.log('##### tapInfo:', tapInfo);

        const commandRequest = {
            type: 'previewPosition',
            payload: {
                work: foundWork,
                taps: filteredTaps, // ✅ 선택된 툴만 포함
                tapInfo: tapInfo,
            },
        };

        const dataToSend = JSON.stringify(commandRequest);

        try {
            logger.log('Sending data to TCP server:', dataToSend);
            ipcRenderer.send('send-tcp-data', dataToSend);

            await new Promise((resolve, reject) => {
                ipcRenderer.once('send-tcp-data-response', (event, result) => {
                    if (result.success) {
                        logger.info('TCP 데이터 전송 성공:', result.response);
                        isSuccess = true;
                        setIsWorking(true);
                        resolve();
                    } else {
                        logger.error('TCP 데이터 전송 실패:', result.error);
                        reject(new Error(result.error));
                    }
                });
            });
        } catch (error) {
            logger.error('Error sending data to TCP server:', error.message);
            alert('데이터 전송 중 오류가 발생했습니다.');
        }
    };

    const handleWorkPlay = async () => {
        let isSuccess = false;

        const filteredTaps = taps.filter((tap) => tap.t === activeTool);
        const foundWork = work.find((workItem) => {
            const match = workItem.toolName.match(/T(\d+)/);
            const toolNumber = match ? parseInt(match[1], 10) : null;
            return toolNumber === activeTool;
        });

        logger.log('##### foundWork:', foundWork);
        logger.log('##### activeTool:', activeTool);

        tapInfo.checkWorkpiece = checkWorkpiece;

        logger.log('##### tapInfo:', tapInfo);

        const commandRequest = {
            type: 'tapping',
            payload: {
                taps: filteredTaps,
                tapInfo: tapInfo,
            },
        };

        const dataToSend = JSON.stringify(commandRequest);

        try {
            logger.log('Sending data to TCP server:', dataToSend);
            ipcRenderer.send('send-tcp-data', dataToSend);

            // 응답 대기
            await new Promise((resolve, reject) => {
                ipcRenderer.once('send-tcp-data-response', (event, result) => {
                    if (result.success) {
                        logger.debug('TCP 데이터 전송 성공:', result.response);
                        isSuccess = true;
                        setIsWorking(true);
                        setCheckWorkpiece('off');
                        resolve();
                    } else {
                        logger.error('TCP 데이터 전송 실패:', result.error);
                        reject(new Error(result.error));
                    }
                });
            });
        } catch (error) {
            logger.error('Error sending data to TCP server:', error.message);
            alert('데이터 전송 중 오류가 발생했습니다.');
        } finally {
            if (isSuccess) {
                const currentTime = getCurrentTime('LOCALE');
                // await handleCreateLog('P', work, currentTime); // 로그 관련 주석 유지
            }
        }
    };

    const handleClose = async () => {
        setCheckWorkpiece('on'); // 한번만 가공물 시작 위치 측정
        onClose();
    };

    const handleUpdateWork = async (updateFields, work, currentTime) => {
        // 업데이트가 유효할 때만 처리
        if (updateFields) {
            logger.log('## PreviePopup:handleUpdateWork', updateFields);
            // JSON 직렬화 가능성 확인
            try {
                JSON.stringify(updateFields);
            } catch (error) {
                logger.error('Invalid updateFields format:', error);
                return;
            }

            // IPC 호출
            try {
                const result = await ipcRenderer.invoke('update-work-fields', {
                    workId: work.workId,
                    updateFields: updateFields,
                });

                logger.log('Update result:', result);

                if (!result.success) {
                    logger.error('Update failed:', result.error);
                }
            } catch (error) {
                logger.error('IPC invoke failed:', error);
            }
        }
    };

    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason !== 'backdropClick') {
                    onClose();
                }
            }}
            maxWidth="lg" // xl → md → lg로 변경
            fullWidth
        >
            {isWorking && (
                <div className="working-overlay">
                    <div className="working-popup">🦾 로봇 작업 중...</div>
                </div>
            )}
            <DialogTitle>
                <div className="popup-header">
                    <span>탭핑 가공</span>
                    <div className="button-group">
                        <Button variant="contained" color="warning" onClick={handleRestart}>
                            다시보기
                        </Button>
                        <Button variant="contained" color="warning" onClick={handlePreview}>
                            위치확인 (로봇)
                        </Button>
                        <Button variant="contained" color="warning" onClick={handleWorkPlay}>
                            작업실행 (로봇)
                        </Button>
                        <Button variant="contained" onClick={handleClose}>
                            닫기
                        </Button>
                    </div>
                </div>
            </DialogTitle>

            <DialogContent>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <WorkPieceDrawer
                        key={animationKey}
                        circles={allCircles}
                        width={500}
                        height={600}
                        animationKey={animationKey}
                        work={work}
                        activeTool={activeTool}
                    />
                    <div>
                        {(Array.isArray(work) ? work : [])
                            .filter((w) => String(w.toolName).includes(`T${activeTool}`))
                            .map((w, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: '15px',
                                        border: '2px solid #ccc',
                                        borderRadius: '3px',
                                        marginTop: 'opx',
                                    }}
                                >
                                    {/* Tool 선택 버튼 */}
                                    <div
                                        style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}
                                    >
                                        {Object.keys(toolGroups).map((tool) => (
                                            <Button
                                                key={tool}
                                                variant={Number(activeTool) === Number(tool) ? 'contained' : 'outlined'}
                                                color="primary"
                                                style={{ margin: '5px' }}
                                                onClick={() => {
                                                    setActiveTool(Number(tool));
                                                }}
                                            >
                                                {toolGroups[tool].toolName}
                                            </Button>
                                        ))}
                                    </div>
                                    {/* TODO: "가공물 크기" --> TextField 제거해야 함.*/}
                                    <TextField
                                        id="partSize"
                                        label="가공물 크기 - Part Size"
                                        fullWidth
                                        value={`${tapInfo.partSizeX}mm x ${tapInfo.partSizeY}mm`}
                                        margin="dense"
                                    />

                                    <TextField
                                        id="partThickness"
                                        label="가공물 두께 - Part Thickness"
                                        fullWidth
                                        value={tapInfo.partThickness}
                                        onChange={handleChange}
                                        margin="dense"
                                        type="number"
                                    />
                                    <TextField
                                        id="initialHeight"
                                        label="시작 위치(높이) - Initial Height"
                                        fullWidth
                                        value={tapInfo.initialHeight}
                                        onChange={handleChange}
                                        margin="dense"
                                        type="number"
                                    />
                                    <TextField
                                        id="chamferLength"
                                        label="챔퍼 길이 - Chamfer Length"
                                        fullWidth
                                        value={tapInfo.chamferLength}
                                        onChange={handleChange}
                                        margin="dense"
                                        type="number"
                                    />
                                    <TextField
                                        id="machiningAllowance"
                                        label="가공 여유 - Machining Allowance"
                                        fullWidth
                                        value={tapInfo.machiningAllowance}
                                        onChange={handleChange}
                                        margin="dense"
                                        type="number"
                                    />
                                    <TextField
                                        id="rpmIndex"
                                        label="모터 속도 - rpmIndex"
                                        fullWidth
                                        value={tapInfo.rpmIndex}
                                        onChange={handleChange}
                                        margin="dense"
                                        type="number"
                                    />
                                </div>
                            ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PreviewPopup;
