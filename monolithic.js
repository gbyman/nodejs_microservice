const http = require('http');
const url = require('url'); //url module load
const querystring = require('querystring'); //querystring module load

//모듈들  로드
const members = require('./monolithic_members.js'); 
const goods = require('./monolithic_goods.js');
const purchases = require('./monolithic_purchases.js');

//HTTP 서버를 만들고 요청 처리
var server = http.createServer((req,res) => {
    var method = req.method;    //get method
    var uri = url.parse(req.url, true);
    var pathname = uri.pathname;    //get URI

    if (method == "POST" || method == "PUT") {
        var body = "";

        req.on('data', function(data){
            body += data;
        });
        req.on('end', function () {
            var params;
            // 헤더 정보가 json이면 처리
            if (req.headers['content-type'] == "application.json") {
                params = JSON.parse(body);
            } else {
                params = querystring.parse(body);
            }

            onRequest(res, method, pathname, params);
        });
    } else {
        // GET과 DELETE이면 query 정보를 읽음
        onRequest(res, method, pathname, uri.query);
    }
}).listen(8000);

// 요청에 대해 회원 관리, 상품 관리, 구매 관리 모듈별로 분기
// @param res       response 객체
// @param method    메서드
// @param pathname  URI
// @param params    입력 파라미터
function onRequest(res, method, pathname, params){  //기능별로 호출
    res.end("response!");

    switch(pathname) {
        case "/members":
            members.onRequest(res, method, pathname, params, response);
            break;
        case "/goods":
            goods.onRequest(res, method, pathname, params, response);
            break;
        case "/purchases":
            purchases.onRequest(res, method, pathname, params, response);
            break;
        default:
            res.writeHead(404);
            return res.end();   //정의되지 않은 요청에 404 에러 리턴
    }
}

// HTTP 헤더에 JSON 형식으로 응답
// @param res      response 객체
// @param packet   결과 파라미터
function response(res, packet){ //JSON 형식의 응답
    res.writeHead(200, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify(packet));
}