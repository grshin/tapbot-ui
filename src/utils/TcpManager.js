// TCP 통신 매니저 모듈
import net from 'net';

class TcpManager {
    static instance = null;

    constructor() {
        if (TcpManager.instance) {
            return TcpManager.instance;
        }

        this.client = null;
        this.host = '127.0.0.1'; // 서버 IP
        this.port = 8080; // 서버 포트
        this.isConnected = false;
        this.listeners = [];

        TcpManager.instance = this;
    }

    // 싱글톤 인스턴스 반환
    static getInstance() {
        if (!TcpManager.instance) {
            TcpManager.instance = new TcpManager();
        }
        return TcpManager.instance;
    }

    // 서버 연결
    connect() {
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();

            this.client.connect(this.port, this.host, () => {
                this.isConnected = true;
                console.log('Connected to server');
                resolve();
            });

            this.client.on('data', (data) => {
                const message = data.toString();
                console.log('Received:', message);
                this.notifyListeners(JSON.parse(message));
            });

            this.client.on('error', (err) => {
                console.error('Connection error:', err);
                this.isConnected = false;
                reject(err);
            });

            this.client.on('close', () => {
                console.log('Connection closed');
                this.isConnected = false;
            });
        });
    }

    // 서버 연결 해제
    disconnect() {
        if (this.client && this.isConnected) {
            this.client.end();
            this.isConnected = false;
            console.log('Disconnected from server');
        }
    }

    // 서버에 데이터 전송
    send(data) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('Not connected to server'));
            }

            const jsonData = JSON.stringify(data);
            this.client.write(jsonData, 'utf8', () => {
                console.log('Sent:', jsonData);
                resolve();
            });
        });
    }

    // 상태 변경 리스너 추가
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    // 상태 변경 리스너 제거
    removeListener(callback) {
        this.listeners = this.listeners.filter((listener) => listener !== callback);
    }

    // 리스너들에게 데이터 전송
    notifyListeners(data) {
        this.listeners.forEach((listener) => listener(data));
    }
}

export default TcpManager;

// React 컴포넌트에서 사용하는 방법 예시
// import TcpManager from "./TcpManager";
// const tcpManager = TcpManager.getInstance();

// useEffect(() => {
//   tcpManager.connect().then(() => {
//     console.log("Connected to TCP server");
//   });

//   tcpManager.addListener((data) => {
//     console.log("Received data:", data);
//   });

//   return () => {
//     tcpManager.disconnect();
//   };
// }, []);
