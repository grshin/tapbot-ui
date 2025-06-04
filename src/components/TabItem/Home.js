import React, { useEffect } from 'react';
//import { Button, Grid, TableContainer, Table, TableRow, TableCell, TableBody } from '@mui/material';
import { Grid } from '@mui/material';
import WorkDetail from './WorkDetail';
import { useTapbotContext } from '../../context/TapbotContext';

import { Logger } from '../../utils/Logger';
const logger = new Logger('debug', false);
logger.setLevel('log');

const { ipcRenderer } = window.electron;

const Home = () => {
    const { activeWork, setActiveWork, setActiveScreen } = useTapbotContext();

    useEffect(() => {
        setActiveScreen('Home');

        return () => {
            // console.log('🗑️ Home 언마운트됨!');
        };
    }, [setActiveScreen]);

    // Home이 처음 로드될 때, isActivation이 'T'이면서 isDelete가 'F'인 작업을 가져와서 활성화
    useEffect(() => {
        if (!activeWork) {
            const fetchActiveWork = async () => {
                try {
                    const result = await ipcRenderer.invoke('fetch-work', {
                        isActivation: 'T',
                        isDelete: 'F',
                    });

                    if (result.success && result.data.length > 0) {
                        setActiveWork(result.data[0]);
                    } else {
                        setActiveWork(null); // 활성화된 작업이 없으면 null 설정
                    }
                } catch (error) {
                    logger.error('활성화된 작업을 가져오는 중 오류 발생:', error);
                }
            };

            fetchActiveWork();
        }
    }, [activeWork]);

    const handleUpdateDetail = (updatedWork) => {
        if (updatedWork) {
            // 수정된 작업 정보를 반영
            setActiveWork(updatedWork);
        }
    };

    return (
        <>
            {activeWork ? <h2>대시보드 - 작업 정보</h2> : <h2>SPTek Tapping - 작업 정보</h2>}
            <Grid container minWidth={900} height={'100%'}>
                <Grid item xs={12} md={12} lg={12}>
                    {activeWork ? (
                        <WorkDetail work={activeWork} OnUpdateWork={handleUpdateDetail} readOnly={true} />
                    ) : (
                        <p>활성화된 작업이 없습니다.</p>
                    )}
                </Grid>
            </Grid>
        </>
    );
};

export default Home;
