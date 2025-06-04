import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    TextField,
    Button,
    Grid,
    TableContainer,
    Table,
    TableBody,
    TableRow,
    TableCell,
    Toolbar,
} from '@mui/material';
import DialogCommon from '../DialogCommon';
import '../../assets/styles/common.scss';

import { useTapbotContext } from '../../context/TapbotContext';

import { Logger } from '../../utils/Logger';
const logger = new Logger('debug', false);
logger.setLevel('debug');

// const tapInfo = {
//     partSizeX: work.partSizeX,
//     partSizeY: work.partSizeY,
//     partThickness: work.partThickness, // 가공물 두께
//     initialHeight: 5.0, // 시작 위치 (높이) - initialHeight
//     machiningAllowance: 5.0, // 가공 여유 ==> 실 가공 depth = partThickness + machiningAllowance
//     chamferLength: 3.0
// };

const Setting = () => {
    const [settings, setSettings] = useState({
        initialHeight: 5.0, // "시작 위치 (높이) - initialHeight" ==> tapping_start_pos = workPiece_surface_pos[2] + initialHeight
        partThickness: 1.6,
        chamferLength: 1.8, // 실 가공 깊이 ==> chamferLength + partThickness + machiningAllowance (추가 가공 여유)
        machiningAllowance: 1.8, // 가공 여유 ==> 실 가공 depth = partThickness + machiningAllowance
    });

    const [openConfirmSaveDialog, setOpenConfirmSaveDialog] = useState(false);
    const [loadingDialog, setLoadingDialog] = useState(false);

    const { setActiveScreen } = useTapbotContext();

    useEffect(() => {
        setActiveScreen('Setting');

        return () => {
            // console.log('🗑️ Setting 언마운트됨!');
        };
    }, [setActiveScreen]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setSettings((prevSettings) => ({
            ...prevSettings,
            [name]: Number(value),
        }));
    };

    const handleOnClickSave = () => {
        setOpenConfirmSaveDialog(true);
    };

    const handleCloseConfirm = () => {
        if (!loadingDialog) {
            setOpenConfirmSaveDialog(false);
        }
    };

    const onSaveProject = () => {
        if (loadingDialog) return;

        setLoadingDialog(true);
        logger.log('저장된 설정:', settings);
        // 여기에 설정을 저장하는 로직을 추가하세요

        setLoadingDialog(false);
        setOpenConfirmSaveDialog(false);
    };

    return (
        <Container maxWidth={false} className="container-common">
            <h2 className="title-common">Tapping - 설정</h2>
            <Grid container className="grid-common">
                <Grid item xs={12}>
                    <TableContainer>
                        <Table className="table-common">
                            <TableBody>
                                <TableRow>
                                    <TableCell className="table-cell-header">시작 위치(높이)</TableCell>
                                    <TableCell className="table-cell-body">
                                        <TextField
                                            variant="outlined"
                                            name="initialHeight"
                                            onChange={handleChange}
                                            value={settings.initialHeight}
                                        />
                                        mm
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">가공물 두께</TableCell>
                                    <TableCell className="table-cell-body">
                                        <TextField
                                            variant="outlined"
                                            name="partThickness"
                                            onChange={handleChange}
                                            value={settings.partThickness}
                                        />
                                        mm
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">챔퍼 길이</TableCell>
                                    <TableCell className="table-cell-body">
                                        <TextField
                                            variant="outlined"
                                            name="chamferLength"
                                            onChange={handleChange}
                                            value={settings.chamferLength}
                                        />
                                        mm
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="table-cell-header">가공 여유</TableCell>
                                    <TableCell className="table-cell-body">
                                        <TextField
                                            variant="outlined"
                                            name="machiningAllowance"
                                            onChange={handleChange}
                                            value={settings.machiningAllowance}
                                        />
                                        mm
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        <Toolbar className="toolbar-common">
                            <Button variant="contained" className="button-save" onClick={handleOnClickSave}>
                                저장
                            </Button>
                        </Toolbar>
                    </TableContainer>
                </Grid>
            </Grid>
            <DialogCommon
                openDialog={openConfirmSaveDialog}
                handleCloseDialog={handleCloseConfirm}
                type="confirm"
                content="save"
                messageContent="저장 하시겠습니까?"
                loading={loadingDialog}
                handleConfirm={onSaveProject}
            />
        </Container>
    );
};

export default Setting;
