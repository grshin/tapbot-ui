export function getCurrentTime1() {
    return new Date().toLocaleTimeString();
}

export function getCurrentTime(mode = 'ISO') {
    if (mode == 'LOCALE') {
        const now = new Date();
        const date = now.toLocaleDateString(); // 년-월-일 형식
        const time = now.toLocaleTimeString(); // 시:분:초 형식
        return `${date} ${time}`; // 합친 문자열 반환
    } else if (mode == 'ISO') {
        const date = new Date().toISOString();
        return date;
    }
}
