'use strict';

const business = require('./monolithic_goods.js');  //비즈니스 로직 파일 참조
const cluster = require('cluster'); //클러스터 모듈 로드

class goods extends require('./server.js') {    //Server 클래스 상속
    constructor() {
        //생성자에서 부모 클래스의 생성자를 호출해 서비스명, 포트정보, 처리가능한 URL정보를 전달
        super("goods"   //초기화, 부모 클래스 생성자 호출
            , process.argv[2] ? Number(process.argv[2]) : 9010
            , ["POST/goods", "GET/goods", "DELETE/goods"]
        );

        //Server 클래스의 connectToDistributor 함수를 이용해 Distributor 접속
        //호스트 정보와 포트 정보는 설정 파일을 이용해 별도로 관리하는 것이 일반적
        //이해하기 쉽게 코드에 직접 작성
        this.connectToDistributor("127.0.0.1", 9000, (data) => {    //Distributor 접속
            console.log("Distributor Notification", data);
        });
    }

    //API에 대한 요청이 왔을 때 비지니스 로직을 호출하는 부분
    //마이크로 서비스로 패킷이 들어오면  onRead 함수 호출
    //클라이언트 접속 정보와 패킷 정보를 화면에 출력하고 비지니스 로직을 호출해 
    //응답 패킷을 클라이언트에 전달
    onRead(socket, data) {  //onRead 구현, 클라이언트 요청에 따른 비지니스 로직 호출
        console.log("onRead", socket.remoteAddress, socket.remotePort, data);
    
         //비지니스 로직 호출
        business.onRequest(socket, data.method, data.uri, data.params, (s, packet) => {
            socket.write(JSON.stringify(packet) + '¶'); //응답패킷 전송
            });
    }
}


//생성자 완성되었기 때문에 인스턴스 정상적으로 생성할 수 있음
if (cluster.isMaster) { //부모 프로세스에서 자식 프로세스 실행
    cluster.fork();

    //자식 프로세스에서 exit 이벤트가 발생하면 새로운 자식 프로세스 실행
    cluster.on('exit', (Worker, code, signal) => {
        console.log('worker ${worker.process.pid died');
        cluster.fork();
    });
} else {
    new goods();    //인스턴스 생성
}