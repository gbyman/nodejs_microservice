const mysql = require('mysql');
const conn = {
    host : 'localhost',
    user : 'micro',
    password : 'service',
    database : 'monolothic',
    multipleStatements: true    // 상품 등록 후 아이디를 알아 오려고 설정
    //데이터베이스에 상품 정보를 저장한 후 고유 아이디 값을 조회하려고 여러 쿼리를 실행할수 있도록 설정 추가
};

const redis = require("redis").createClient();  //redis 모듈 코드
//redis 모듈을 로드하고 createClient 함수를 이용해 Redis 서버와 통신할 수 있는 인스턴스 생성
//redis 모듈 인스턴스가 하나만 필요하므로 동시에 처리

redis.on("error", function (err) {  //Redis 에러 처리
    console.log("Redis Error " + err);
});

// 상품 관리의 각 기능별로 분기
exports.onRequest = function (res, method, pathname, params, cb) {

    switch (method) {   //메서드별로 기능 분기
        case "POST":    //메서드별 처리
            return register(method, pathname, params, (response) => {process.nextTick(cb, res, response); });
        case "GET":
            return inquiry(method, pathname, params, (response) => {process.nextTick(cb, res, response); });
        case "DELETE":
            return unregister(method, pathname, params, (response) => {process.nextTick(cb, res, response); });
        default:
            return process.nextTick(cb, res, null); //정의되지 않은 메서드면 null 리턴
    }

}

// 상품 등록 기능
// @param method 메서드
// @param pathname URI
// @param params 입력 파라미터
// @param cb 콜벡

function register(method, pathname, params, cb) {
    var response = {
        errorcode: 0,
        errormessage: "success"
    };

    if(params.name == null || params.category == null || params.price == null || params.description == null) {  //유효성 검사 
        response.errorcode = 1;
        response.errormessage = "Invalid Parameters";
        cb(response);
    } else {
        var connection = mysql.createConnection(conn);
        connection.connect();
        //데이터 베이스에 상품 정보를 저장하고 자동 증가되는 고유값을 알아 오기 위해 쿼리문 수정
        //상품 아이디 조회 추가 
        connection.query("insert into goods(name, category, price, description) values(? ,? , ?, ?); select LAST_INSERT_ID() as id;"
        , [params.name, params.category, params.price, params.description]
        , (error, results, fields) => {
            if (error) {    //mysql 에러 처리
                response.errorcode = 1;
                response.errormessage = error;
            } else { //데이터베이스에 정상적으로 저장하면 Redis에도 상품 정보 저장
                //Redis의 기본 기능인 키-값 저장 기능을 이용해 키는 상품 아이디로 저장하고, 값은 상품정보로 저장장
                const id = results[1][0].id;
                redis.set(id, JSON.stringify(params));  //Redis 등록
            }
            cb(response);
        });
        connection.end();
    }
}

// 상품 조회 기능
// @param method 메서드
// @param pathname URI
// @param params 입력 파라미터
// @param cb 콜백

function inquiry(method, pathname, params, cb) {
    var response = {
        errorcode: 0,
        errormessage: "success"
    };

    var connection = mysql.createConnection(conn);
    connection.connect();
    connection.query("select * from goods", (error, results, fields) => {
        if (error || results.length == 0){
            response.errorcode = 1;
            // 등록된 상품이 없을 때 처리
            response.errormessage = error ? error : "no data";
        } else {
            response.results = results;
        }
        cb(response);
    });
    connection.end();
}

// 상품 삭제 기능
// @param method 메서드
// @param pathname URI 
// @param params 입력 파라미터
// @param cb 콜벡

function unregister(method, pathname, params, cb) {
    var response = {
        errorcode: 0,
        errormessage: "success"
    };

    if (params.id == null) {
        response.errorcode = 1;
        response.errormessage = "Invalid Parameters";
        cb(response);
    } else {
        var connection = mysql.createConnection(conn);
        connection.connect();
        connection.query("delete from goods where id = ?"
            , [params.id]
            , (error, results, fields) => {
                if (error) {
                    response.errorcode = 1;
                    response.errormessage = error;
                } else {
                    redis.del(params.id);   //상품을 삭제하면 Redis에도 상품 정보 삭제
                }
                cb(response);
            });
            connection.end();
    }
}