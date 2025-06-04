import React, { useState, useEffect } from 'react';
import { Grid, TableContainer, Table, TableBody, TableRow, TableCell, Toolbar, Button, TextField } from '@mui/material';
import '../../assets/styles/work-detail-styles.scss';
import { getCurrentTime } from '../../utils/time';

import SimulationPopup from './SimulationPopup';
import { useTapbotContext } from '../../context/TapbotContext'; // Context 훅 추가

import { Logger } from '../../utils/Logger';
const logger = new Logger('debug', false);

const { ipcRenderer } = window.electron;

const WorkDetail = ({ work, readOnly, OnClose, OnSave, OnUpdateWork }) => {
    const [detailWork, setDetailWork] = useState(work); // ✅ work 객체를 한 번에 관리하는 상태 생성
    const [isLoading, setIsLoading] = useState(false); // 로딩 상태 추가
    const [taps, setTaps] = useState(Array.isArray(work.taps) ? work.taps : []);
    const [simulationOpen, setSimulationOpen] = useState(false);

    const { isWorking, setIsWorking, setActiveScreen } = useTapbotContext(); // 로봇 작업중 상태 및 함수 가져오기

    useEffect(() => {
        logger.log('🔄 isWorking 상태 변경됨:', isWorking);
    }, [isWorking]);

    useEffect(() => {
        setActiveScreen('WorkDetail');

        return () => {
            console.log('🗑️ WorkDetail 언마운트됨!');
        };
    }, [setActiveScreen]);

    useEffect(() => {
        if (work.workId) {
            loadTappingList(work.workId);
        }
    }, [work.workId]);

    /*
    useEffect(() => {
        setDetailWork(work);
    }, [work]);
    */

    const loadTappingList = async (workId) => {
        try {
            const result = await ipcRenderer.invoke('fetch-tapping', workId);
            if (result.success && Array.isArray(result.data)) {
                setTaps(result.data);
            } else {
                setTaps([]);
            }
        } catch (error) {
            logger.error('Error loading tapping list:', error);
            setTaps([]);
        }
    };

    const handleChange = (e) => {
        const { id, value } = e.target;
        setDetailWork((prev) => ({ ...prev, [id]: value }));
    };

    const handleGoList = () => {
        OnClose(detailWork);
    };

    const handleSaveWork = () => {
        logger.log('Saving Work:', detailWork);
        OnSave(detailWork);
    };

    const handleSimulation = async () => {
        const currentTime = getCurrentTime('LOCALE');

        logger.log('handleSimulation:', currentTime);

        /*
        /// tblLog 추가
        const kind = 'S';
        await handleCreateLog(kind, work, currentTime);
        */

        /// tblWork 업데이트
        detailWork.simulationCount += 1;
        detailWork.lastSimulationDate = currentTime;
        const updateFields = {
            lastSimulationDate: detailWork.lastSimulationDate,
            simulationCount: detailWork.simulationCount,
        };

        await handleUpdateWork(updateFields, detailWork, detailWork.lastSimulationDate);

        // 상위 컴포넌트(Home, WorkManager)로 상태 갱신 요청
        OnUpdateWork({
            ...detailWork,
            lastSimulationDate: detailWork.lastSimulationDate,
            simulationCount: detailWork.simulationCount,
        });

        setSimulationOpen(true); // 팝업 열기
    };

    const handleCloseSimulation = () => {
        setSimulationOpen(false); // 팝업 닫기
    };

    /// tblLog 추가
    const handleCreateLog = async (kind, work, currentTime) => {
        const logId = `LOG_${currentTime}`;

        const newLog = {
            logId: logId,
            workId: work.workId,
            kind: kind,
            writeDate: currentTime,
        };

        const result = await ipcRenderer.invoke('create-log', newLog);
        logger.log('### WorkDetail:handleCreateLog:invoke:create-log:', result);
        if (!result.success) {
            logger.error('### handleCreateLog:handleCreateLog:Error:', result.error);
            return;
        }
    };

    const handleUpdateWork = async (updateFields, work, currentTime) => {
        // 업데이트가 유효할 때만 처리
        if (updateFields) {
            logger.log('## WorkDetail:handleUpdateWork', updateFields);
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

    const handleWorkPlay = async () => {
        let isSuccess = false; // TCP 통신 성공 여부 플래그

        const tapInfo = {
            partSizeX: detailWork.partSizeX,
            partSizeY: detailWork.partSizeY,
            initialHeight: detailWork.initialHeight, // 시작 위치 (높이) - initialHeight
            partThickness: detailWork.partThickness, // 가공물 두께
            chamferLength: detailWork.chamferLength, // 챔퍼 길이
            machiningAllowance: detailWork.machiningAllowance, // 추가 탭 가공 여유 ==> 실제 가공되는 깊이 = partThickness + chamferLength + machiningAllowance
            tapSize: 'M8', // TODO: 작업상세 화면에서 수정하거나 Tool 정보로 바로 지정되도록 수정 필요!!
            rpmIndex: detailWork.rpmIndex,
            checkWorkpiece: 'on',
        };

        const commandRequest = {
            type: 'tapping',
            payload: {
                work: detailWork,
                taps: taps,
                tapInfo: tapInfo,
            },
        };

        // const jsonString = JSON.stringify(commandRequest);
        // const byteLength = new TextEncoder().encode(jsonString).length;
        // const dataToSend = `LEN:${byteLength}\n${jsonString}`;
        const dataToSend = JSON.stringify(commandRequest);

        try {
            logger.trace('Sending data to TCP server:', dataToSend);
            ipcRenderer.send('send-tcp-data', dataToSend);

            // 🚀 Promise를 사용하여 응답을 기다림
            await new Promise((resolve, reject) => {
                ipcRenderer.once('send-tcp-data-response', (event, result) => {
                    if (result.success) {
                        logger.debug('TCP 데이터 전송 성공:', result.response);
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

                // /// tblLog 추가: TODO 로그 생성하면서 에러가 나는 것으로 확인됨 .!!! 추후 수정
                // const kind = 'P';
                // await handleCreateLog(kind, work, currentTime);

                /// tblWork 업데이트
                detailWork.playCount += 1;
                detailWork.lastPlayDate = currentTime;
                const updateFields = {
                    lastPlayDate: detailWork.lastPlayDate,
                    playCount: detailWork.playCount,
                };

                await handleUpdateWork(updateFields, detailWork, currentTime);

                // 화면에 즉시 반영
                //?? setWorkName(work.workName); // 필요시 workName도 업데이트

                // 상위 컴포넌트(Home, WorkManager)로 상태 갱신 요청
                OnUpdateWork({
                    ...detailWork,
                    playCount: detailWork.playCount,
                    lastPlayDate: detailWork.lastPlayDate, // 마지막 실행일시 갱신
                });
            }
        }
    };

    const handleShowManual = () => {
        logger.log('#### handleShowManual...');
        alert('현재 미지원 기능입니다.');
    };

    const handleWorkHistroy = () => {
        logger.log('#### handleWorkHistroy...');
        alert('현재 미지원 기능입니다.');
    };

    return (
        <div className="work-detail">
            {/* ✅ 화면 전체 팝업 */}
            {isWorking && (
                <div className="working-overlay">
                    <div className="working-popup">🦾로봇 작업 중...</div>
                </div>
            )}
            <h2>{readOnly ? '' : '작업 상세 관리'}</h2>
            <Grid container className="grid-container">
                <Grid item xs={12}>
                    <TableContainer className="table-container">
                        <Table className="styled-table">
                            <TableBody>
                                <TableRow>
                                    <TableCell className="table-cell-header">작업명</TableCell>
                                    {readOnly ? (
                                        <TableCell className="table-cell-data">{detailWork.workName}</TableCell>
                                    ) : (
                                        <TableCell className="table-cell-data">
                                            <TextField
                                                id="workName"
                                                value={detailWork.workName}
                                                onChange={handleChange}
                                                className="text-field"
                                            />
                                        </TableCell>
                                    )}
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">작업 실행 정보</TableCell>
                                    <TableCell className="table-cell-data">
                                        실행 횟수: {detailWork.playCount} / 최종 실행일시:{' '}
                                        {detailWork.lastPlayDate || 'N/A'}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">시뮬레이션 실행 정보</TableCell>
                                    <TableCell className="table-cell-data">
                                        실행 횟수: {detailWork.simulationCount} / 최종 실행일시:
                                        {detailWork.lastSimulationDate || 'N/A'}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">가공물 크기</TableCell>
                                    <TableCell className="table-cell-data">
                                        {detailWork.partSizeX}mm x {detailWork.partSizeY}mm
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">도구 정보</TableCell>
                                    <TableCell className="table-cell-data">{detailWork.toolName}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">가공물 두께</TableCell>
                                    {readOnly ? (
                                        <TableCell className="table-cell-data">{detailWork.partThickness} mm</TableCell>
                                    ) : (
                                        <TableCell className="table-cell-data">
                                            <TextField
                                                id="partThickness"
                                                value={detailWork.partThickness}
                                                onChange={handleChange}
                                                className="text-field"
                                            />
                                            mm
                                        </TableCell>
                                    )}
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">시작 위치 (높이)</TableCell>
                                    {readOnly ? (
                                        <TableCell className="table-cell-data">{detailWork.initialHeight} mm</TableCell>
                                    ) : (
                                        <TableCell className="table-cell-data">
                                            <TextField
                                                id="initialHeight"
                                                value={detailWork.initialHeight}
                                                onChange={handleChange}
                                                className="text-field"
                                            />
                                            mm
                                        </TableCell>
                                    )}
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">챔퍼 길이</TableCell>
                                    {readOnly ? (
                                        <TableCell className="table-cell-data">{detailWork.chamferLength} mm</TableCell>
                                    ) : (
                                        <TableCell className="table-cell-data">
                                            <TextField
                                                id="chamferLength"
                                                value={detailWork.chamferLength}
                                                onChange={handleChange}
                                                className="text-field"
                                            />
                                            mm
                                        </TableCell>
                                    )}
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">가공 여유</TableCell>
                                    {readOnly ? (
                                        <TableCell className="table-cell-data">
                                            {detailWork.machiningAllowance} mm
                                        </TableCell>
                                    ) : (
                                        <TableCell className="table-cell-data">
                                            <TextField
                                                id="machiningAllowance"
                                                value={detailWork.machiningAllowance}
                                                onChange={handleChange}
                                                className="text-field"
                                            />
                                            mm
                                        </TableCell>
                                    )}
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">RPM 단계</TableCell>
                                    {readOnly ? (
                                        <TableCell className="table-cell-data">{detailWork.rpmIndex} 단계</TableCell>
                                    ) : (
                                        <TableCell className="table-cell-data">
                                            <TextField
                                                id="rpmIndex"
                                                value={detailWork.rpmIndex}
                                                onChange={handleChange}
                                                className="text-field"
                                            />
                                            단계
                                        </TableCell>
                                    )}
                                </TableRow>
                                {taps.length > 0 ? (
                                    taps.map((data, index) => (
                                        <TableRow key={index}>
                                            {index === 0 && (
                                                <TableCell className="table-cell-header" rowSpan={taps.length}>
                                                    탭 좌표 정보 (mm)
                                                </TableCell>
                                            )}
                                            <TableCell className="table-cell-data">
                                                No.{index + 1} X: {data.x}, Y: {data.y}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell className="table-cell-data" colSpan={2}>
                                            탭 정보가 없습니다.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
            </Grid>
            {/* Footer 영역 - 화면 하단에 고정 */}
            <div className="footer">
                {readOnly ? (
                    <>
                        <Button variant="contained" onClick={handleSimulation} className="footer-button">
                            시뮬레이션
                        </Button>
                        <Button variant="contained" onClick={handleWorkPlay} className="footer-button">
                            작업실행
                        </Button>
                        <Button variant="contained" onClick={handleShowManual} className="footer-button">
                            사용설명
                        </Button>
                        <Button variant="contained" onClick={handleWorkHistroy} className="footer-button">
                            작업이력
                        </Button>
                        {/* SimulationPopup 팝업 추가 */}
                        <SimulationPopup
                            work={work}
                            taps={taps}
                            open={simulationOpen}
                            onClose={handleCloseSimulation}
                        />
                    </>
                ) : (
                    <>
                        <Button variant="contained" onClick={handleGoList} className="footer-button">
                            목록
                        </Button>
                        <Button variant="contained" onClick={handleSimulation} className="footer-button">
                            시뮬레이션
                        </Button>
                        <Button variant="contained" onClick={handleWorkPlay} className="footer-button">
                            작업실행
                        </Button>
                        <Button variant="contained" onClick={handleSaveWork} className="footer-button">
                            저장
                        </Button>
                        <Button variant="contained" onClick={handleWorkHistroy} className="footer-button">
                            작업이력
                        </Button>
                        {/* SimulationPopup 팝업 추가 */}
                        <SimulationPopup
                            work={work}
                            taps={taps}
                            open={simulationOpen}
                            onClose={handleCloseSimulation}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default WorkDetail;
