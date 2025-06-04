import { useState, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';

function formatExecutionTime(seconds) {
    const roundedSeconds = Math.round(seconds);
    if (roundedSeconds < 60) {
        return `${roundedSeconds}초`;
    } else if (roundedSeconds < 3600) {
        const minutes = Math.floor(roundedSeconds / 60);
        const secs = roundedSeconds % 60;
        return `${minutes}분 ${secs}초`;
    }
}

export default function NotificationPopup({ data, duration = 5000 }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (data) {
            setOpen(true);
            setTimeout(() => setOpen(false), duration); // 5초 후 자동 닫힘
        }
    }, [data]);

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') return;
        setOpen(false);
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={duration}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            <Alert onClose={handleClose} severity="success" sx={{ width: '100%' }}>
                {data?.payload.message} (실행 시간: {formatExecutionTime(data?.payload.executionTime)})
            </Alert>
        </Snackbar>
    );
}
