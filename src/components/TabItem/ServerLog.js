// ServerLog.js

import React from 'react';
import { Box, Typography, List, ListItem, ListItemText } from '@mui/material';

const ServerLog = ({ logs }) => {
    return (
        <Box sx={{ marginTop: 2 }}>
            <Typography variant="h6">Server Logs</Typography>
            <List>
                {logs.map((log, index) => (
                    <ListItem key={index}>
                        <ListItemText primary={log} />
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

export default ServerLog;
