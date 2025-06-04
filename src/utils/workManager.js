import { getCurrentTime } from '../utils/time';

import { Logger } from './Logger';
const logger = new Logger('info', false); // 기본 level 및 timestamp 설정 가능

export const toolToTap = {
    129: 'M2', // M2 - T129 RO1.7
    266: 'M3', // M3 - T266 RO2.5
    212: 'M4', // M4 - T212 RO3.3
    239: 'M5', // M5 - T239 RO4.3
    349: 'M6', // M6 - T349 RO5.0
    253: 'M8', // M8 - T253 RO7.0
};

export const toolToRadius = {
    129: 1.7, // M2 - T129 RO1.7
    266: 2.5, // M3 - T266 RO2.5
    212: 3.3, // M4 - T212 RO3.3
    239: 4.3, // M5 - T239 RO4.3
    349: 5.0, // M6 - T349 RO5.0
    253: 7.0, // M8 - T253 RO7.0
};

export const toolToColor = {
    266: 'red',
    212: 'orange',
    239: 'green',
    349: 'purple',
    253: 'blue',
};

export const getToolName = (toolNo) => {
    const tap = toolToTap[toolNo];
    const radius = toolToRadius[toolNo];

    if (tap && radius) {
        return `T${toolNo}(Ø${radius})_${tap}`;
    } else {
        return `Unknown Tool (${toolNo})`;
    }
};

// // 테스트
// console.log(getToolName(266)); // T266(Ø2.5)_M3
// console.log(getToolName(212)); // T212(Ø3.3)_M4
// console.log(getToolName(999)); // Unknown Tool (999)

export const generateWorkId = (tmpworkName, toolName, currentTime) => {
    const rawString = `${tmpworkName}_${toolName}_${currentTime}`;
    let hash = 0;

    for (let i = 0; i < rawString.length; i++) {
        hash = (hash << 5) - hash + rawString.charCodeAt(i);
        hash &= hash; // 32비트 정수 변환
    }

    return Math.abs(hash).toString(36).substring(0, 16); // 16글자로 변환
};

export const makeWorkData = (tapData, fileName) => {
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

    const workList = [];
    const tapList = [];

    for (let i = 0; i < workCount; i++) {
        const toolNo = tapData.taps[i].t;
        const toolName = getToolName(toolNo);
        const taps = tapData.taps[i].coords;
        const tappingCount = taps.length;
        const workId = generateWorkId(fileName, toolNo, currentTime);
        const workFileName = fileName.replace(/\.[^/.]+$/, '');

        if (tappingCount === 0) continue;

        const newWork = {
            workId,
            workFileName,
            workName: `${workFileName}_${toolName}`,
            partSizeX,
            partSizeY,
            partThickness: 1.6,
            initialHeight: 5.0,
            chamferLength: 1.6,
            machiningAllowance: 1.6,
            toolName,
            rpmIndex: 11,
            createDate: new Date().toISOString(),
            isActivation: 'F',
            tappingCount,
            isDelete: 'F',
            deleteDate: null,
            simulationCount: 0,
            lastSimulationDate: null,
            playCount: 0,
            lastPlayDate: null,
        };

        workList.push(newWork);

        for (let j = 0; j < taps.length; j++) {
            tapList.push({
                workId,
                id: `${workId}_${j + 1}`,
                x: taps[j].x,
                y: taps[j].y,
                t: toolNo,
                d: 3,
            });
        }
    }

    return { work: workList, taps: tapList };
};
