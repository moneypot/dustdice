define([    'lib/react',    'highcharts-theme',    'game-logic/engine',    'game-logic/clib',    'stores/game-settings'], function (    React,    HighCharts,    Engine,    Clib,    GameSettings){    //WARNING: For some reason this file is not debuggable, errors are always at the first line, Follow the trace    var D = React.DOM;    var MAX_NUM_POINTS = 20;    var MAX_MEM_NUM_POINTS = 280;    var MARKER_RADIUS = 8;    var MEDIUM_MARKER_RADIUS = 12;    var BIG_MARKER_RADIUS = 18;    function formatEngineState(state) {        if(state.wager)            state.wagerBitsFloor = Clib.satToBitFloored(state.wager);        if(state.balance)            state.balanceBits = Clib.satToBit(state.balance);    }    return React.createClass({        displayName: 'Graph',        chart: null,        componentDidMount: function () {            Engine.on('new-wager', this._onWagerChange);            Engine.on('new-win-chances', this._onWagerChange);            //Engine.on('bet-sent', this._onNewBet);            Engine.on('bet-end', this.onBetFinished);            Engine.on('history-clear', this._onHistoryClear);            Engine.on('new-balance', this._refreshBalance);            //GameSettings.on('set-graph-right-margin', this._onExtremesChange);            this.chart = createChart(this.refs.graphBox.getDOMNode());        },        componentWillUnmount: function () {            Engine.off('new-wager', this._onWagerChange);            Engine.off('new-win-chances', this._onWagerChange);            //Engine.off('bet-sent', this._onNewBet);            Engine.off('bet-end', this.onBetFinished);            Engine.off('history-clear', this._onHistoryClear);            Engine.off('new-balance', this._refreshBalance);            //GameSettings.off('set-graph-right-margin', this._onExtremesChange);            this.chart.destroy();        },        //_onExtremesChange: function () {        //    this._setExtremes(true);        //},        shouldComponentUpdate: function (nextProps, nextState) {            return false;        },        _onHistoryClear: function () {            this.chart.destroy();            this.chart = createChart(this.refs.graphBox.getDOMNode());        },        _onWagerChange: function () {            if (!this.isMounted())                return;            var chartLength = this.chart.series[2].data.length - 1;            var chartIndex = this.chart.series[2].data[this.chart.series[2].data.length - 1].x;            this.updateProjections(chartLength, chartIndex);        },        //When a bet is finished the engine set the result of the bet in the event        //Other way the state could change and we get a wrong state        onBetFinished: function (game) {            formatEngineState(game);            //Create the new point and add it without redrawing            var newPoint;            var dataLabelStyle = {                enabled: true,                format: '{point.outcome}',                y: 10,                color: '#000000',                style: {                    fontSize: '16px',                    fontWeight: 'bold'                    //fill: '#000000'                }            };            var chartLength = this.chart.series[2].data.length; //The real length of the chart            var chartIndex = this.chart.series[2].data[this.chart.series[2].data.length - 1].x + 1;            if (game.profit > 0)                newPoint = {                    color: '#90ee7e',                    y: game.balanceBits,                    game: game,                    outcome: game.outcome,                    radius: BIG_MARKER_RADIUS,                    dataLabels: dataLabelStyle                };            else if (game.newBalance)                newPoint = {                    color: '#e95bff',                    y: game.balanceBits,                    x: chartIndex - 1,                    game: game,                    radius: BIG_MARKER_RADIUS,                    dataLabels: dataLabelStyle                };            else //lose game                newPoint = {                    color: '#f45b5b',                    y: game.balanceBits,                    game: game,                    outcome: game.outcome,                    radius: BIG_MARKER_RADIUS,                    dataLabels: dataLabelStyle                };            //Format the second and the third points            this.chart.series[2].data[chartLength - 1].update({                radius: MEDIUM_MARKER_RADIUS,                dataLabels: {                    enabled: true,                    format: '{point.outcome}',                    y: -14                }            }, false);            if (chartLength - 2 >= 0)                this.chart.series[2].data[chartLength - 2].update({                    radius: MARKER_RADIUS,                    dataLabels: {                        enabled: true,                        format: '{point.outcome}',                        y: -8                    }                }, false);            //Add the result of the game            this.chart.series[2].addPoint(newPoint, false); //The length of the graph is not updated until render time            //Set the max viewed point on the screen and delete them when they are too many            if (chartLength > MAX_NUM_POINTS) {                //If there is more than X points in the series remove them                if (chartLength > MAX_MEM_NUM_POINTS)                    for (var i = 0, length = chartLength - MAX_NUM_POINTS; i < length; i++) {                        this.chart.series[2].data[0].remove(false);                    }            }            //Set the new extremes for the graph            this._setExtremes(false);            //Hide old projection points            this.chart.series[0].data[0].options.marker = {radius: 0};            this.chart.series[0].data[0].update(this.chart.series[0].data[0].options);            this.chart.series[1].data[0].options.marker = {radius: 0};            this.chart.series[1].data[0].update(this.chart.series[1].data[0].options);            //Update projections after a time            var self = this;            setTimeout(function () {                var wonProjectionDiff = Clib.satToBit(Engine.getPotentialProfit());                var LostProjection = game.balanceBits - game.wagerBitsFloor;                var wonProjection = wonProjectionDiff + game.balanceBits;                //Delete the projections and add a new ones, no using update projection because we delete them here                self.chart.series[0].data[0].remove(false);                self.chart.series[1].data[0].remove(false);                self.chart.series[0].addPoint({                    x: game.newBalance? chartIndex : chartIndex + 1,                    y: wonProjection,                    dataLabels: {                        enabled: true,                        format: '+' + ((wonProjectionDiff % 1 !== 0) ? wonProjectionDiff.toFixed(2) : wonProjectionDiff),                        y: -14                    }                }, false);                self.chart.series[1].addPoint({                    x: game.newBalance? chartIndex : chartIndex + 1,                    y: LostProjection,                    dataLabels: {                        enabled: true,                        format: '-' + game.wagerBitsFloor, //You can't bet decimals, so no need to round it                        y: 29                    }                }, false);                self.chart.redraw();            }, 400);            this.chart.redraw();        },        _setExtremes: function (redraw) {            var chartLength = this.chart.series[2].data.length; //The real length of the chart            var chartIndex = this.chart.series[2].data[this.chart.series[2].data.length - 1].x + 1;            if (chartLength >= MAX_NUM_POINTS - GameSettings.graphRightMargin)                this.chart.xAxis[0].setExtremes(chartIndex - MAX_NUM_POINTS, chartIndex + GameSettings.graphRightMargin, redraw);        },        _refreshBalance: function (newState) {            newState.newBalance = true;            this.onBetFinished(newState);        },        //Update the state of the projections, get the state directly from the engine        updateProjections: function (chartLength, chartIndex) {            var balanceBits = Clib.satToBit(Engine.balance);            var wagerBitsFloor = Clib.satToBitFloored(Engine.wager);            var wonProjectionDiff = Clib.satToBit(Engine.getPotentialProfit());            var wonProjection = balanceBits + wonProjectionDiff;            var LostProjection = balanceBits - wagerBitsFloor;            this.chart.series[0].data[0].update({                x: chartIndex + 1,                y: wonProjection,                dataLabels: {                    enabled: true,                    format: '+' + Clib.formatDecimals(wonProjectionDiff),                    y: -14                }            }, false);            this.chart.series[1].data[0].update({                x: chartIndex + 1,                y: LostProjection,                dataLabels: {                    enabled: true,                    format: '-' + wagerBitsFloor,                    y: 29                }            }, false);            this.chart.redraw();        },        render: function () {            return D.div({id: 'graph-box', ref: 'graphBox'});        }    });    function createSeries() {        var balanceBits = Clib.satToBit(Engine.balance);        var wagerBits = Clib.satToBitFloored(Engine.wager);        var wonProjectionDiff = Clib.satToBit(Engine.getPotentialProfit());        var series = [];        var profitSeries = {            name: 'profit',            game: {                outcome: 0            },            data: [                {y: balanceBits, color: '#90ee7e', radius: BIG_MARKER_RADIUS}            ]            //dataLabels: {            //},        };        //Create the won projection series        var wonProjectionSeries = {            name: 'won',            color: "rgba(144, 238, 126, 0.5)",            data: [                //{                //    y: gameState.balanceBits,                //    x: 0                //},                {                    y: balanceBits + Clib.satToBit(Engine.getPotentialProfit()),                    x: 1                }            ],            dataLabels: {                enabled: true,                format: '+' + Clib.formatDecimals(wonProjectionDiff),                y: -14            }        };        //Create the lost projection series        var lostProjectionSeries = {            name: 'lose',            color: "rgba(244, 91, 91, 0.5)",            data: [                //{                //    y: gameState.balanceBits,                //    x: 0                //},                {                    y: balanceBits - wagerBits,                    x: 1                }            ],            dataLabels: {                enabled: true,                format: '-' + wagerBits,                y: 29            }        };        var fakePointSeries = {            color: 'red', //transparent            data: []        };        series.push(wonProjectionSeries);        series.push(lostProjectionSeries);        series.push(profitSeries);        series.push(fakePointSeries);        return series;    }    function createChart(node) {        return new Highcharts.Chart({            chart: {                renderTo: node,                type: 'line',                //margin: null, //Dynamically calculated                //animation: {                //    duration: 400                //    //easing: 'easeOutQuart'                //},                events: {                    redraw: function () {                        //alert('The chart is being redrawn');                        //console.log('redraw');                    }                }                //backgroundColor: '#272B30'            },            tooltip: {                formatter: function () {                    if (this.series.name == 'profit' && this.point.outcome) {                        var betRange = (this.point.game.cond === '>') ? ( '> ' + (100 - this.point.game.winChances)) : ('< ' + this.point.game.winChances);                        return '<b>' + 'BET INFO' + '</b> <br/>' +                            '--------------' + '<br/>' +                            '<b>' + 'Bet id: ' + '</b>' + this.point.game.bet_id + '<br/>'+                            '<b>' + 'Outcome: ' + '</b>' + this.point.outcome + '<br/>'+                            '<b>' + 'Range: ' + '</b>' + betRange + '<br/>'+                            '<b>' + 'Bet: ' + '</b>' + Clib.formatDecimals(this.point.game.wagerBitsFloor) + '<br/>'+                            '<b>' + 'Profit: ' + '</b>' + Clib.formatSatoshis(this.point.game.profit) + '<br/>'+                            '<b>' + 'Balance: ' + '</b>' + Clib.formatDecimals(this.point.game.balanceBits) + '<br/>'+                            '<b>' + 'Fair Verified ' + ' \u2713' + '<br/>';                    } else if (this.series.name == 'profit' && this.point.game && this.point.game.newBalance) {                        return 'NEW BALANCE' + '<br/>' +                                    '<b>' + 'Balance: ' + Clib.satToBit(this.point.game.balance);                    } else {                        return false;                    }                }, style: {                    fontFamily: 'Arial',                    fontWeight: 'normal'                }            },            plotOptions: {                //line: {                //    dataLabels: {                //        enabled: true,                //        format: '{point.game.outcome:,.0f}'                //    }                //},                series: {                    lineWidth: 1,                    marker: {                        radius: MARKER_RADIUS,                        symbol: 'circle'                    }                    //animation: {                    //    duration: 2000,                    //    easing: 'easeOutBounce'                    //}                }            },            title: {                text: null                //style: {                //    color: '#ffffff',                //    fontWeight: 'bold'                //}            },            subtitle: {                //text: 'The simplest casino you could find'                //style: {                //    color: '#ffffff',                //    fontWeight: 'bold'                //}            },            legend: {                enabled: false            },            xAxis: {                minRange: 20,                allowDecimals: false,                labels: {                    enabled: false                }            },            yAxis: {                title: {                    text: 'Balance'                },                minTickInterval: 1,                minPadding: 0.2,                maxPadding: 0.2,                maxZoom: 5,                plotLines: [{                    value: 0,                    width: 6,                    color: 'rgb(112, 112, 115)'                }],                opposite: true            },            exporting: {                enabled: false            },            series: createSeries()        });    }});