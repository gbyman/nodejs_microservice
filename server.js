// 서버 역할을 하는 클래스
// 서버의 기본 기능인 리슨, 데이터 수신, 클라이언트 접속 관리 외에 클라이언트 클래스(tcpClient)를 
// 이용해 Distributor에 주기적으로 접속을 시도하는 기능(connectToDistributor)을 구현

'use strict';

const net = require('net');
const tcpClient = require('./client.js'); //Client 클래스 참조

//Server 클래스
class tcpServer { //클래스 선언
    constructor(name, port, urls){  //생성자 파라미터로 서버명과 리슨 포트, 처리할 주소 목록을 입력받는다
        this.logTcpClient = null; //로그 관리 마이크로서비스 연결용 tcpClient 변수 선언

        //서버 상태 정보
        this.context = {    //서버 정보를 저장
            port: port,
            name: name,
            urls: urls
        }
        this.merge = {};
        // 서버 객체 생성
        this.server = net.createServer((socket) => {    
            this.onCreate(socket);      //클라이언트 접속 이벤트 처리

            socket.on('error', (exception) => { //에러 이벤트 처리
                this.onClose(socket);
            });
            socket.on('close', () => {  //클라이언트 접속 종료 이벤트 처리
                this.onClose(socket);
            });
            socket.on('data', (data) => {   //데이터 수신 이벤트
                //클라이언트에서 데이터가 수신되면 클라이언트 클래스에서 한것 처럼 패킷 처리
                var key = socket.remoteAddress + ":" + socket.remotePort;
                var sz = this.merge[key] ? this.merge[key] + data.toString() : data.toString();
                var arr = sz.split('¶');
                for (var n in arr) {
                    if (sz.charAt(sz.length - 1) != '¶' && n == arr.length - 1) {
                        this.merge[key] = arr[n];
                        break;
                    } else if (arr[n] == ""){
                        break;
                    } else {
                        this.writeLog(arr[n]);  //request 로그
                        this.onRead(socket, JSON.parse(arr[n]));
                    }
                }
            });
        });

        this.server.on('error', (err) => {  //서버 객체에 대한 에러 처리
            console.log(err);
        });

        this.server.listen(port, () => {    //생성자 파라미터로 전달받은 포트 정보로 리슨
            console.log('listen', this.server.address());
        });
    }

    onCreate(socket) {
        console.log("onCreate", socket.remoteAddress, socket.remotePort);
    }

    onClose(socket) {
        console.log("onClose", socket.remoteAddress, socket.remotePort);
    }

    //Distributor에 접속하기 위해 connectToDistributor 함수를 선언하고, 
    //파라미터로 접속 정보와 Distributor에 접속했을 때 콜백받을 함수를 전달 받는다.
    connectToDistributor(host, port, onNoti){   //Distributor 접속 함수
        var packet = {  //Distributor에 전달할 패킷 정의
            uri: "/distributes",
            method: "POST",
            key: 0,
            params: this.context
        };
        var isConnectedDistributor = false; //Distributor 접속 상태를 저장

        this.clientDistributor = new tcpClient( //Client 클래스 인스턴스 생성
            host
            , port
            , (options) => {    //Distributor 접속 이벤트
                //접속이 완료되면 접속 상태를 true로 변경하고 미리 만들어 놓은 패킷을 전달
                isConnectedDistributor = true;
                this.clientDistributor.write(packet);
            }
            , (option, data) => { 
                //로그 관리 마이크로서비스 연결
                if(this.logTcpClient == null && this.context.name != 'logs'){
                    for (var n in data.params){
                        const ms = data.params[n];
                        if(ms.name == 'logs'){
                            this.connectToLog(ms.host, ms.port);
                            break;
                        }
                    }
                }
                
                onNoti(data); }    //Distributor 데이터 수신 이벤트, 
            //Distributor에서 데이터가 수신되면 함수의 파라미터로 전달받은 콜백 함수를 호출
            , (options) => {isConnectedDistributor = false; }   //Distributor 접속 종료 이벤트, 접속 상태를 false로 변경
            , (options) => {isConnectedDistributor = false; }   //Distributor 에러 이벤트, 접속 상태를 false로 변경
        );

        setInterval(() => { //주기적인 Distributor 재접속 시도,
            //Distributor를 아직 실행하지 않았거나 접속이 종료되면 3초 간격으로 재접속 시도
            if (isConnectedDistributor != true) {
                   this.clientDistributor.connect(); 
            }
        }, 3000);
    }

    connectToLog(host, port) {  //로그 관리 마이크로서비스 연결
        //Distributor에서 로그 관리 마이크로서비스가 접속했다는 정보를 받으면
        //접속 정보를 이용해 로그 관리 마이크로서비스로 접속을 시도
        this.logTcpClient = new tcpClient(
            host
            , port
            , (options) => { }
            , (options) => { this.logTcpClient = null; }
            , (options) => { this.logTcpClient = null; }
        );
        this.logTcpClient.connect();
    }

    writeLog(log){  //로그 패킷 전달
        //API가 호출되면 자식 프로세스에 전달하기 전에 먼저 로그 관리 마이크로서비스로 로그를 전달
        //이 때 아직 로그 관리 마이크로서비스가 준비되지 않았다면 화면에 로그를 출력
        if(this.logTcpClient) {
            const packet = {
                uri: "/logs",
                method: "POST",
                key: 0,
                params: log
            };
            this.logTcpClient.write(packet);
        } else {
            console.log(log);
        }
    }
}

module.exports = tcpServer;     //exports 선언