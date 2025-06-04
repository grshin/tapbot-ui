import React from 'react';
import { Dialog, DialogContent, DialogContentText, DialogActions, Grid, Typography, Button } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import '../assets/styles/common-dialog.scss';

const DialogCommon = ({ openDialog, type, content, messageContent, handleCloseDialog, handleConfirm, loading }) => {
    return (
        <div id="dialog-container" data-gjs-type="dialog-container" className="dialog-container gjs-dialog-container">
            <Dialog open={openDialog} className="common-dialog" id={'dialog-common'}>
                <DialogContent className="dialog-content-container-block">
                    <DialogContentText className="dialog-content-container">
                        <Grid className="dialog-content-title">
                            {type === 'info' && (
                                <>
                                    <InfoIcon fontSize="large" color="primary" className="alert-icon" />
                                    <Typography className="label">정보</Typography>
                                </>
                            )}
                            {type === 'confirm' && (
                                <>
                                    <InfoIcon fontSize="large" color="primary" className="alert-icon" />
                                    <Typography className="label">확인</Typography>
                                </>
                            )}
                            {type === 'alert' && (
                                <>
                                    <ErrorIcon fontSize="large" color="warning" className="alert-icon" />
                                    <Typography className="label">경고</Typography>
                                </>
                            )}
                            <Button className="icon-container" onClick={handleCloseDialog} disabled={loading}>
                                <CloseIcon className="cancel-icon" />
                            </Button>
                        </Grid>
                        <Grid className="dialog-content">
                            <Typography className="title">{messageContent}</Typography>
                        </Grid>
                    </DialogContentText>
                </DialogContent>
                <DialogActions className="dialog-actions-container">
                    {content === 'save' && (
                        <>
                            <Button
                                onClick={handleCloseDialog}
                                autoFocus
                                variant="outlined"
                                disabled={loading}
                                className="button--cancel__custom"
                            >
                                취소
                            </Button>
                            <Button
                                variant="contained"
                                className="button--confirm"
                                onClick={handleConfirm}
                                disabled={loading}
                            >
                                확인
                            </Button>
                        </>
                    )}
                    {content === 'error' && (
                        <>
                            <Button
                                variant="contained"
                                className="button--cancel__custom"
                                onClick={handleConfirm}
                                disabled={loading}
                            >
                                확인
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default DialogCommon;
