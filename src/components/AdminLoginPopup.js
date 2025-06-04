import React, { useState } from 'react';
import { Dialog, DialogContent, DialogActions, Grid, Typography, Button, TextField } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';

import { toast, Toaster } from 'react-hot-toast';

const AdminLoginPopup = ({ open, onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState('');
    const [showChangePassword, setShowChangePassword] = useState(false);

    const handleKeyDown = (event, action) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            action();
        }
    };

    const handleSubmit = async () => {
        if (!password) {
            setError('비밀번호를 입력하세요.');
            return;
        }

        const isValid = await window.electron.ipcRenderer.invoke('verify-admin-password', password);
        if (isValid) {
            setError('');
            onSuccess();
            onClose(); // ✅ 로그인 성공 후 팝업 닫기
        } else {
            setError('잘못된 비밀번호입니다.');
        }
    };

    const handleShowChangePassword = () => {
        setShowChangePassword(true);
        setError('');
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setError('모든 필드를 입력해주세요.');
            return;
        }

        if (newPassword.length < 5) {
            setError('비밀번호는 최소 5자 이상이어야 합니다.');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError('새로운 비밀번호가 일치하지 않습니다.');
            return;
        }

        try {
            // ✅ 기존 비밀번호 검증
            const isCurrentValid = await window.electron.ipcRenderer.invoke('verify-admin-password', currentPassword);
            if (!isCurrentValid) {
                setError('현재 비밀번호가 올바르지 않습니다.');
                return;
            }

            // ✅ 새 비밀번호가 기존 비밀번호와 동일한지 체크
            if (currentPassword === newPassword) {
                setError('새로운 비밀번호는 기존 비밀번호와 다르게 설정해주세요.');
                return;
            }

            // ✅ 기존 비밀번호가 맞으면 새 비밀번호 변경
            const isSuccess = await window.electron.ipcRenderer.invoke('update-admin-password', newPassword);
            if (isSuccess) {
                toast.success('비밀번호가 변경되었습니다.');
                onClose(); // ✅ 다이얼로그 닫기
            } else {
                setError('비밀번호 변경에 실패했습니다.');
            }
        } catch (error) {
            setError('비밀번호 변경에 실패했습니다.');
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <Toaster />
            <DialogContent className="admin-popup-content" style={{ minWidth: '300px', minHeight: '150px' }}>
                <Grid container alignItems="center" spacing={1} className="dialog-header">
                    <Grid item>
                        <ErrorIcon fontSize="large" color="warning" />
                    </Grid>
                    <Grid item>
                        <Typography variant="h6">{showChangePassword ? '비밀번호 변경' : '관리자 로그인'}</Typography>
                    </Grid>
                    <Grid item style={{ marginLeft: 'auto' }}>
                        <Button onClick={onClose} className="close-button">
                            <CloseIcon />
                        </Button>
                    </Grid>
                </Grid>

                {!showChangePassword ? (
                    <>
                        <TextField
                            type="password"
                            fullWidth
                            margin="normal"
                            label="비밀번호 입력"
                            variant="outlined"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, handleSubmit)}
                        />
                        <Typography color="error" style={{ minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                            {error}
                        </Typography>
                    </>
                ) : (
                    <>
                        <TextField
                            type="password"
                            fullWidth
                            margin="normal"
                            label="현재 비밀번호 입력"
                            variant="outlined"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                        <TextField
                            type="password"
                            fullWidth
                            margin="normal"
                            label="새로운 비밀번호 입력"
                            variant="outlined"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, handleChangePassword)}
                        />
                        <TextField
                            type="password"
                            fullWidth
                            margin="normal"
                            label="새로운 비밀번호 확인"
                            variant="outlined"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, handleChangePassword)}
                        />
                        <Typography color="error" style={{ minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                            {error}
                        </Typography>
                    </>
                )}
            </DialogContent>
            <DialogActions className="admin-popup-actions">
                {!showChangePassword ? (
                    <>
                        <Button onClick={handleShowChangePassword} variant="outlined" color="secondary">
                            암호 변경
                        </Button>
                        <Button onClick={onClose} variant="outlined">
                            취소
                        </Button>
                        <Button onClick={handleSubmit} variant="contained" color="primary">
                            로그인
                        </Button>
                    </>
                ) : (
                    <>
                        <Button onClick={() => setShowChangePassword(false)} variant="outlined">
                            취소
                        </Button>
                        <Button onClick={handleChangePassword} variant="contained" color="primary">
                            변경
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default AdminLoginPopup;
