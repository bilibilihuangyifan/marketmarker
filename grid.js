
var myArgs = process.argv.slice(2);
var config = require('./' + (myArgs[0] || 'btc.json'));
var API_KEY = require('./apikey.json');
var apikey = API_KEY.apikey;
var secretkey = API_KEY.secret;
var URL = config.URL;
var ccxt = require('ccxt');
var bitmex = new ccxt['bitmex']({
	apiKey: apikey,
	secret: secretkey,
	enableRateLimit: true
});
bitmex.urls['api'] = bitmex.urls['test'] //switch the base URL to testnet
var bitmexsymbol = ['XBTU18'];
var initCounter = config.initCounter;
var baseInfo = config.baseInfo;

var gatewaysLength = baseInfo.length;//做网格的货币数量
var currencys = new Array(gatewaysLength);
var Lines = new Array(gatewaysLength);
var Frees = new Array(gatewaysLength);
var flagShowOrders = new Array(gatewaysLength);

var sellOrders = new Array(gatewaysLength);
var buyOrders = new Array(gatewaysLength);

for (var i = 0; i < gatewaysLength; i++) {
	currencys[i] = baseInfo[i].currency;
	Lines[i] = 0;
	Frees[i] = 0;
	flagShowOrders[i] = true;
}
Lines[0] = 1;
Frees[0] = 1;



function sortRuleS(a, b) {
	if (a[1] < b[1]) {
		return 1;
	} else { return -1; }

}
function sortRuleB(a, b) {
	if (a[1] < b[1]) {
		return 1;
	} else { return -1; }
}
start();
function start() {
	//setInterval(Analyse, 1000);//关键函数
	fetchtickers();
	
}

function fetchtickers() {
	console.log('get bitmex orderinfo:');
	getorderinfo(1);
	setInterval(function () {
		getorderinfo(1);
	}, 20000);
}

function getorderinfo(i) {

	bitmex.fetchOpenOrders().then(async function (res) {
		sellOrders[i] = [];
		buyOrders[i] = [];
		var orders = res;
		dumpOrder(orders, i);//获取该货币的所有订单信息,并加载到内存
		if (i === gatewaysLength - 1) {
			RESuserinfo();
		} else {
				getorderinfo(i + 1);//轮询到下一个货币
		}
	});
}
function dumpOrder(orders, k) {//获取现有的订单	，并载入内存
	var maxbuy=0;
	var minsell=99999;
	for (var i in orders) {
		var order = orders[i];
		//console.log(order.id, order.side, order.price, order.amount, order.filled);
		var id = order.id;
		var price = order.price;
		var amount = order.amount;
		var deal_amount = order.filled;
		var real_amount = amount - deal_amount;
		if (order.side === 'buy') {		
				buyOrders[k].push([id, price, real_amount]);
				if(maxbuy<price)maxbuy=price;
		}else if (order.side === 'sell') {
				sellOrders[k].push([id, price, real_amount]);
				if(minsell>price)minsell=price;
		}
		buyOrders[k].sort(sortRuleS);
		sellOrders[k].sort(sortRuleB);
	}
	if((maxbuy>0)&&(buyOrders[k].length<3)){//有买单被吃
		initPrice=maxbuy+delta;
		console.log('maxbuy',maxbuy);
	}
	if((minsell<99999)&&(sellOrders[k].length<3)){
		initPrice=minsell-delta;
		console.log('minsell',minsell);
	}
	console.log('buyOrders', buyOrders[k].length);
	console.log('sellOrders', sellOrders[k].length);
	console.log('initPrice',initPrice);
}
function cancelOrder(i, seq) {
	var symbol = bitmexsymbol[0];
	var order_id = seq;
	console.log('cancel order', seq, symbol);
	bitmex.cancelOrder(order_id)
}

function OKspottrade(side, price, amount, symbol) {
	console.log(side, price, amount, symbol)
	bitmex.createOrder(symbol = symbol, type = 'limit', side = side, amount = amount, price = price);
}

function RESuserinfo() {
	for (var i = 0; i < gatewaysLength; i++) {
		Lines[i] = -1;
		Frees[i] = -1;
	}
	bitmex.fetchBalance().then(async function (res) {//等效写法 (res) =>
		var myBalance = res;
		console.log('currency', 'free', '\t\t', 'used', '\t\t', 'total');
		Object.keys(myBalance).forEach(function (key, i, v) {
			var symbol = myBalance[key];//账户数量
			if (key.trim() === 'BTC') {
				console.log(key, '\t', parseFloat(symbol.free), '\t', parseFloat(symbol.used),
					'\t', parseFloat(symbol.total));
				console.log('USDT', '\t', 6500 * parseFloat(symbol.free), '\t', 6500 * parseFloat(symbol.used),
					'\t', 6500 * parseFloat(symbol.total));
				Lines[0] = 6500 * (parseFloat(symbol.free) + parseFloat(symbol.used));
				Lines[1] = (parseFloat(symbol.free) + parseFloat(symbol.used));
				Frees[0] = 6500 * (parseFloat(symbol.free));
				Frees[1] = (parseFloat(symbol.free));
			}
		});

		//console.log(Lines);
		for (i = 0; i < gatewaysLength; i++) {
			console.log(i, currencys[i], Lines[i]);
			if (Lines[i] < 0) {
				console.log('negtive balance????');
				return 0;
			}
		}
		Analyse();
	});


}


var flagShow = 1;
var initPrice =0;
var gap =0;
var delta=0
function Analyse() {
	var diff = 0;

	for (var t = 1; t < gatewaysLength; t++) {
		//console.log('Lines',Lines[t]);
		//console.log('Free',Frees[t]);
		//console.log('t',t);
		if(initPrice==0)
		{
		   initPrice = baseInfo[t].initPrice;
		   gap = baseInfo[t].gap;
		   delta=initPrice * gap;
		}		
		var lowLimit = baseInfo[t].lowLimit;
		var highLimit = baseInfo[t].highLimit;		
		var rate = baseInfo[t].rate;
		var initBase = baseInfo[t].initBase;
		var tradeAmount = baseInfo[t].tradeAmount;
		var orderLength = baseInfo[t].orderLength;
		console.log('initprice:',initPrice);
	 
	
		var buyAounmt = tradeAmount;
		
		var buyPrice = initPrice -delta;
		
		var sellAounmt = tradeAmount;
		var sellPrice = initPrice +delta;
		if (buyPrice < lowLimit || sellPrice > highLimit) { console.log('impossible price!!'); continue; }

		if (flagShowOrders[t]) {//
			console.log('******************  orders in ', currencys[t] + '' + currencys[0], 'market *******************');
			for (var id = 0; id < sellOrders[t].length; id++) {
				console.log('sell @', sellOrders[t][id][1], 'for', sellOrders[t][id][2], currencys[t]);
			}
			console.log('----------------------------------------------');
			for (id = 0; id < buyOrders[t].length; id++) {
				console.log('buy: @', buyOrders[t][id][1], 'for', buyOrders[t][id][2], currencys[t]);
			}
			console.log('----------------------------------------------');
			console.log(currencys[0], Lines[0], currencys[1], Lines[1]);
			console.log('you should have ', initCounter + diff, currencys[0]);//initcounter=1.01
			flagShowOrders[t] = false;
		}
		if (orderLength === 0) continue;//escape if orderLength is 0
		//console.log(buyAounmt,sellAounmt);
		var buyTarget = [];
		var sellTarget = [];
	
		for (var i = 0; i < orderLength; i++) { //创建三级订单
			sellTarget.push([sellPrice +i*delta, tradeAmount]);
			buyTarget.push([buyPrice -i*delta, tradeAmount]);
		}
		console.log(6500 * Frees[t], tradeAmount, Frees[0], buyPrice);
		if (6500 * Frees[t] < 1.2 * tradeAmount) {
			if (flagShow) console.log('not enough ' + currencys[t] + ' to create orders !');
		} else {
			checkMyOrders(t, sellOrders[t], sellTarget, 'sell');
		}
		if (6500 * Frees[0] < tradeAmount * buyPrice) {
			console.log('not enough ' + currencys[0] + ' !');
		} else {
			checkMyOrders(t, buyOrders[t], buyTarget, 'buy');
		}
	}
	if (flagShow) {
		flagShow = 0;
	}
}

function checkMyOrders(ID, orders, targetOrders, type) {
	//console.log('checkMyOrders',ID,type);

	var order, seq, target, price, amount;
	var temp = [];//tmp就是计划创建的订单
	for (var j = 0; j < targetOrders.length; j++) {
		temp.push(targetOrders[j]);
	}
	var uselessOrdersID = [];
	var newOrders=[]
	for (var i = 0; i < orders.length; i++) {
		order = orders[i];
		seq = order[0];//orderid
		var myPrice = order[1].toFixed(0);
		var myIOUAmount = order[2].toFixed(0);
		var side=order[3];
		var flagUseless = 1;
		for (j = 0; j < temp.length; j++) {
			target = temp[j];
			price = target[0].toFixed(0);
			amount = target[1].toFixed(0);
			if ((Math.abs(myPrice / price - 1) < 0.0001) && (Math.abs(myIOUAmount / amount - 1) < 0.001)) {
				temp.splice(j, 1);//移除已存在的不必要创建的订单
				flagUseless = 0;
				break;
			}
		}
		if (flagUseless) //被成交的订单
		{
			
			uselessOrdersID.push(seq);//生成没有用的订单id
		}
	}
	console.log('having orders',orders); 
	console.log('need create orders',temp); 
	//console.log('uselessOrdersID',uselessOrdersID);//取消无用订单
	for (j = 0; j < uselessOrdersID.length; j++) 
	{
		console.log('cancelOrder',ID, uselessOrdersID[j]);
		try{
		cancelOrder(ID, uselessOrdersID[j]);}
		catch(err)
		{
			console.log('cancelOrder--err:',err);
		}
	} 
	//if (temp.length !== 0) console.log(type , temp);
	for (j = 0; j < temp.length; j++) {
		target = temp[j];
		price = target[0];
		amount = target[1];
		
		//createMarketOrders(ID,type, price, amount);
		console.log('try to create: ', type, price, amount, bitmexsymbol[0]);
		flagShowOrders[ID] = true;
		OKspottrade(type, price.toFixed(0), amount.toFixed(0), bitmexsymbol[0]);
	}
}
