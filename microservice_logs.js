'use strict';

const cluster = require('cluster');

class logs extends require('./server.js') {
    constructor() {
        super("logs"    // POST/logs 한 가지 기능만 가지도록 함, 로그 입력만 구현
            , process.argv[2] ? Number(process.argv[2]) : 9040
            , ["POST/logs"]
        );

        this.connectToDistributor("127.0.0.1", 9000, (data) => {
            console.log("Distributor Notification", data);
        });
    }

    onRead(socket, data) {  //로그가 입력되면 화면에 출력
        //API가 호출되면 화면에는 시간과 접속한 마이크로서비스의 주소 정보, 입력한 로그 출력
        const sz = new Date().toLocaleString() + '\t' + socket.remoteAddress + '\t' +
                    socker.remotePort + '\t' + JSON.stringify(data) + '\n';
        console.log(sz);
    }
}

if (cluster.inMaster) {
    cluster.fork();

    cluster.on('exit', (Worker, code, signal) => {
        console.log('worker ${worker.process.pid} died');
        cluster.fork();
    });
} else {
    new logs();
}