'use strict'

const http = require('http');
const url = require('url');
const querystring = require('querystring');

//Distributor에서 마이크로서비스들의 정보를 받아 와 처리하는 로직
const tcpClient = require('./client');  //1. HTTP 게이트웨이가 마이크로서비스들과 통신하려고 Client 클래스 참조

var mapClients = {};
var mapUrls = {};
var mapResponse = {};
var mapRR = {};
var index = 0;

var server = http.createServer((req, res) => { //http 서버 생성
    var method = req.method;
    var uri = url.parse(req.url, true);
    var pathname = uri.pathname;
    //http는 메서드에 따라 파라미터를 읽어 들이는 방식이 다르기 때문에 각각 처리
    //POST와 PUT에서 data와 end 이벤트를 이용해 파라미터를 읽는다.
    //이 때 콘텐츠 타입이 application/json 이라면 파라미터가 JSON 형식의 스트링이므로 JSON.parse 함수를 이용
    //아니라면 querystring 모듈의 parse 함수를 이용해 파라미터를 읽는다
    //GET과 DELETE 메서드는 url모듈을 이용해 파싱
    //모든 메서드에서 파라미터를 읽어 들였으면 메서드 정보와 API 주소 입력 파라미터를 onRequest 함수로 전달
    if (method === "POST" || method === "PUT") {    //POST, PUT 메서드 처리

        var body = "";

        req.on('data', function(data) {
            body += data;
        });
        req.on('end', function(){
            var params;
            //헤더가 application/json 일 때는 JSON으로 파싱
            if (req.headers['content-type'] == "application/json") {
                params = JSON.parse(body);
            } else {//헤더가 JSON이 아니면 querystring으로 파싱
                params = querystring.parse(body);
            }

            onRequest(res, method, pathname, params);
        });
        
    } else {//GET과 DELETE 메서드에서는 url 모듈을 이용해 파싱
        //모든 메서드에서 파라미터를 읽어 들였으면 메서드 정보와 API 주소 입력 파라미터를 onRequest 함수로 전달
        onRequest(res, method, pathname, uri.query)
    }
}).listen(8000, () => {
    console.log('listen', server.address());

    //Distributor와 통신 처리
    var packet = {  //2. Distributor 전달 패킷
        //HTTP 게이트웨이를 Distributor에 등록하는 패킷을 구성
        uri: "/distributes",
        method: "POST",
        key: 0,
        params: {
            port:8000,
            name: "gate",//임의의 이름인 gate 설정
            urls: []
        }
    };
    
    var isConnectedDistributor = false;
    
    this.clientDistributor = new tcpClient( //3. Distributor 접속용 Client 클래스의 인스턴스를 생성
        // Distributor와 HTTP 게이트웨이는 물리적으로 다른 장비에서 실행하는 것이 좋지만
        //개발 편의상 로컬에서 Distributor, HTTP 게이트웨이, 마이크로서비스 모두 실행
        "127.0.0.1"
        , 9000
        , (options) => {    //4. Distributor 접속 완료 이벤트
            //Distributor에 접속하면 isConnectedDistributor를 true로 설정하고 2.에서 만들어 놓은 패킷리 전달
            isConnectedDistributor = true;
            this.clientDistributor.write(packet);
        }
        , (options, data) => { onDistribute(data); }    //5. Distributor 데이터 수신 이벤트
        //Distributor에서 정보가 전달되면 onDistribute 함수에서 처리
        , (options) => { isConnectedDistributor = false; }  //6. Distributor 접속 종료 이벤트
        , (options) => { isConnectedDistributor = false; }  //7. Distributor 에러 이벤트
        //접속을 종료하거나 에러가 발생하면 isConnectedDistrubutor를 false로 변경
    );
    
    //주기적인 Distributor 접속 상태 확인
    setInterval(() => { //8. Distributor 재접속
        //HTTP 게이트웨이를 Distributor보다 먼저 실행하거나 Distributor가 실행을 중단하면 재접속 기능을 추가
        //3초 간격으로 isConnectedDistributor 값이 false이면 Distributor로 접속을 시도
        if(isConnectedDistributor != true) {
            this.clientDistributor.connect();
        }
    }, 3000);
});


//API 호출 처리
function onRequest(res, method, pathname, params){  //요청 정보 처리
    var key = mehtod + pathname;
    var client = mapUrls[key];
    //HTTP 게이트웨이로 API 요청이 오면 현재 처리 가능한 마이크로서비스 API들을 확인해서
    if(client == null){ //처리 가능한 API만 처리
        res.writeHead(404);
        res.end();
        return;
    } else {
        params.key = index; //처리 가능한 API에 대해 해당 마이크로서비스를 호출하기 전에 고유키 발급(API 호출에 대한 고유키 값 설정)
        //고유키를 패킷에 담아 전달하고, 마이크로서비스는 받은 키를 그대로 응답 패킷에 담아 주는 방식
        var packet = {
            uri: pathname,
            method: method,
            params: params
        };

        mapResponse[index] = res;   //마이크로서비스에서 온 응답을 전달하려고 http의 응답 객체 저장
        index++;    //유일성을 보장할 수 있도록 고유키 값 증가

        if(mapRR[key] == null)  //라운드 로빈 처리
        //동일한 API를 처리하는 마이크로서비스 여러 개를 고르게 호출하기 위해 라운드 로빈 인덱스 값을 증가
            mapRR[key] = 0;
        mapRR[key]++;
        client[mapRR[key] % client.length].write(packet);   //접속된 마이크로서비스로 API를 호출
    }

}

//Distributor 접속 처리
function onDistribute(data) {   //9. Distributor 데이터 수신 처리
    //onDistribute로 Distributor에서 현재 접속 가능한 마이크로서비스 목록이 전달
    for (var n in data.params) {
        var node = data.params[n];
        var key = node.host + ":" + node.port;
        if (mapClients[key] == null && node.name != "gate") {
            var client = new tcpClient(node.host, node.port, onCreateClient, onReadClient, onEndClient, onErrorClient);

                mapClients[key] = { //10. 마이크로서비스 연결 정보 저장
                    //접속하지 않은 마이크로서비스에 대해 Client클래스 인스턴스를 생성
                    //접속 주소로 key를 만들어 mapClient에 인스턴스를 저장
                    client: client,
                    info: node
                };
                for (var m in node.urls) {  //11. 마이크로서비스 URL 정보 저장
                    //처리 가능한 URL들을 mapUrls에 저장
                    var key = node.urls[m];
                    if(mapUrls[key] == null) {
                        mapUrls[key] = [];
                    }
                    mapUrls[key].push(client);
                }
                client.connect();
        }
    }
}

//마이크로서비스 접속 이벤트 처리
function onCreateClient(options) {
    console.log("onCreateClient");
}

//마이크로서비스 응답 처리
//마이크로서비스가 API를 처리한 후 응답하면 onReadClient 함수로 전달
function onReadClient(options, packet){//마이크로 서비스 응답
    console.log("onReadClient", packet);
    mapResponse[packet.key].writeHead(200, {'Content-Type': 'application/json'});
    mapResponse[packet.key].end(JSON.stringify(packet));
    delete mapResponse[packet.key]; //응답 객체를 찾아 응답한 후에 응답 객체 삭제
}


function onEndClient(options) { //12. 마이크로서비스 접속 종료 처리
    //마이크로서비스가 장애등으로 접속을 종료하면 10, 11에서 등록한 정보 삭제
    var key = options.host + ":" + options.port;리
    console.log("onEndClient", mapClients[key]);
    for(var n in mapClients[key].info.urls) {
        var node = mapClients[key].info.urls[n];
        delete mapUrls[node];
    }
    delete mapClients[key];
}

//마이크로서비스 접속 에러 처리
function onErrorClient(options) {
    console.log("onErrorClient");
}