const toolToTap = {
    129: 'M2', // M2 - T129 RO1.7
    266: 'M3', // M3 - T266 RO2.5
    212: 'M4', // M4 - T212 RO3.3
    239: 'M5', // M5 - T239 RO4.3
    349: 'M6', // M6 - T349 RO5.0
    253: 'M8', // M8 - T253 RO7.0
};

const toolToRadius = {
    129: 1.7, // M2 - T129 RO1.7
    266: 2.5, // M3 - T266 RO2.5
    212: 3.3, // M4 - T212 RO3.3
    239: 4.3, // M5 - T239 RO4.3
    349: 5.0, // M6 - T349 RO5.0
    253: 7.0, // M8 - T253 RO7.0
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
