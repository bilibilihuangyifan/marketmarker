
var myArgs = process.argv.slice(2);
var config=require('./' + (myArgs[0] || 'btc.json'));
var MD5 = require('./md5.js');
var API_KEY = require('./apikey.json');
var api_key = API_KEY.apikey;
var secret_key  = API_KEY.secretkey;
var URL = config.URL;
var initCounter = config.initCounter;
var baseInfo = config.baseInfo;

var gatewaysLength = baseInfo.length ;
var currencys = new Array(gatewaysLength);
var Lines = new Array(gatewaysLength);
var Frees = new Array(gatewaysLength);
var flagShowOrders = new Array(gatewaysLength);

var sellOrders = new Array(gatewaysLength);
var buyOrders = new Array(gatewaysLength);

for(var i=0; i<gatewaysLength; i++){
	currencys[i] = baseInfo[i].currency;
	Lines[i] = 0;
	Frees[i] = 0;
	flagShowOrders[i] = true;
}
Lines[0] = 1;
Frees[0] = 1;


var request = require('request');
var WebSocket = require('ws');
var OK = new WebSocket(URL);
OK.on('close',function(){ console.log('the connection closed!'); });


OK.on('open', function () {
  console.log('connected to OKcoin');
  OKorderinfo(1);
  setInterval(function () {
    OKorderinfo(1);
  }, 6000);
});
function OKorderinfo(i){
		sellOrders[i] = [];
		buyOrders[i] = [];
		//console.log(currencys[i]+"_"+currencys[0]);
		var params = {
			"api_key" : api_key,
			"order_id": -1,
			"symbol" : currencys[i]+"_"+currencys[0]
		};
		var sign = "";
		for (var key in params) {
		  sign += key + "=" + params[key] + "&";
		}
		sign = sign + "secret_key=" + secret_key;
		params.sign = MD5.MD5(sign);
		request.post( {
			url: 'https://www.okex.com/api/v1/order_info.do',
			headers: {
			  'User-Agent': 'OKCoinNodejs/v1',
			  'contentType':'application/x-www-form-urlencoded'
			},
			encoding:'utf8',
			form:params
		  },
		  function(error, response, body){
			//console.log(error, response, body);
			if (error) console.log('OKorderinfo error:',error,response);
			if (body) {
				//console.log(body);
				dumpOrder(JSON.parse(body).orders,i);
				if (i === gatewaysLength-1) {
					setTimeout(OKuserinfo,500);
				}else{
					setTimeout(function(){
						OKorderinfo(i+1);
					},200);
				}
			}
		}
		);
}

function sortRuleS(a,b){
	if (a[1]<b[1]) { return 1;
	}else{ return -1; }

}
function sortRuleB(a,b){
	if (a[1]<b[1]) { return 1;
	}else{ return -1; }
}
function dumpOrder(orders, k){
	//console.log(orders);
	for (var j=0; j< orders.length; j++){
		var order = orders[j];
		//console.log(order);
		var id = order.order_id;
		var price = order.price;
		var amount = order.amount;
		var deal_amount = order.deal_amount;
		var real_amount = amount - deal_amount;
		if (order.type === 'buy'){
			buyOrders[k].push([id, price, real_amount]);
		}else if (order.type === 'sell'){
			sellOrders[k].push([id, price, real_amount]);
		}
		buyOrders[k].sort(sortRuleS);
		sellOrders[k].sort(sortRuleB);
	}
}
function cancelOrder(i, seq){
	console.log('cancel order',seq);
	var symbol = currencys[i]+'_'+currencys[0];
	var order_id = seq;
    var sign = MD5.MD5("api_key="+api_key +
			"&order_id="+String(order_id)+
            "&symbol="+symbol +
            "&secret_key="+secret_key);
    var MES = {
        "event": "addChannel",
        "channel": "ok_spot_cancel_order",
        "parameters" : {
            "api_key" : api_key,
            "sign" : sign,
            "symbol" : symbol,
            "order_id" : order_id
        }
    };
    OK.send(JSON.stringify(MES));
}

function OKspottrade(type,price,amount,symbol){
    var sign = MD5.MD5("amount="+String(amount) +
            "&api_key="+api_key +
            "&price="+String(price) +
            "&symbol="+symbol +
            "&type="+type +
            "&secret_key="+secret_key);
    var MES = {
        "event": "addChannel",
        "channel": "ok_spot_order",
        "parameters" : {
            "api_key" : api_key,
            "sign" : sign,
            "symbol" : symbol,
            "type" : type,
            "price" : price,
            "amount" : amount
        }
    };
    OK.send(JSON.stringify(MES));
}
function OKuserinfo() {
    var sign = MD5.MD5("api_key="+api_key +
            "&secret_key="+secret_key);
    var MES = {
        "event": "addChannel",
        "channel": "ok_spot_userinfo",
        "parameters" : {
            "api_key" : api_key,
            "sign" : sign
        }
    };
    OK.send(JSON.stringify(MES));
}
function RESuserinfo(data) {
	for (var i=0; i<gatewaysLength; i++){
		Lines[i] = -1;
		Frees[i] = -1;
	}
	//console.log(data);
    var funds = data.info.funds;
    var free = funds.free;
    var freezed = funds.freezed;
	//console.log(funds);
	for (i=0; i<gatewaysLength; i++){
		Lines[i] = parseFloat(free[currencys[i]]) + parseFloat(freezed[currencys[i]]);
		Frees[i] = parseFloat(free[currencys[i]]);
	}
	//console.log(Lines);
	for (i=0; i<gatewaysLength; i++){
		if (Lines[i] < 0) {
			console.log('negtive balance????');
			return 0;
		}
	}
	Analyse();
}
OK.on('message', function (message) {
  //console.log(message);
  var mes = JSON.parse(message);
  if (mes.hasOwnProperty("result")) {
    var RES = mes.result;
    var a = 0;
    for (var f in RES) {
      a = 1;
      break;
    }
    if (a === 1) messageOK(RES);
  } else {
    messageOK(mes);
  }
});
function messageOK(RES){
    //console.log(RES.length);
    //console.log(RES);
    //console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    if (RES.hasOwnProperty("event")) {
        console.log(RES.event);
        return;
    }
    var mes = RES[0];
    if (mes.hasOwnProperty("data")){
        var channel = mes.channel;
        var data = mes.data;
        //console.log(channel);
        if (channel === 'ok_spot_userinfo') {
            RESuserinfo(data);
        }else if (channel ==='ok_spot_cancel_order') {
			//console.log(data.result);
            if (data.result !== true) console.log(data);
        }else if (channel ==='ok_spot_order'){
            if (data.result !== true) console.log(data);
            //console.log(data);
		}

    }else if (mes.hasOwnProperty("errorcode")){
        console.log('OKcoin ERROR:  ', mes.errorcode);
    }else {
        console.log('Unexpected message:');
        console.log(RES);
        throw Error('Unexpected message');
    }
}

var flagShow = 1;
function Analyse(){
	var diff = 0;

	for (var t=1; t<gatewaysLength; t++){
		//console.log('Lines',Lines[t]);
		//console.log('Free',Frees[t]);
		//console.log('t',t);
		var initPrice = baseInfo[t].initPrice;
		var lowLimit = baseInfo[t].lowLimit;
		var highLimit = baseInfo[t].highLimit;
		var gap = baseInfo[t].gap;
		var rate = baseInfo[t].rate;
		var initBase = baseInfo[t].initBase;
		var tradeAmount = baseInfo[t].tradeAmount;
		var orderLength = baseInfo[t].orderLength;
		//console.log('orders:',buyOrders[t],sellOrders[t]);
		var initbuy = - gap;
		var initsell = gap;
		var balanceState = (initBase - Lines[t])/tradeAmount;

		var balanceStateBuy = balanceState;
		var buyDecimal = balanceStateBuy - Math.floor(balanceStateBuy);
		if (buyDecimal < 0.2) {
			buyDecimal = buyDecimal + 1;
			balanceStateBuy = Math.floor(balanceStateBuy);
		}else{
			balanceStateBuy = Math.ceil(balanceStateBuy);
		}
		var buyAounmt = buyDecimal * tradeAmount;
		var buyPower = initbuy + balanceStateBuy;
		var buyPrice = initPrice * Math.pow(rate, buyPower);

		var balanceStateSell = balanceState;
		var sellDecimal = Math.ceil(balanceStateSell) - balanceStateSell;
		if (sellDecimal < 0.2){
			sellDecimal = sellDecimal + 1;
			balanceStateSell = Math.ceil(balanceStateSell);
		}else{
			balanceStateSell = Math.floor(balanceStateSell);
		}
		var sellAounmt = sellDecimal * tradeAmount;
		var sellPower = initsell + balanceStateSell;
		var sellPrice = initPrice * Math.pow(rate, sellPower);
		if (buyPrice < lowLimit || sellPrice > highLimit) { console.log('impossible price!!'); continue; }
		diff = diff + (balanceState)*tradeAmount*sellPrice;

		if (flagShowOrders[t]){
			console.log('******************  orders in ',currencys[t]+'/'+currencys[0],'market *******************');
			for (var id= 0; id <sellOrders[t].length; id++){
				console.log('sell @', sellOrders[t][id][1],'for',sellOrders[t][id][2], currencys[t]);
			}
			console.log('----------------------------------------------');
			for (id=0; id< buyOrders[t].length; id++){
				console.log('buy: @', buyOrders[t][id][1], 'for',buyOrders[t][id][2],currencys[t]);
			}
			console.log('----------------------------------------------');
			console.log(currencys[0],Lines[0],currencys[1],Lines[1]);
			console.log('you should have ',initCounter+diff,currencys[0]);
			flagShowOrders[t] = false;
		}
		if (orderLength === 0) continue;//escape if orderLength is 0
		//console.log(buyAounmt,sellAounmt);
		var buyTarget = [];
		var sellTarget = [];
		if (orderLength !== 0){
			buyTarget.push([buyPrice, buyAounmt]);
			sellTarget.push([sellPrice, sellAounmt]);
		}else{
			continue;
		}
		for (var i=1; i < orderLength; i++){
			sellTarget.push([sellPrice * Math.pow(rate,i), tradeAmount]);
			buyTarget.push([buyPrice * Math.pow(rate,-i), tradeAmount]);
		}
		//console.log(balanceState, buyrate, buyPrice);
		if (Frees[t] < 1.2*tradeAmount) {
			if (flagShow) console.log('not enough '+currencys[t]+' to create orders !');
		}else{
			checkMyOrders(t, sellOrders[t], sellTarget, 'sell');
		}
		if (Frees[0] < tradeAmount*buyPrice) {
			console.log('not enough '+currencys[0]+' !');
		}else{
			checkMyOrders(t, buyOrders[t], buyTarget, 'buy');
		}
	}
	if (flagShow) {
		flagShow = 0;
	}
}

function checkMyOrders(ID, orders, targetOrders, type){
	//console.log('checkMyOrders',ID,type);

	var order, seq, target, price, amount;
	var temp = [];
	for (var j =0; j < targetOrders.length; j++){
		temp.push(targetOrders[j]);
	}
	var uselessOrdersID = [];
	for (var i=0; i < orders.length; i++){
		order = orders[i];
		seq = order[0];
		var myPrice = order[1];
		var myIOUAmount = order[2];
		var flagUseless = 1;
		for (j=0; j < temp.length; j++){
			target = temp[j];
			price = target[0];
			amount = target[1];
			if ( (Math.abs(myPrice/price - 1) < 0.0001) &&  (Math.abs(myIOUAmount/amount - 1) < 0.001) ) {
				temp.splice(j,1);
				flagUseless = 0;
				break;
			}
		}
		if (flagUseless) uselessOrdersID.push(seq);
	}
	for (j=0; j < uselessOrdersID.length; j++) cancelOrder(ID,uselessOrdersID[j]);
	//if (temp.length !== 0) console.log(type , temp);
	for (j=0; j < temp.length; j++){
		target = temp[j];
		price = target[0];
		amount = target[1];
		//createMarketOrders(ID,type, price, amount);
		console.log('try to create: ',type,price,amount,currencys[ID]+'_'+currencys[0]);
		flagShowOrders[ID] = true;
		OKspottrade(type,price,amount,currencys[ID]+'_'+currencys[0]);
	}
}
