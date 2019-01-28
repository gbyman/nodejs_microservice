const mysql = require('mysql');
const conn = {
    host: 'localhost',
    user: 'micro',
    password: 'service',
    database: 'monolithic'
};

const redis = require("redis").createClient();  //redis 모듈 로드하고 인스턴스 생성

redis.on("error", function (err) {  //Redis 에러 처리
    console.log("Redis Error" + err);
});

//구매 관리의 각 기능별로 분기
exports.onRequest = function (res, method, pathname, params, cb){
    switch (method){
        case "POST":
            return register(method, pathname, params, (response) => {process.nextTick(cb, res, response); });
        case "GET":
            return inquiry(method, pathname, params, (response) => {process.nextTick(cb, res, response); });
        case "DELETE":
            return unregister(method, pathname, params, (response) => {process.nextTick(cb, res, response); });
        default:
            return process.nextTick(cb, res, null);
    }
}

// 구매 기능
// @param method 메서드
// @param pathname URI
// @param params 입력 파라미터
// @param cb 콜백
function register(method, pathname, params, cb){
    var response = {
        key: params.key,
        errorcode: 0,
        errormessage: "success" 
    };

    if (params.userid == null || params.goodsid == null) {
        response.errorcode = 1;
        response.errormessage = "Invalid Parameters";
        cb(response);
    } else {
        redis.get(params.goodsid, (err, result) => { //Redis에 상품 정보 조회
            //상품 구매 정보를 데이터베이스에 저장하기 전 Redis에 상품 정보가 있는지 확인하고
            //상품 정보가 없으면 에러를 리턴
            if (err || result == null) {
                response.errorcode = 1;
                response.errormessage = "Redis failure";
                cb(response);
                return;
            }
        

        var connection = mysql.createConnection(conn);
        connection.connect();
        connection.query("insert into purchases(userid, goodsid) values(?, ?)"
                        , [params.userid, params.goodsid]
                        , (error, results, fields) => {
                            if(error) {
                                response.errorcode = 1;
                                response.errormessage = error;
                            }
                            cb(response);
                        });
        connection.end();

    });
    }
}

// 구매 내역 조회 기능
// @param method 메서드
// @param pathname URI
// @param params 입력 파라미터
// @param cb 콜백
function inquiry(method, pathname, params, cb){
    var response = {
        key: params.key,
        errorcode: 0,
        errormessage: "success"    
    };

    if (params.userid == null) {
        response.errorcode = 1;
        response.errormessage = "Invalid Parameters";
        cb(response);
    } else {
        var connection = mysql.createConnection(conn);
        connection.connect();
        connection.query("select id, goodsid, date from purchases where userid = ?"
                        , [params.userid]
                        , (error, results, fields) => {
                            if (error) {
                                response.errorcode = 1;
                                response.errormessage = error;
                            } else {
                                response.results = results;
                            }
                            cb(response);
                        });
                        connection.end();
    }
}