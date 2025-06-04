import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, Button } from '@mui/material';
import WorkPieceDrawer from '../WorkPieceDrawer';
import '../../assets/styles/simulation-popup.scss'; // SCSS 스타일 파일 추가

import { useTapbotContext } from '../../context/TapbotContext'; // Context 훅 추가

import { getCurrentTime } from '../../utils/time';

import { Logger } from '../../utils/Logger';
const logger = new Logger('debug', false);

const { ipcRenderer } = window.electron;

const SimulationPopup = ({ work, taps, open, onClose }) => {
    const [circles, setCircles] = useState([]);
    const [animationKey, setAnimationKey] = useState(0); // Key to reset animation
    const [toolTitle, setToolTitle] = useState(''); // 툴 정보 저장

    const { isWorking, setIsWorking } = useTapbotContext(); // 로봇 작업중 상태 및 함수 가져오기

    useEffect(() => {
        if (work && taps) {
            const toolToTap = {
                266: 'M3', // M3 - Ø2.5
                212: 'M4', // M4 - Ø3.3
                239: 'M5', // M5 - Ø4.3
                349: 'M6', // M6 - Ø5.0
                253: 'M8', // M8 - Ø7.0
            };

            const toolToRadius = {
                266: 2.5, // M3 - Ø2.5
                212: 3.3, // M4 - Ø3.3
                239: 4.3, // M5 - Ø4.3
                349: 5.0, // M6 - Ø5.0
                253: 7.0, // M8 - Ø7.0
            };

            const toolToColor = {
                266: 'red',
                212: 'orange',
                239: 'green',
                349: 'purple',
                253: 'blue',
            };

            const usedTools = [...new Set(taps.map((tap) => tap.t))]; // 중복 제거된 사용된 툴 목록
            const toolNames = usedTools
                .map((tool) => toolToTap[tool]) // toolToTap에서 매칭된 이름 가져오기
                .filter(Boolean)
                .join(', '); // 예: "M3, M5"

            setToolTitle(toolNames ? `사용된 툴: ${toolNames}` : '');
            // logger.log('### SimulationPopup.', work);

            const generatedCircles = taps.map((tap, index) => {
                const radius = toolToRadius[tap.t] / 2 || 2; // Default radius: 2
                const color = toolToColor[tap.t] || `hsl(${(index * 60) % 360}, 70%, 50%)`;
                //logger.log('### color... t ', color, tap.t);
                return {
                    x: tap.x,
                    y: tap.y,
                    r: radius,
                    color,
                };
            });

            setCircles(generatedCircles);
        }
    }, [work, taps]);

    const handleRestart = () => {
        setAnimationKey((prev) => prev + 1); // Increment key to restart animation
    };

    const handlePreview = async () => {
        let isSuccess = false; // TCP 통신 성공 여부 플래그

        const tapInfo = {
            partSizeX: work.partSizeX,
            partSizeY: work.partSizeY,
            initialHeight: work.initialHeight, // 시작 위치 (높이) - initialHeight
            partThickness: work.partThickness, // 가공물 두께
            chamferLength: work.chamferLength, // 챔퍼 길이
            machiningAllowance: work.machiningAllowance, // 추가 탭 가공 깊이 ==> 실제 가공되는 깊이 = partThickness + chamferLength + machiningAllowance
            tapSize: 'M8', // TODO: 작업상세 화면에서 수정하거나 Tool 정보로 바로 지정되도록 수정 필요!!
            rpmIndex: work.rpmIndex,
            checkWorkpiece: 'on',
        };

        const commandRequest = {
            type: 'previewPosition',
            payload: {
                work: work,
                taps: taps,
                tapInfo: tapInfo,
            },
        };

        // const jsonString = JSON.stringify(commandRequest);
        // const byteLength = new TextEncoder().encode(jsonString).length;
        // const dataToSend = `LEN:${byteLength}\n${jsonString}`;

        const dataToSend = JSON.stringify(commandRequest);

        try {
            logger.log('Sending data to TCP server:', dataToSend);
            ipcRenderer.send('send-tcp-data', dataToSend);

            // 🚀 Promise를 사용하여 응답을 기다림
            await new Promise((resolve, reject) => {
                ipcRenderer.once('send-tcp-data-response', (event, result) => {
                    if (result.success) {
                        logger.info('TCP 데이터 전송 성공:', result.response);
                        isSuccess = true; // 성공 플래그 설정
                        setIsWorking(true);
                        resolve(); // ✅ Promise를 정상 종료
                    } else {
                        logger.error('TCP 데이터 전송 실패:', result.error);
                        reject(new Error(result.error)); // ✅ 오류 발생 시 catch로 이동
                    }
                });
            });
        } catch (error) {
            logger.error('Error sending data to TCP server:', error.message);
            alert('데이터 전송 중 오류가 발생했습니다.');
        } finally {
            if (isSuccess) {
                // TCP 통신이 성공했을 경우에만 실행
                const currentTime = getCurrentTime('LOCALE');

                // 상위 컴포넌트(Home, WorkManager)로 상태 갱신 요청
                /*
                    OnUpdateWork({
                        ...work,
                        playCount: work.playCount,
                        lastPlayDate: currentTime, // 마지막 실행일시 갱신
                    });
                    */
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
            maxWidth="lg"
        >
            {/* ✅ 화면 전체 팝업 */}
            {isWorking && (
                <div className="working-overlay">
                    <div className="working-popup">🦾로봇 작업 중...</div>
                </div>
            )}
            <DialogTitle>
                <div className="popup-header">
                    <span>{toolTitle}</span>
                    <div className="button-group">
                        <Button variant="contained" onClick={handleRestart}>
                            다시보기
                        </Button>
                        <Button variant="contained" onClick={handlePreview}>
                            위치확인 (로봇)
                        </Button>
                        <Button variant="contained" onClick={onClose}>
                            닫기
                        </Button>
                    </div>
                </div>
            </DialogTitle>
            <DialogContent>
                <WorkPieceDrawer
                    circles={circles}
                    width={500} // Canvas width
                    height={500} // Canvas height
                    animationKey={animationKey} // Pass animation key to CircleDrawer
                    work={work}
                    delay={500} // 딜레이 시간
                    blinkSpeed={125} // 🔹 깜박이는 속도 (기본 100ms)
                    moveSpeed={250} // 🔹 다음 원으로 이동하는 속도 (기본 200ms)
                />
            </DialogContent>
        </Dialog>
    );
};

export default SimulationPopup;
