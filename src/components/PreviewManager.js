import React, { useState, forwardRef, useImperativeHandle } from 'react';
import PreviewPopup from './PreviewPopup';
import { parseGCode, extractTappingInfo } from '../utils/gcode';
import { makeWorkData } from '../utils/workManager';

import { Logger } from '../utils/Logger';

const logger = new Logger('debug', false);
logger.setLevel('log');

const { ipcRenderer } = window.electron;

const PreviewManager = forwardRef((props, ref) => {
    const [open, setOpen] = useState(false); // 팝업 상태 관리
    const [workData, setWorkData] = useState(null);
    const [taps, setTaps] = useState([]);

    useImperativeHandle(ref, () => ({
        handleLoadFile,
        handleContinue,
    }));

    const handleContinue = () => {
        if (!workData || taps.length === 0) {
            logger.error('⚠️ G코드 파일을 먼저 로드해야 합니다.');
            return false; // 에러를 던지지 않고 false 반환
        }

        logger.log('🚀 기존 G코드 데이터로 계속 진행');
        setOpen(true); // 기존 데이터로 팝업 다시 열기
        return true; // 성공 시 true 반환
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

                logger.log('📂 G코드 로드 완료:', tapData);

                if (tapData.errors && tapData.errors.length > 0) {
                    const errorCode = tapData.errors[0].errorCode;
                    if (errorCode === 0) {
                        logger.log('오류 없음. 데이터 처리 진행.');

                        const { work, taps } = makeWorkData(tapData, file.name);
                        logger.log('work..', work);
                        logger.log('taps..', taps);

                        setWorkData(work);
                        setTaps(taps);
                        setOpen(true); // 팝업 열기
                    } else {
                        logger.error('G-code 처리 오류:', tapData.errors[0].description);
                        return;
                    }
                }
            };

            reader.onerror = (e) => {
                logger.error('파일 읽기 오류:', e);
            };

            reader.readAsText(file);
        };

        input.click();
    };

    return (
        <>
            {/* PreviewPopup 팝업 */}
            <PreviewPopup work={workData} taps={taps} open={open} onClose={() => setOpen(false)} />
        </>
    );
});

export default PreviewManager;
