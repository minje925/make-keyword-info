var express = require('express');
var router = express.Router();
var path = require('path')
var request = require('request');
var utf8 = require('axios')
var CryptoJS = require('crypto-js');
const { rejects } = require('assert');
const cheerio = require('cheerio'); // 웹크롤링을 위한 라이브러리
const { resolve } = require('path');
const moment = require('moment');
const { data } = require('cheerio/lib/api/attributes');
const readline = require('readline');
const fs = require('fs');

// 연관키워드 API 요청을 위한 정보
var method = "GET";
var accessKey = "0100000000ad4ba1cb0d7771a195757e227aed9d61d6c191bfe12c3913b45f08adfb237b63";
var secretKey = "AQAAAACtS6HLDXdxoZV1fiJ67Z1hRnataGZB9c3ikgo+tLU+3A==";
var customer_id = '2267997'
var api_url = '/keywordstool'

// 카테고리와 가격을 가져오기 위한 API 정보
var client_id = "Oi6e85tRU0W5d9M2CAu0"
var client_secret = "TSpaZPOVqN"


var array = [] // 전체데이터를 저장하는 배열

const get_Relkeyword = function (keyword) {
    return new Promise((resolve, reject) => {
        var url = 'https://api.naver.com/keywordstool?hintKeywords=' + encodeURIComponent(keyword) + '&showDetail=1';
        //console.log("요청 키 : "+keyword);
        var timestamp = Date.now() + '';
        var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
        hmac.update(timestamp + '.' + method + '.' + api_url);
        var hash = hmac.finalize();
        hash.toString(CryptoJS.enc.Base64);
        key_data = [];

        request.get({
            uri: url,
            encodeing: null,
            headers: {
                'X-Timestamp': timestamp,
                'X-API-KEY': accessKey,
                'X-API-SECRET': secretKey,
                'X-CUSTOMER': customer_id,
                'X-Signature': hash.toString(CryptoJS.enc.Base64)
            }
        }, function (err, res, body) {
            let data = JSON.parse(body) //json으로 파싱
            //console.log(body);
            if (err == null) {
                array.push({
                    title: data["keywordList"][0]["relKeyword"],
                    pccnt: data["keywordList"][0]["monthlyPcQcCnt"],
                    mocnt: data["keywordList"][0]["monthlyMobileQcCnt"],
                    totalcnt: data["keywordList"][0]["monthlyMobileQcCnt"] + data["keywordList"][0]["monthlyPcQcCnt"],
                    category: null,
                    salecnt_6month: null,
                    salecnt_1date: null,
                    postingcnt: null,
                    section: null,
                    sec1_score: null,
                    sec2_score: null,
                });
                if (data["keywordList"].length == 0)
                    key_data.push([0, 0, 0, 0, 0, 0, 0]);
                for (var i = 0; i < data["keywordList"].length; i++) {
                    key_data.push([data["keywordList"][i]["relKeyword"], data["keywordList"][i]["monthlyPcQcCnt"], data["keywordList"][i]["monthlyMobileQcCnt"], data["keywordList"][i]["monthlyPcQcCnt"] + data["keywordList"][i]["monthlyMobileQcCnt"],
                    data["keywordList"][i]["monthlyAvePcCtr"], data["keywordList"][i]["monthlyAveMobileCtr"], data["keywordList"][i]["compIdx"], data["keywordList"][i]["plAvgDepth"]]);
                }
            }
            else {
                console.log("Error.");
            }
            resolve(key_data);
        });
    });
}

const get_Category = function(keyword) {
    return new Promise((resolve, reject) => {
        var api_url = "https://openapi.naver.com/v1/search/shop?query=" + encodeURIComponent(keyword) + "&display=1";
        var options = {
            url: api_url,
            headers: { 'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret }
        };

        request.get(options, function(err, res, body){
            if(!err && res.statusCode == 200) {
                let data = JSON.parse(body);
                cate = category(data);
                //console.log(cate);
                resolve(cate);
            }
            else {
                console.log('카테고리 요청 에러.');
            }
        });
    });
}

const get_ViewCnt = function(keyword) {
    return new Promise((resolve, reject) => {
        var api_url = "https://openapi.naver.com/v1/search/webkr.json?query=" + encodeURIComponent(keyword) + "&display=1";
        var options = {
            url: api_url,
            headers: { 'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret }
        };

        request.get(options, function(err, res, body){
            if(!err && res.statusCode == 200) {
                let data = JSON.parse(body);
                //console.log("View 개수 : ", data['total']);;
                resolve(data['total']);
            }
            else {
                console.log('웹문서 요청 에러.');
            }
        });
    });
}

function category(jsondata) {
    // 카테고리를 합쳐주는 함수
    cate = []
    for(var i = 0; i < jsondata['items'].length; i++) {
        if(jsondata['items'][i]['category4'] != '')
            cate.push(jsondata['items'][i]['category1']+">"+jsondata['items'][i]['category2']+">"+jsondata['items'][i]['category3']+">"+jsondata['items'][i]['category4']);
        else
            cate.push(jsondata['items'][i]['category1']+">"+jsondata['items'][i]['category2']+">"+jsondata['items'][i]['category3']);
        //console.log(cate);
    }
    return cate;
}

async function get_saleCnt(keyword) {
    const { Builder, By, Key, until } = require('selenium-webdriver');
    var page = 1;
    let url = 'https://search.shopping.naver.com/search/all?frm=NVSHCHK&origQuery=' + encodeURI(keyword) + 'pagingIndex=' + page + '&pagingSize=20&productSet=checkout&query=' + encodeURI(keyword) + '&sort=rel&timestamp=&viewType=list';
    data_sale = [];

    let driver = await new Builder()
        .forBrowser('chrome')
        .build();
    await driver.get(url); 
    let userAgent = await driver.executeScript("return navigator.userAgent;")

    // 스크롤
    for (var i = 0; i < 100; i++) {
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
    };
    let resultElements = await driver.findElements(By.css('div.basicList_etc_box__1Jzg6 > a:nth-child(2) > em'));
    //console.log(resultElements,"dd..");
    for (var i = 0; i < resultElements.length; i++) {
        Str_data = await resultElements[i].getText();
        //console.log(Str_data);
        data_sale.push(Str_data);
    }
    driver.quit();

    return data_sale;
}

async function get_section(keyword) {
    const { Builder, By, Key, until } = require('selenium-webdriver');
    let url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query='+ encodeURI(keyword);
    data_section = [];

    let driver = await new Builder()
        .forBrowser('chrome')
        .build();
    await driver.get(url); 
    let userAgent = await driver.executeScript("return navigator.userAgent;")
    let resultElements = await driver.findElements(By.className('menu'));

    console.log(resultElements.length);
    for (var i = 1; i < 5; i++) {
        Str_data = await resultElements[i].getText();
        //console.log(Str_data);
        data_section.push(Str_data);
    }

    driver.quit();
    total_str = data_section[0]+">"+data_section[1]+">"+data_section[2]+">"+data_section[3];
    //console.log(total_str);
    return total_str;
}

function get_section2(keyword) {
    return new Promise((resolve, reject) => {
        let url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=' + encodeURI(keyword);
        let data = [];
        request(url, function (err, res, html) {
            if (!err) {
                var $ = cheerio.load(html, { xmlMode: true });
                
                data.push($('ul.base li:nth-child(2)').text());
                data.push($('ul.base li:nth-child(3)').text());
                data.push($('ul.base li:nth-child(4)').text());
                data.push($('ul.base li:nth-child(5)').text());
                resolve(data);
            }
            else {
                console.log('section 요청 실패.');
            }
        });
    });
}


function get_sum(data) {
    var sum = 0;
   
    for(i=0; i<data.length; i++) {
        data[i] = Number(data[i].replace(',',""));
        sum = sum+data[i];
    }
    return sum;
}


var index = 0;
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.on("line", function (key) {
    console.log("입력된 키워드 :", key);
    key = key.split(" ");
    //    excute(key[index]);
    
    load(key);
}).on("close", function () {
    
    process.exit();
});

const timer = ms => new Promise(res=>setTimeout(res, ms));
async function load(key2) {
    for(var k = 0; k < key2.length; k++) {
        console.log(key2[index], "에 대한 검색");
        await excute(key2[index]); 
        await timer(4000);
    }
}

// 전체적인 기능!! 실행하기!
async function excute(keyword) {
    get_Relkeyword(keyword).then(value => {
        return get_Category(keyword);
    })
        .then(value => {
            array[index]['category'] = value[0];
            return get_ViewCnt(keyword);
        })
        .then(value => {
            array[index]['postingcnt'] = value;
            return get_saleCnt(keyword);
        })
        .then((value) => {
            sum = get_sum(value)
            array[index]['salecnt_6month'] = sum;
            array[index]['salecnt_1date'] = (sum / 180).toFixed(2);

            return get_section2(keyword);
        })
        .then(value => {
            array[index]['section'] = value;

            switch(value[0]) {
                case "쇼핑":
                    array[index]['sec1_score'] = 5;
                    break;
                case "VIEW":
                    array[index]['sec1_score'] = 4;
                    break;
                case "지식iN":
                    array[index]['sec1_score'] = 3;
                    break;
                case "이미지":
                    array[index]['sec1_score'] = 2;
                    break;
                case "동영상":
                    array[index]['sec1_score'] = 2;
                    break;
                case "어학사전":
                    array[index]['sec1_score'] = 1;
                    break;
            }
            switch(value[1]) {
                case "쇼핑":
                    array[index]['sec2_score'] = 5;
                    break;
                case "VIEW":
                    array[index]['sec2_score'] = 4;
                    break;
                case "지식iN":
                    array[index]['sec2_score'] = 3;
                    break;
                case "이미지":
                    array[index]['sec2_score'] = 2;
                    break;
                case "동영상":
                    array[index]['sec2_score'] = 2;
                    break;
                case "어학사전":
                    array[index]['sec2_score'] = 1;
                    break;
            }
            
            if (index == 0) {
                fs.appendFile('C:\\Users\\minje\\OneDrive - knu.ac.kr\\바탕 화면\\yj_project\\yi-joon-webpages\\ouput.csv', "키워드, 피시검색수, 모바일검색수, 총검색수,카테고리, 6개월판매량, 1일판매량, 포스팅수, 섹션순서, 1섹션점수, 2섹션점수" + "\n"
                    , function (err, sample) {
                        if (err) {
                            return console.log(err);
                        }
                        //console.log(data);
                    });
            } 
            
            fs.appendFile('C:\\Users\\minje\\OneDrive - knu.ac.kr\\바탕 화면\\yj_project\\yi-joon-webpages\\ouput.csv', "\uFEFF" + array[index]['title'] + "," + array[index]['pccnt']
                + "," + array[index]['mocnt']
                + "," + array[index]['totalcnt']
                + "," + "\uFEFF" + array[index]['category']
                + "," + array[index]['salecnt_6month']
                + "," + array[index]['salecnt_1date']
                + "," + array[index]['postingcnt']
                + "," + array[index]['section'][0] + ">" + array[index]['section'][1] + ">" + array[index]['section'][2] + ">" + array[index]['section'][3]
                + "," + array[index]['sec1_score']
                + "," + array[index]['sec2_score']
                + "\n"
                , function (err, sample) {
                    if (err) {
                        return console.log(err);
                    }
                    //console.log(data);
                });
            
            //array = [];
            //keyword = "";
            console.log(array);
            console.log("'"+array[index]['title']+"' get Information.");
            index = index+1;
        });
}
