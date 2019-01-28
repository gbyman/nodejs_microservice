const cluster = require('cluster'); //cluster 모듈 로드
const http = require('http');   //http 모듈 로드
const numCPUs = require('os').cpus().length;    
//CPU 코어 수만큼 자식 프로세스를 실행하려고 
//os 모듈을 이용해 코어수를 알아 옴

if (cluster.isMaster) { //부모 프로세스일 경우
    //cluster 모듈의 isMaster 값을 이용해 부모 프로세스와 자식 프로세스 구분
    console.log('Master ${process.pid} is running');

    for (let i = 0; i < numCPUs; i++){  //부모 프로세스라면 코어 수 만큼 자식 프로세스 실행
        cluster.fork();
    }

    cluster.on('exit', (Worker, code, signal) => {  //자식 프로세스 종료 이벤트 감지
        //fork 함수를 이용해 실행된 자식 프로세스가 종료되면 부모 프로세스에서 이를 감지할 수 있도록 exit 이벤트 설정
        console.log('worker ${worker.process.pid} died')
    });
} else {    //자식 프로세스로 실행되었다면 http모듈을 이용해 HTTP 서버 실행
    http.createServer((req, res) => {
        res.writeHead(200);
        res.end('hello world\n');
    }).listen(8000);

    console.log('Worker ${process.pid} started');
}