import React, { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import WorkDetail from './WorkDetail';
import WorkList from './WorkList';
import DeletedWorkList from './DeletedWorkList';
import { useTapbotContext } from '../../context/TapbotContext';

import { parseGCode, extractTappingInfo } from '../../utils/gcode';
import { getCurrentTime } from '../../utils/time';
import { Logger } from '../../utils/Logger';
import { generateWorkId, getToolName } from '../../utils/workManager';

const logger = new Logger('debug', false);
logger.setLevel('debug');

const { ipcRenderer } = window.electron;

const WorkManager = () => {
    const [works, setWorks] = useState([]); // 작업 리스트
    const [activeWorkId, setActiveWorkId] = useState(null); // 활성화된 작업 ID
    const [detailedWork, setDetailedWork] = useState(null); // 세부 작업
    const [deletedWorks, setDeletedWorks] = useState([]);
    const [showDeletedList, setShowDeletedList] = useState(false);

    const { activeWork, setActiveWork, setActiveScreen } = useTapbotContext();

    useEffect(() => {
        setActiveScreen('WorkManager');

        return () => {
            // console.log('🗑️ WorkManager 언마운트됨!');
        };
    }, [setActiveScreen]);

    // useEffect(() => {
    //     logger.log('#### works updated:', works);
    // }, [works]); // 👈 works 상태가 바뀔 때 로그 확인

    useEffect(() => {
        loadWorkList();
    }, []);

    // selectedWork 상태 변경 시 로그 출력
    useEffect(() => {
        logger.trace('#### WorkManager:useEffect activeWork:', activeWork);
    }, [activeWork]);

    // WorkList에서 작업이 선택되면 호출되는 Callback 함수
    // Detail 화면으로 이동할 수 있도록 관련 설정을 진행하고, useActiveWork를 통해서 Context로 Active Work 설정..
    const handleSelectWork = (work) => {
        logger.trace('\n#### WorkManager:handleSelectWork work:', work);

        setDetailedWork(work);
        setActiveWorkId(work.workId); // 활성화된 작업 ID 설정
        //onSelectWork(work); // 선택된 작업을 상위 컴포넌트로 전달
        setActiveWork(work);
    };

    const handleCloseDetail = (updatedWork) => {
        logger.log('#### WorkManager:handleCloseDetail updatedWork:', updatedWork);
        if (updatedWork) {
            // 수정된 작업 정보를 반영
            setWorks((prevWorks) => prevWorks.map((work) => (work.workId === updatedWork.workId ? updatedWork : work)));
        }
        setDetailedWork(null); // 상세 작업 화면 닫기
    };

    const handleUpdateDetail = (updatedWork) => {
        if (updatedWork) {
            // 수정된 작업 정보를 반영
            setWorks((prevWorks) => prevWorks.map((work) => (work.workId === updatedWork.workId ? updatedWork : work)));
        }
    };

    const toggleDeletedList = () => {
        setShowDeletedList((prev) => !prev);
        if (!showDeletedList) {
            loadDeletedWorkList();
        } else {
            loadWorkList();
        }
    };

    const loadWorkList = async () => {
        try {
            const result = await ipcRenderer.invoke('fetch-work', {
                isDelete: 'F',
            });

            if (result.success && Array.isArray(result.data)) {
                setWorks(result.data);

                logger.log('##### works', works);

                // isActivation이 'T'인 작업을 찾아 활성화
                const activeWorkItem = result.data.find((work) => work.isActivation === 'T');
                if (activeWorkItem) {
                    setActiveWork(activeWorkItem);
                    setActiveWorkId(activeWorkItem.workId);
                }
            } else {
                setWorks([]); // 데이터가 없으면 빈 배열로 초기화
            }
        } catch (error) {
            logger.error('Error loading work list:', error);
            setWorks([]); // 에러 발생 시 빈 배열로 초기화
        }
    };

    const loadDeletedWorkList = async () => {
        try {
            const result = await ipcRenderer.invoke('fetch-work', {
                isDelete: 'T',
            });

            if (result.success && Array.isArray(result.data)) {
                setDeletedWorks(result.data);
            } else {
                setDeletedWorks([]); // 데이터가 없으면 빈 배열로 초기화
            }
        } catch (error) {
            logger.error('Error loadDeletedWorkList:', error);
        }
    };

    const handleLoadFile = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const gcode = e.target.result;
                const parsedData = parseGCode(gcode);
                const tapData = extractTappingInfo(parsedData);
                logger.log('### WorkManager:handleLoadFile.tapData: ', tapData);

                if (tapData.errors && tapData.errors.length > 0) {
                    const errorCode = tapData.errors[0].errorCode;

                    if (errorCode === 0) {
                        logger.log('오류 없음. 데이터 처리 진행.');
                        await insertWork(tapData, file.name); // 파일 이름 전달
                    } else {
                        logger.error('G-code 처리 오류:', tapData.errors[0].description);
                    }
                }
            };

            reader.onerror = (e) => {
                logger.error('Error reading file:', e);
            };

            reader.readAsText(file);
        };

        input.click();
    };

    const insertWork = async (tapData, fileName) => {
        const currentTime = getCurrentTime('LOCALE');
        const infoCount = tapData.info.length;
        const workCount = tapData.taps.length;
        let tmpworkName = '';
        let partSizeX = 0;
        let partSizeY = 0;

        for (let i = 0; i < infoCount; i++) {
            const infoKey = tapData.info[i].key;
            if (infoKey === 'NAME') {
                tmpworkName = tapData.info[i].value;
            } else if (infoKey === 'PART-SIZE') {
                partSizeX = tapData.info[i].x;
                partSizeY = tapData.info[i].y;
            }
        }

        for (let i = 0; i < workCount; i++) {
            const toolNo = tapData.taps[i].t;
            const toolName = getToolName(toolNo);
            const taps = tapData.taps[i].coords;
            const tappingCount = taps.length;
            const workId = generateWorkId(fileName, toolNo, currentTime);
            const workFileName = fileName.replace(/\.[^/.]+$/, ''); // 확장자 제거한 파일 이름

            // 기본값 설정
            // TODO: default 설정 DB에서 가져오는 기능 적용 필요.!!!
            const partThickness = 3.0;
            const initialHeight = 5.0;
            const chamferLength = 4.0;
            const machiningAllowance = 3.0;
            const rpmIndex = 10;

            if (tappingCount === 0) continue;

            const newWork = {
                workId,
                workFileName: workFileName,
                //workName: `${tmpworkName}_${workFileName}_T${toolName}_${tappingCount}`,
                //workName: `${tmpworkName}_${workFileName}_${toolName}`,
                workName: `${workFileName}_${toolName}`,
                partSizeX: partSizeX,
                partSizeY: partSizeY,
                partThickness: partThickness,
                initialHeight: initialHeight,
                chamferLength: chamferLength,
                machiningAllowance: machiningAllowance,
                toolName: toolName,
                rpmIndex: rpmIndex,
                createDate: new Date().toISOString(),
                isActivation: 'F', // 기본값 설정
                tappingCount: tappingCount,
                isDelete: 'F',
                deleteDate: null, // 기본값 설정
                simulationCount: 0, // 기본값 설정
                lastSimulationDate: null, // 기본값 설정
                playCount: 0, // 기본값 설정
                lastPlayDate: null, // 기본값 설정
            };

            console.log('##### newWork ', newWork);

            // Work 생성
            const workResult = await ipcRenderer.invoke('create-work', newWork);
            logger.trace('### insertWork:invoke:create-work:', workResult);
            if (!workResult.success) {
                logger.error('### insertWork:Error creating work:', workResult.error);
                continue;
            }

            // Tapping 데이터 생성
            for (let j = 0; j < taps.length; j++) {
                const newTap = {
                    workId,
                    id: `${workId}_${j + 1}`,
                    x: taps[j].x,
                    y: taps[j].y,
                    t: toolNo,
                    d: 3, // 기본값 설정
                };
                logger.trace('newTap...', newTap);

                const tapResult = await ipcRenderer.invoke('create-tapping', newTap);
                logger.trace('### invoke:create-tapping:', tapResult);
                if (!tapResult.success) {
                    logger.error('Error creating tapping:', tapResult.error);
                }
            }
        }

        await loadWorkList(); // 데이터 갱신
    };

    // const deleteWork = async (showDeletedList) => {
    //     setShowDeletedList(!showDeletedList);

    //     await loadDeletedWorkList(); // 데이터 갱신
    // };

    // 삭제: isDelete를 T로 변경
    const handleDeleteWork = async (work) => {
        const updateFields = {
            isDelete: 'T',
            isActivation: 'F', // 삭제 시 활성화 Flag 초기화
            deleteDate: new Date().toISOString(),
        };

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

            // setDeletedWorks(work); --> loadDeletedWorkList에서 수행하는 것으로 코스 통일
            loadDeletedWorkList();
        } catch (error) {
            logger.error('IPC invoke failed:', error);
        }

        await loadWorkList();
    };

    // 복원: isDelete를 F로 변경
    const handleRestoreWork = async (work) => {
        const updateFields = {
            isDelete: 'F',
            deleteDate: new Date().toISOString(),
        };

        logger.log(work);

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

        await loadDeletedWorkList();
    };

    const handlePermanentDeleteWork = async (work) => {
        try {
            await ipcRenderer.invoke('delete-work', work.workId);
        } catch (error) {
            logger.error('IPC invoke failed:', error);
        }

        await loadDeletedWorkList();
    };

    const handleSaveDetailWork = async (updatedWork) => {
        try {
            logger.log('###### WorkManager:handleSaveWorkDetail.updatedWork', updatedWork);
            await ipcRenderer.invoke('update-work', updatedWork);
            setActiveWork(updatedWork);
            loadWorkList();
        } catch (error) {
            logger.error('Error saving work detail:', error);
        }
    };

    return (
        <div>
            <h1>작업 관리</h1>
            {detailedWork ? (
                <WorkDetail
                    work={detailedWork}
                    OnSave={handleSaveDetailWork}
                    OnClose={handleCloseDetail}
                    OnUpdateWork={handleUpdateDetail}
                />
            ) : (
                <div>
                    {!showDeletedList && (
                        <Button variant="contained" onClick={handleLoadFile} sx={{ mr: 0.5 }}>
                            작업 불러오기
                        </Button>
                    )}
                    <Button variant="contained" onClick={toggleDeletedList}>
                        {showDeletedList ? '작업 리스트로 가기' : '삭제된 작업 보기'}
                    </Button>
                    {showDeletedList ? (
                        <DeletedWorkList
                            deletedWorks={deletedWorks}
                            onRestore={handleRestoreWork}
                            onPermanentDelete={handlePermanentDeleteWork}
                        />
                    ) : (
                        <WorkList
                            works={works}
                            activeWorkId={activeWorkId}
                            setActiveWorkId={setActiveWorkId}
                            OnSelectWork={handleSelectWork}
                            OnDelete={handleDeleteWork}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkManager;
