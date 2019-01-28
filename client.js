//클라이언트의 기본 기능인 접속, 데이터 수신, 데이터 발송 세 가지 기능으로 구성
//자식 클래스에서는 접속(connect)과 데이터 발송(write)함수에만 접근
//데이터 수신은 수신을 완료하면 생성자에서 전달한 함수로 콜백

'use strict';   //Strict 모드 사용, 문법에 기초적인 실수가 있을 때, 실행 시점에 에러 표시

const net = require('net');

class tcpClient {    //tcpClient 클래스 선언
    //생성자
    constructor(host, port, onCreate, onRead, onEnd, onError) {
        //constructor 키워드를 이용해 생성자를 선언할 수 있는데
        //접속 정보, 접속 완료, 데이터 수신, 접속 종료, 에러 발생 이벤트가 생길 때
        //콜백될 함수들을 파라미터로 선언한다.
        this.options = {
            host: host,
            port: port
        };
        this.onCreate = onCreate;
        this.onRead = onRead;
        this.onEnd = onEnd;
        this.onError = onError;
    }

    connect(){  // 접속 처리 함수, 생성자에서 전달받은 접속 정보로 접속
        this.client = net.connect(this.options, () => {
            if (this.onCreate)
                this.onCreate(this.options);    
                //접속 완료 이벤트 콜백, 서버에 접속되면 생성자에서 전달받은 콜백 함수로 접속 완료 이벤트 알려준다
        });

        this.client.on('data', (data) => {  //연결된 소켓을 이용해 데이터가 수신되면 데이터 수신 처리
            // 이 때 모든 패킷은 JSON 형태로 구성하고 마지막에 ¶문자 붙이도록 정의
            // TCP 특성상 한번 수신할 때 여러 패킷을 합쳐서 수신할 수 있기 때문에 패킷별로 구분해서 처리하기 위함
            var sz = this.merge ? this.merge + data.toString() : data.toString();
            var arr = sz.split('¶');
            for (var n in arr) {
                if(sz.charAt(sz.length - 1) != '¶' && n == arr.length -1){
                    this.merge = arr[n];
                    break;
                } else if (arr[n] == "") {
                    break;
                } else {
                    this.onRead(this.options, JSON.parse(arr[n]));
                }
            }
        });

        this.client.on('close', () => { //접속 처리와 동일한 패턴으로 접속 종료 처리
            if (this.onEnd)
                this.onEnd(this.options);
        });

        this.client.on('error', (err) => {  //에러 발생 처리
            if (this.onError)
                this.onError(this.options, err);
        });
    }

    //데이터 발송
    write(packet) {
        this.client.write(JSON.stringify(packet) + '¶');
    }

}

module.exports = tcpClient; //외부에서 참조할 수 있도록 exports 한다