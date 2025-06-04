import React, { useState, useEffect } from 'react';
import { Button, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { useTapbotContext } from '../../context/TapbotContext';
import '../../assets/styles/work-list.scss';

import { Logger } from '../../utils/Logger';
const logger = new Logger('debug', false);
logger.setLevel('log');

const { ipcRenderer } = window.electron;

const WorkList = ({ works, activeWorkId, setActiveWorkId, OnSelectWork, OnDelete }) => {
    const { activeWork, setActiveWork } = useTapbotContext();
    const [activeWorkBefore, setActiveWorkBefore] = useState(null);

    useEffect(() => {
        if (activeWorkBefore && activeWorkBefore.workId !== activeWorkId) {
            handleActivWork(activeWorkBefore, 'F'); // 이전 활성 작업 비활성화
        }
    }, [activeWorkId]); // activeWorkId 변경 시 실행

    const handleDeleteWork = (work) => {
        logger.trace('#### WorkList:handleDeleteWork', work);

        if (window.confirm(`작업 "${work.workName}"을(를) 삭제하시겠습니까?`)) {
            if (activeWorkId === work.workId) {
                setActiveWorkId(null);
                setActiveWork(null);
            }
            OnDelete(work);
        }
    };

    const handleRowClick = (work) => {
        logger.trace('WorkList:handleRowClick', work);
        if (activeWorkId === work.workId) {
            OnSelectWork(work);
        }
    };

    const handleToggleActivation = async (work) => {
        logger.trace('WorkList:handleToggleActivation', work);
        if (activeWorkId === work.workId) {
            // 현재 활성화된 작업을 비활성화하는 경우
            await handleActivWork(work, 'F'); // DB에 먼저 반영
            setActiveWorkId(null);
            setActiveWork(null); // 🔹 Home.js에서도 반영되도록 처리
        } else {
            const previousActiveWork = works.find((w) => w.workId === activeWorkId) || null;

            await handleActivWork(work, 'T'); // 새 작업 활성화 (DB에 먼저 반영)

            setActiveWorkId(work.workId);
            setActiveWork(work);

            if (previousActiveWork) {
                await handleActivWork(previousActiveWork, 'F'); // 이전 활성 작업 비활성화

                // 🔹 이전 작업이 현재 활성 작업과 같다면 null 처리
                if (activeWork?.workId === previousActiveWork.workId) {
                    setActiveWork(null);
                }
            }

            setActiveWorkBefore(work);
        }
    };

    const handleActivWork = async (work, isActivation) => {
        if (!work) return;

        try {
            const result = await ipcRenderer.invoke('update-work-fields', {
                workId: work.workId,
                updateFields: { isActivation },
            });

            if (!result.success) {
                logger.error('Update failed:', result.error);
            }
        } catch (error) {
            logger.error('IPC invoke failed:', error);
        }
    };

    return (
        <div className="work-list-container">
            <h2>작업 리스트</h2>
            <Table sx={{ minWidth: 500, border: '1px solid #ddd' }}>
                <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5', height: 40 }}>
                        <TableCell>No</TableCell>
                        <TableCell>작업명</TableCell>
                        <TableCell>탭 개수</TableCell>
                        <TableCell>생성일</TableCell>
                        <TableCell>액션</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {works.length > 0 ? (
                        works.map((work, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    backgroundColor: activeWorkId === work.workId ? 'rgba(33, 150, 243, 0.1)' : 'white',
                                    cursor: 'pointer',
                                    height: 40, // 행 높이 조정
                                    '&:hover': { backgroundColor: 'rgba(33, 150, 243, 0.2)' },
                                }}
                                onClick={() => handleRowClick(work)}
                            >
                                <TableCell sx={{ padding: '4px 8px' }}>{index + 1}</TableCell>
                                <TableCell sx={{ padding: '4px 8px' }}>{work.workName}</TableCell>
                                <TableCell sx={{ padding: '4px 8px' }}>{work.tappingCount}</TableCell>
                                <TableCell sx={{ padding: '4px 8px' }}>{work.createDate}</TableCell>
                                <TableCell
                                    sx={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Button
                                        variant="contained"
                                        color={activeWorkId === work.workId ? 'secondary' : 'primary'}
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleActivation(work);
                                        }}
                                        sx={{ minWidth: 80 }}
                                    >
                                        {activeWorkId === work.workId ? '비활성화' : '활성화'}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWork(work);
                                        }}
                                        sx={{ minWidth: 70 }}
                                    >
                                        삭제
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} sx={{ textAlign: 'center', padding: '8px' }}>
                                {works ? '작업 데이터가 없습니다.' : '로딩 중...'}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default WorkList;
