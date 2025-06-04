const net = require('net');

const HOST = '127.0.0.1';
const PORT = 20002;

const server = net.createServer((socket) => {
    console.log('Client connected');

    socket.on('data', (data) => {
        console.log('Received from client:', data.toString());
        socket.write('Acknowledged'); // 응답 보내기
    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });

    socket.on('error', (error) => {
        console.error('Socket Error:', error.message);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`TCP Server running at ${HOST}:${PORT}`);
});
