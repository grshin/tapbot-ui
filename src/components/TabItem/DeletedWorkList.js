import React from 'react';
import { Button, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';

import '../../assets/styles/work-list.scss';

const DeletedWorkList = ({ deletedWorks, onRestore, onPermanentDelete }) => {
    const handleDeleteWork = (work) => {
        if (window.confirm(`작업 "${work.workName}"을(를) 완전히 삭제하시겠습니까?`)) {
            onPermanentDelete(work);
        }
    };

    const handleRestore = (work) => {
        if (window.confirm(`작업 "${work.workName}"을(를) 복원하시겠습니까?`)) {
            onRestore(work);
        }
    };

    return (
        <div className="deleted-work-list-container">
            <h2>삭제된 작업 리스트</h2>
            <Table sx={{ minWidth: 500, border: '1px solid #ddd' }}>
                <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5', height: 48 }}>
                        <TableCell>No</TableCell>
                        <TableCell>작업명</TableCell>
                        <TableCell>탭 개수</TableCell>
                        <TableCell>생성일</TableCell>
                        <TableCell>액션</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Array.isArray(deletedWorks) && deletedWorks.length > 0 ? (
                        deletedWorks.map((work, index) => (
                            <TableRow
                                key={work.workId}
                                sx={{
                                    // backgroundColor: activeWorkId === work.workId ? 'rgba(33, 150, 243, 0.1)' : 'white',
                                    cursor: 'pointer',
                                    height: 48,
                                    '&:hover': { backgroundColor: 'rgba(33, 150, 243, 0.2)' },
                                }}
                            >
                                <TableCell sx={{ padding: '8px' }}>{index + 1}</TableCell>
                                <TableCell sx={{ padding: '8px' }}>{work.workName}</TableCell>
                                <TableCell sx={{ padding: '8px' }}>{work.tappingCount}</TableCell>
                                <TableCell sx={{ padding: '8px' }}>{work.createDate}</TableCell>
                                <TableCell sx={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRestore(work);
                                        }}
                                        sx={{ minWidth: 80 }}
                                    >
                                        복원
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWork(work);
                                        }}
                                        sx={{ minWidth: 80 }}
                                    >
                                        완전 삭제
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} sx={{ textAlign: 'center', padding: '8px' }}>
                                삭제된 작업 데이터가 없습니다.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default DeletedWorkList;
