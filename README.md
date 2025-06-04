# React, Electron, better-sqlite3, tcp/ip 환경으로 Tapping 로봇과 연동합니다.

## 환경 준비

-   Node.js를 설치합니다. v22.12.0
-   Electron을 설치합니다. v33.3.1 이상

## 사용 가능한 스크립트

디버깅을 위한 스크립트

### `yarn start`

-   개발 모드로 실행되며 Electron 환경에서 localhost:3000에 접속하여 React 앱이 구동됩니다.

설치파일을 만들기 위한 스크립트

### `yarn electron-pack`

-   Electron 환경으로 설치 파일 형태로 패키징 됩니다.
-   패키징 파일은 dist 폴더에 생성됩니다.

## 로봇 에뮬레이터 구동

cmd 창에서 robot/drl/폴더로 이동하여
python emulate_tapbot.py 명령을 실행합니다.

## g-code 파일

-   robot/gcode-files/AMI-ALLUX-OLD-001-1605-TAP-TEST-G CODE.TXT
