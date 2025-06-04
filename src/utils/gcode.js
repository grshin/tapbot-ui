//import { logger } from 'dart-api';
import { Logger } from './Logger';

const logger = new Logger('info', false); // 기본 level 및 timestamp 설정 가능

// MODE Define
const TRACE_MODE = 3;
const DEBUG_MODE = 2;
const INFO_MODE = 1;
const ERROR_MODE = 0;

//LOG LEVEL
//const LOG_LEVER = INFO_MODE;
const LOG_LEVER = DEBUG_MODE;
//const LOG_LEVER = TRACE_MODE;

// 로그 출력
const $log = {
    trace: function (...msg) {
        if (TRACE_MODE <= LOG_LEVER) {
            console.log(msg);
        }
    },
    debug: function (...msg) {
        if (DEBUG_MODE <= LOG_LEVER) {
            console.log(msg);
        }
    },
    obj: function (...msg) {
        if (DEBUG_MODE <= LOG_LEVER) {
            logObjectProperties(msg);
        }
    },
    info: function (...msg) {
        if (INFO_MODE <= LOG_LEVER) {
            console.log(msg);
        }
    },
    error: function (...msg) {
        if (ERROR_MODE <= LOG_LEVER) {
            console.log(msg);
        }
    },
};

export const logObjectProperties = (obj, prefix = '') => {
    if (navigator.userAgent.toLowerCase().indexOf('dr.dart-platform') === -1) {
        logger.debug(obj);
        return;
    }

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const currentKey = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object' && value !== null) {
                // 객체라면 재귀적으로 순회
                logObjectProperties(value, currentKey);
            } else {
                // 객체가 아니라면 현재 키와 값을 출력
                if (navigator.userAgent.toLowerCase().indexOf('dr.dart-platform') === -1) {
                    logger.debug(`${currentKey}: ${value}`);
                } else {
                    logger.debug(`${currentKey}: ${value}`);
                }
            }
        }
    }
};

// G코드 뒤쪽에 있는 주석을 제거하는 모듈
const removeSubComment = (input) => {
    //const input = 'X356.66Y295.T212(RO3.3)';
    let result = null;
    if (input !== null) {
        const regex = RegExp(/\(([^)]+)\)/, 'g');
        let array;

        while ((array = regex.exec(input)) !== null) {
            result = input.substring(0, array.index);
            $log.trace(`### removeSubComment result: : ${result}`);
        }
    }
    return result;
};

/////
// 명령줄 뒤에 있는 주석 추출
const extractSubComment = (cleanedLine) => {
    let subComment = null;
    const subCommentRegex = /\(([^)]+)\)/g; // 괄호로 둘러싸인 문자열
    const matchArray = cleanedLine.match(subCommentRegex);
    if (matchArray !== null) {
        subComment = matchArray[0]; // 주석 추출 (예: (RO3.3) 등)
        subComment = subComment.substring(1, subComment.length - 1);
        $log.trace('### extractSubComment subComment: ' + subComment); //e.g. '### subComment: RO3.3'
    }
    return subComment;
};

/////
// 공백 문자열 제거
const removeSpaces = (input) => {
    const cleanedInput = input.replace(/\s+/g, '');
    return cleanedInput;
};

/////
// NESTED-AREA 정보를 PART-SZIE 정보로 변경
const processPartSize = (arr, currentKey, newKey) => {
    const largeValue = { x: -Infinity, y: -Infinity };

    // 키 값을 newKey 'PART-SIZE' 로 변경
    arr.forEach((item) => {
        if (item.key === currentKey) {
            item.key = newKey; // Update the key value
        }
    });

    // Loop through the array to find the largest x and y for PART-SIZE items
    arr.forEach((item) => {
        if (item.key === 'PART-SIZE') {
            if (item.x > largeValue.x) {
                largeValue.x = item.x;
            }
            if (item.y > largeValue.y) {
                largeValue.y = item.y;
            }
        }
    });

    // PART-SIZE 가진 item을 제거
    const filteredArr = arr.filter((item) => item.key !== 'PART-SIZE');
    // 최대값 (x, y)를 설정하여 PART-SIZE 키 아이템 주가
    if (largeValue.x !== -Infinity && largeValue.y !== -Infinity) {
        filteredArr.push({ key: 'PART-SIZE', x: largeValue.x, y: largeValue.y });
    }

    return filteredArr;
};

/////
// G-code 파싱 함수
export const parseGCode = (gcode) => {
    logger.trace('###### parseGCode' + gcode);
    logger.trace(navigator.userAgent.toLowerCase());
    logger.trace(navigator.userAgent.toLowerCase().indexOf('dr.dart-platform'));

    // TypeError: num.split is not a function
    // lines = gcode.split('\n');
    let lines = null;
    if (typeof gcode === 'string' || gcode instanceof String) {
        lines = gcode.split('\n');
    } else {
        $log.trace(typeof gcode);
        lines = gcode.toString().split('\n');
    }

    const parsedData = {
        comments: [],
        commands: [],
    };

    if (lines !== null) {
        lines.forEach((line) => {
            // 문자열내 공백 제거
            const cleanedLine = removeSpaces(line);

            // 빈 줄 무시
            if (cleanedLine.length === 0) return;

            // '%'로 시작하거나 끝나는 줄 무시
            if (cleanedLine === '%' || cleanedLine.startsWith('%')) return;

            // 라인 전체 주석: 라인 처음과 끝이 괄호로 둘러싸인 텍스트
            if (cleanedLine.startsWith('(') && cleanedLine.endsWith(')')) {
                parsedData.comments.push(cleanedLine.slice(1, -1).trim()); // 양끝의 괄호 제거하여 저장
            } else {
                // 명령어 처리
                const commandRegex = /[A-Z]\d+/; // 첫 대문자 이후 숫자 정규식: 명령어 추출
                let command = cleanedLine.match(commandRegex)[0]; // 명령어 추출 (예: G92, G28 등)
                logger.trace('### command[1]: ' + command + ', length: ' + command.length);

                // X356.66Y295.T212(RO3.3) -> P01X356.66Y295.T212(RO3.3)
                // 첫 글자가 X이고 'X356.66'형태로 입력되었을 경우, 'P01'명령어로 처리...
                if (command.startsWith('X')) {
                    const xRegex = /([A-Z][-+]?[0-9]*\.?[0-9]*)|\([^)]+\)/g;
                    command = cleanedLine.match(xRegex)[0]; // 명령어 추출 (예: X502.1 등)
                    logger.trace('### command[2]: ' + command + ', length: ' + command.length); // e.g. '### [2]: X356.66, lenght: 7'

                    // X356.66의 형태로 들어온 경우, 'P01' 명령으로 처리
                    if (command !== null) {
                        command = 'P01';
                    }
                }

                // 명령줄 뒤에 있는 주석 추출
                let subComment = null;
                subComment = extractSubComment(cleanedLine);

                const params = {};
                let tempString = null;
                if (command !== 'P01') {
                    tempString = cleanedLine.substring(command.length);
                } else {
                    tempString = cleanedLine;
                }

                // 명령줄 뒤에 있는 주석 제거
                let paramString = removeSubComment(tempString);
                if (paramString === null) paramString = tempString;
                logger.trace('### [paramString]: ' + paramString); // e.g. '### [paramString]: I60.J180.K5'

                // 매개변수 추출
                let paramMatch;
                const paramRegex = /([A-Z])([-\d.]+)/g; //대문자 한글자 + 바로뒤 숫자(소수점포함)..

                while ((paramMatch = paramRegex.exec(paramString)) !== null) {
                    const letter = paramMatch[1]; // [0]: 찾아진 문자열, [1]: 대문자 한글자, [2]: 바로뒤 숫자(소수점포함)
                    const value = parseFloat(paramMatch[2]);
                    params[letter] = value;
                }

                // 명령어 내 주석이 있는 경우 'SC' 값으로 추가
                if (subComment !== null && !undefined) {
                    params['SC'] = subComment;
                }

                // commands에 객체형태로 추가
                parsedData.commands.push({ command, params });
            }
        });
    }

    logger.trace('######## parsedData', parsedData);

    return parsedData;
};

/////
// 원 둘레의 좌표 계산
function getCoordsOnCircle(radius, angleInDegrees) {
    // 각도를 라디안으로 변환
    const angleInRadians = (angleInDegrees * Math.PI) / 180;

    // X, Y 좌표 계산
    const x = radius * Math.cos(angleInRadians);
    const y = radius * Math.sin(angleInRadians);

    return { x, y };
}

// Pattern Status Define
const PATTERN_STATUS_SET_ORIGIN = 1;
const PATTERN_STATUS_BEGIN = 2;
const PATTERN_STATUS_END = 3;

// 파싱 에러 코드
const GCODE_R_OK = 0;
const GCODE_R_NO_SIZE_INFO = 1; // 재료 크기 정보가 없습니다.
const GCODE_R_NO_TAPS_INFO = 2; // 탭 정보가 없습니다.
const GCODE_R_NO_TOOLS_INFO = 3; // 툴 정보가 없습니다.
const GCODE_R_UNKNOWN_ERROR = 99; // 알수 없는 에러로 파싱이 실패하였습니다.
const errorMessages = [
    { errorCode: GCODE_R_OK, description: '파싱이 정상적으로 완료되었습니다.' },
    { errorCode: GCODE_R_NO_SIZE_INFO, description: '재료 크기 정보가 없습니다.' },
    { errorCode: GCODE_R_NO_TAPS_INFO, description: '탭 정보가 없습니다.' },
    { errorCode: GCODE_R_NO_TOOLS_INFO, description: '툴 정보가 없습니다.' },
    { errorCode: GCODE_R_UNKNOWN_ERROR, description: '알수 없는 에러로 파싱이 실패하였습니다.' },
];

/////
// 탭 정보 추출 함수
export const extractTappingInfo = (data) => {
    const tapData = {
        info: [],
        taps: [], // [t:212, coords: {x, y}]
        origin: { x: 0, y: 0 }, // G93 원점 변경시 대응
        pattern: { x: 0, y: 0, t: null, mode: null, code: null, status: null },
        coords: [],
        commands: [],
        comments: [],
    };

    const errorCodes = [];

    const responseData = {
        // error_code: { code: GCODE_R_OK, description: '파싱이 정상적으로 완료되었습니다.' },
        errors: [],
        info: [],
        taps: [], // [t:212, coords: {x, y}]
    };

    logger.trace('#### extractTappingInfo');

    ///
    // commands와 comments를 복사
    tapData.commands = data.commands.map((command) => command);
    tapData.comments = data.comments.map((comment) => comment);

    ///
    // 주석 처리
    // data.comments.forEach((gcode, index) => {
    Array.from(data.comments).forEach((gcode, index) => {
        // 첫번째 주석은 파일이름
        if (index === 0) {
            const key = 'NAME';
            const value = gcode;
            tapData.info.push({ key, value });
        }

        // [1] 부품 크기처리: (NESTED-AREA=671.4X421.8) or (PART-SIZE=400X320)
        if (gcode.includes('NESTED-AREA')) {
            // 문자열 양끝 공백 제거
            const cleanedLine = gcode.trim();

            // 1. '='를 기준으로 키와 값을 분리
            const [key, value] = cleanedLine.split('=');

            // 2. 'X'를 기준으로 값을 분리하고 공백으로 결합
            const [width, height] = value.split('X');

            const x = parseInt(width);
            const y = parseInt(height);

            // 3. 결과 저장
            tapData.info.push({ key, x, y });
            logger.trace('### tapData.info.push key: ' + key + ' x: ' + x + ' y: ' + y);
        } else if (gcode.includes('PART-SIZE')) {
            // 문자열 양끝 공백 제거
            const cleanedLine = gcode.trim();

            // 1. '='를 기준으로 키와 값을 분리
            const [key, value] = cleanedLine.split('=');

            // 2. 'X'를 기준으로 값을 분리하고 공백으로 결합
            const [width, height] = value.split('X');

            const x = parseInt(width);
            const y = parseInt(height);

            // 3. 결과 저장
            tapData.info.push({ key, x, y });
            logger.trace('### tapData.info.push key: ' + key + ' x: ' + x + ' y: ' + y);
        }

        // [2] 툴번호 처리
        const toolRegex = /(T)(\d+)/;
        const match = gcode.match(toolRegex);

        if (match) {
            const key = match[1]; // "T"
            const t = parseInt(match[2]); // "212"
            tapData.taps.push({ t, coords: [] }); // t: 212, coords [{x,y}]
        }
    });

    // 툴정보 없는 좌표에 대한 처리를 위해서 taps.999 추가
    const t = null; //
    tapData.taps.push({ t, coords: [] }); // t: 999, coords [{x,y}]

    // 크기 정보 (PART-SIZE, NETED-AREA)가 없는 G코드의 경우 에러 코드 추가
    if (tapData.info.find((item) => item.key === 'PART-SIZE') === undefined) {
        if (tapData.info.find((item) => item.key === 'NESTED-AREA') === undefined) {
            errorCodes.push(GCODE_R_NO_SIZE_INFO);
        }
    }

    ///
    // 명렁어 처리
    // data.commands.forEach((gcode) => {
    // forEach not a function error 대응
    Array.from(data.commands).forEach((gcode) => {
        logger.trace('command: ' + gcode.command);
        logger.trace(gcode.params);
        let l_pattern = null;
        switch (gcode.command) {
            case 'P01':
                // tapping data 저장: x좌표, y좌표, tool 번호
                // G72에서 저장된 origin 좌표 처리
                const x = gcode.params['X'] + tapData.origin.x;
                const y = gcode.params['Y'] + tapData.origin.y;
                let t = gcode.params['T'];
                if ((t === undefined) | (t === null)) {
                    // 이전 tool 번호 저장, 이전 값이 없으면 undefined 상태 유지됨
                    t = tapData.pattern.t;
                    $log.trace('###### tapData.pattern.t' + t);
                }
                tapData.coords.push({ x, y, t });

                // 패턴 처리를 위해서 패턴의 원점 좌표와 툴정보를 저장
                // 패턴 정보는 X,Y 좌표 입력되어 홀을 낼 때나 G72로 명시적으로 패터 origin정보가 입력될 때 처리
                tapData.pattern = { x: x, y: y, t: t, code: 'P01' };
                logger.trace(tapData.pattern);
                break;

            case 'G25': // G25: Repositioning (with Offset) X: Reposition Amount
                break;
            case 'G27': // G27: Repositioning X: Reposition Amount
                break;

            case 'G28': // G28: Line At Angle (LAA): 직선상에 등간격 홀 가공
                // I: Spacing + Positive value only
                // J: Angle + or -
                // K: Number of Spaces (Not Holes)

                logger.trace('### G28 old pattern info', tapData.pattern);

                tapData.pattern.code = 'G28'; // 패턴 코드 저장
                tapData.pattern.status = PATTERN_STATUS_BEGIN;

                for (let index = 0; index < Math.abs(gcode.params['K']); index++) {
                    const coord = getCoordsOnCircle(gcode.params['I'] * (index + 1), gcode.params['J']);
                    const x = parseFloat((tapData.pattern.x + coord.x).toFixed(2));
                    const y = parseFloat((tapData.pattern.y + coord.y).toFixed(2));
                    let t = null;
                    if (gcode.params['T']) {
                        t = gcode.params['T'];
                    } else {
                        t = tapData.pattern.t;
                    }
                    tapData.coords.push({ x, y, t });
                    logger.trace('x: ' + x + ' y: ' + y + ' t: ' + y);
                }
                tapData.pattern.status = PATTERN_STATUS_END;
                break;

            case 'G29': // G29: ARC OF HOLES (ARC): 같은 원주상에 등간격으로 홀 가공
                // I: Radius Positive Number
                // J: Starting angle: Counterclockwise: Positivie, Clockwise: Negative
                // P: Incremental angle: Positive - counterclockwise, Negative - clockwise
                // K: Number of holes
                tapData.pattern.code = 'G29'; // 패턴 코드 저장
                tapData.pattern.status = PATTERN_STATUS_BEGIN;
                for (let index = 0; index < Math.abs(gcode.params['K']); index++) {
                    const coord = getCoordsOnCircle(gcode.params['I'], gcode.params['J'] + gcode.params['P'] * index);
                    const x = parseFloat((tapData.pattern.x + coord.x).toFixed(2));
                    const y = parseFloat((tapData.pattern.y + coord.y).toFixed(2));
                    let t = null;
                    if (gcode.params['T']) {
                        t = gcode.params['T'];
                    } else {
                        t = tapData.pattern.t;
                    }
                    tapData.coords.push({ x, y, t });
                }
                tapData.pattern.status = PATTERN_STATUS_END;
                break;

            case 'G26': // G26: BOLT HOLE CIRCLE (BHC): 원주상 시작을 J도로 하여 360/K로 등간격 홀 가공, G26I50.J90.K6T230(RO5)
                // I: Radius of circle (I) positive number
                // J: -Starting angle: Counterclockwise: Positivie, Clockwise: Negative
                // K: Number of holes: positive number only --> 리치니스에서 작업한 결과가 마이너스 값이 나오는 경우가 있어서 Math.abs 적용
                tapData.pattern.code = 'G26'; // 패턴 코드 저장
                tapData.pattern.status = PATTERN_STATUS_BEGIN;
                for (let index = 0; index < Math.abs(gcode.params['K']); index++) {
                    const coord = getCoordsOnCircle(
                        gcode.params['I'],
                        gcode.params['J'] + (index * 360) / gcode.params['K'],
                    ); // 첫번 이후 360/K 각도 계산
                    const x = parseFloat((tapData.pattern.x + coord.x).toFixed(2));
                    const y = parseFloat((tapData.pattern.y + coord.y).toFixed(2));
                    let t = null;
                    if (gcode.params['T']) {
                        t = gcode.params['T'];
                    } else {
                        t = tapData.pattern.t;
                    }
                    tapData.coords.push({ x, y, t });
                }
                tapData.pattern.status = PATTERN_STATUS_END;
                break;

            case 'G36': // G36: GRID (GRD-X, Grid Horizontal): X축으로 간격이 같고 Y으로도 간격이 같은 그리드 가공, 작업시 X축으로 먼저 가공)
                // G36: Punching in the X axis direction
                // G37: Punching in the Y axis direction
                // I: Increment or Spacing
                //    + X direction: positive
                //    - X direction: negative
                // P: Number of spaces in X direction
                // J: Increment or Spacing
                //    + Y direction: positive
                //    - Y direction: negative
                // K: Number of scpaces in Y direction
                if (tapData.pattern.code === 'P01') {
                    // G72를 통한 패턴 위치 설정이 아닌 경우, 즉, P01X356.66Y295.T212(RO3.3)의 형태의 경우 coords의 최상단 제거
                    tapData.coords.pop();
                }
                tapData.pattern.code = 'G36'; // 패턴 코드 저장
                tapData.pattern.status = PATTERN_STATUS_BEGIN;
                l_pattern = { x: tapData.pattern.x, y: tapData.pattern.y };
                // K: Y방향 Spaces
                for (let j = 0; j <= Math.abs(gcode.params['K']); j++) {
                    let x, y;
                    $log.trace(tapData.pattern);
                    // P: X방향 Spaces
                    for (let i = 0; i <= Math.abs(gcode.params['P']); i++) {
                        const coord = { x: 0, y: 0 };
                        coord.x = j % 2 === 0 ? gcode.params['I'] * i : -gcode.params['I'] * i;
                        coord.y = gcode.params['J'] * j;
                        x = parseFloat((l_pattern.x + coord.x).toFixed(2));
                        y = parseFloat((l_pattern.y + coord.y).toFixed(2));
                        let t = null;
                        if (gcode.params['T']) {
                            t = gcode.params['T'];
                        } else {
                            t = tapData.pattern.t;
                        }
                        tapData.coords.push({ x, y, t });
                    }
                    l_pattern.x = x;
                }
                tapData.pattern.status = PATTERN_STATUS_END;
                break;

            case 'G37': // G37: GRID (GRD-Y): X축으로 간격이 같고 Y으로도 간격이 같은 그리드 가공, 작업시 Y축으로 먼저 가공
                if (tapData.pattern.code === 'P01') {
                    // G72를 통한 패턴 위치 설정이 아닌 경우, 즉, P01X356.66Y295.T212(RO3.3)의 형태의 경우 coords의 최상단 제거
                    tapData.coords.pop();
                }
                tapData.pattern.code = 'G37'; // 패턴 코드 저장
                tapData.pattern.status = PATTERN_STATUS_BEGIN;
                l_pattern = { x: tapData.pattern.x, y: tapData.pattern.y };
                // P: X방향 Spaces
                for (let i = 0; i <= Math.abs(gcode.params['P']); i++) {
                    let x, y;
                    logger.trace(tapData.pattern);
                    // K: Y방향 Spaces
                    for (let j = 0; j <= Math.abs(gcode.params['K']); j++) {
                        const coord = { x: 0, y: 0 };
                        coord.x = gcode.params['I'] * i;
                        coord.y = gcode.params['J'] * j;
                        coord.y = i % 2 === 0 ? gcode.params['J'] * j : -gcode.params['J'] * j;
                        x = parseFloat((l_pattern.x + coord.x).toFixed(2));
                        y = parseFloat((l_pattern.y + coord.y).toFixed(2));
                        let t = null;
                        if (gcode.params['T']) {
                            t = gcode.params['T'];
                        } else {
                            t = tapData.pattern.t;
                        }
                        tapData.coords.push({ x, y, t });
                    }
                    l_pattern.y = y;
                }
                tapData.pattern.status = PATTERN_STATUS_END;
                break;

            case 'G50': // G50: 프로그램 끝.
                logger.trace(gcode.command);
                // 기준좌표 초기화: 디버그를 위해서 초기화 하지 않는다.!!!
                // tapData.pattern = { x: 0, y: 0 };
                // tapData.origin = { x: 0, y: 0, t: null, mode: null, code: null };
                break;

            case 'G66': // Shear Proof Slotting / No-Slug Window (제품의 쉐어링 . 및사각형 홀의 가공) / 탭핑과 무관
            case 'G67': // Rectangluar Cut-Out (사각형의 홀을 가공) / 탭핑과 무관
            case 'G68': // Nibbling Arc (얇은 판제의 큰홀가공 또는 코너 라운드 가공) / 탭핑과 무관
            case 'G69': // Nibbling Line (얇은 판제의 펀칭라인 가공) / 탭핑과 무관
                break;

            case 'G70': // G70 [PUNCH OFF]: 펀치무시, 테이블만 이동: G70X500.Y500.T212(RO3.3)
                // 패턴 기준 좌표로 입력 처리
                tapData.pattern.x = gcode.params['X'];
                tapData.pattern.y = gcode.params['Y'];
                // 패턴의 툴 정보 입력 처리
                if (gcode.params['T'] !== null && gcode.params['T'] !== undefined) {
                    tapData.pattern.t = gcode.params['T'];
                }
                logger.trace('#### G70 pattern...', tapData.pattern);
                break;

            case 'G72': // G72: 패턴의 기준점 지정, G72G90X50.55Y10.T212(RO3.3)
                tapData.pattern.x = gcode.params['X'];
                tapData.pattern.y = gcode.params['Y'];

                // grshin: 2025-01-24
                // origin 정보 저장: G72에 대한 origin 좌표 저장
                // tapData.origin.x = gcode.params['X'];
                // tapData.origin.y = gcode.params['Y'];
                if (gcode.params['T'] !== null && gcode.params['T'] !== undefined) {
                    tapData.pattern.t = gcode.params['T'];
                }
                tapData.pattern.mode = gcode.params['G']; // G90: 절대좌표, G91: 상대좌표
                tapData.pattern.status = PATTERN_STATUS_SET_ORIGIN;
                logger.trace(
                    'pattern x: ' + tapData.pattern.x + ' y: ' + tapData.pattern.y + ' t: ' + tapData.pattern.t,
                );
                logger.trace('#### pattern...', tapData.pattern);
                logger.trace('#### gcode...', gcode);
                break;

            case 'G78': // Punchin Arc (두꺼운 판제의 큰홀 가공 또는 코너 라운드 가공) / 탭핑과 무관
            case 'G79': // Punchin Line (두꺼운 판제의 펀칭 라인 가공) / 탭핑과 무관
                break;

            case 'G90': // G90: 절대 좌표 입력: G90X100.Y100.T230(RO5.0)
                break;
            case 'G91': // G91: 상대 좌표 입력: G91X100.Y100.T230(RO5.0)
                break;

            case 'G92': // 기계 원점 설정
                break;

            case 'G93': // 원점 재설정 (상대좌표)
                tapData.origin.x = parseFloat(gcode.params['X']);
                tapData.origin.y = parseFloat(gcode.params['Y']);
                break;

            default:
                break;
        }
    });

    ///
    // post porocess:
    // tool 번호 별로 tap 좌표 모으기. tap => [t: 212, coords {x, y}]
    tapData.taps.forEach((tap, i) => {
        tapData.coords.forEach((coord, j) => {
            logger.trace(coord);
            if (tap.t === coord.t) {
                tap.coords.push({ x: coord.x, y: coord.y });
            } else {
                if (tap.t === null && (coord.t === null) | (coord.t === undefined)) {
                    tap.coords.push({ x: coord.x, y: coord.y });
                }
            }
        });
    });

    // 좌표값이 없는 항목 필터
    tapData.taps = tapData.taps.filter((item) => item.coords.length > 0);

    // response date 복사
    responseData.info = tapData.info.map((data) => data);
    responseData.taps = tapData.taps.map((data) => data);

    // NESTED-AREA 정보를 PART-SZIE 정보로 변경
    responseData.info = processPartSize(responseData.info, 'NESTED-AREA', 'PART-SIZE');
    logger.debug('#### processPartSize', responseData.info);

    if (responseData.taps.length === 0) {
        errorCodes.push(GCODE_R_NO_TAPS_INFO);
    }

    // TODO: G코드 내 주석으로 툴정보가 없을 경우, 툴이 없는 것으로 처리하였으나, 추후 조건을 변경해야 함
    tapData.taps.forEach((tap, i) => {
        if (tap.t === null) {
            errorCodes.push(GCODE_R_NO_TOOLS_INFO);
        }
    });

    if (errorCodes.length === 0) {
        errorCodes.push(GCODE_R_OK);
    }

    errorCodes.forEach((code) => {
        const error = errorMessages.find((err) => err.errorCode === code);
        if (error) {
            responseData.errors.push(error);
        }
    });

    logger.debug('######## extractTappingInfo');
    logger.debug(tapData);
    logger.debug(responseData);

    return responseData;
};
