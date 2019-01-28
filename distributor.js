//map 오브젝트를 선언하고 Server 클래스를 상속받아 접속한 클라이언트의 정보를 저장
'use strict'

//노드 접속 관리 오브젝트
var map = {};

//Server 클래스 상속
class distributor extends require('./server.js') { 
    constructor() {
        //Server 클래스 생성자 호출
        //생성자에 이름과 포트 번호, 처리 가능한 프로토콜 정보를 전달
        super("distributor", 9000, ["POST/distributes", "GET/distributes"]); 
    }

    //노드가 접속하면 onCreate 함수를 호출
    //접속한 노드의 소켓에 현재 접속 중인 노드들의 정보를 보낸다
    //노드가 접속을 종료하면 onClose 함수를 호출
    //map 오브젝트에 저장한 해당 노드의 정보를 삭제하고, 접속한 모든 노드에 최신 상태의 정보를 전파
    onCreate(socket){   // 접속 노드 이벤트 처리
        console.log("onCreate", socket.remoteAddress, socket.remotePort);
        this.sendInfo(socket);
    }

    onClose(socket) {   //노드 접속 해제 이벤트 처리
        var key = socket.remoteAddress + ":" + socket.remotePort;
        console.log("onClose", socket.remoteAddress, socket.remotePort);
        delete map[key];
        this.sendInfo();
    }

    //노드에서 데이터를 수신하면 onRead 함수 호출
    //소켓 정보에서 호스트 정보와 포트 정보를 획득해 키를 만들어
    //map 오브젝트에 저장
    //노드에서 받은 정보 이외에 호스트 정보도 추가
    //저장이 완료되면 접속된 모든 노드에 최신 정보를 전파
    onRead(socket, json){   //데이터 수신, 노드 등록 처리
        var key = socket.remoteAddress + ":" + socket.remotePort;      //키 생성
        console.log("onRead", socket.remoteAddress, socket.remotePort, json);

        if (json.uri == "/distributes" && json.method == "POST") {  //노드 정보 등록
            map[key] = {
                socket: socket
            };
            map[key].info = json.params;
            map[key].info.host = socket.remoteAddress;
            this.sendInfo();    //접속한 노드에 전파
        }
    }

    //패킷 전송
    write(socket, packet){
        socket.write(JSON.stringify(packet) + '¶')
    }

    //노드 접속 또는 특정 소켓에 노드 접속 정보 전파
    sendInfo(socket) {  
        var packet = {
            uri: "/distributes",
            method: "GET",
            key: 0,
            params: []
        };

        for (var n in map) {
            packet.params.push(map[n].info);
        }

        if (socket) {
            this.write(socket, packet);
        } else {
            for (var n in map) {
                this.write(map[n].socket, packet);
            }
        }
    }
}

//distributor 객체 생성
new distributor();