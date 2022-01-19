const express        = require('express');
const cookieParser   = require('cookie-parser');
const bodyParser     = require('body-parser');
const path           = require('path');
const moment           = require('moment');;
const isDebug        = process.env.IN_WORKS !== undefined;

const Spammer = require('./modules/Spamer')

const indexRouter = require('./routes/index')
// https://github.com/starak/node-console-stamp
require('console-stamp')(console, {
	metadata: function () {
		const orig              = Error.prepareStackTrace;
		Error.prepareStackTrace = (_, stack) => stack;
		const err               = new Error;
		Error.captureStackTrace(err, arguments.callee);
		const stack             = err.stack;
		Error.prepareStackTrace = orig;
		return (`[${stack[1].getFileName()}:${stack[1].getLineNumber()}\n`);
	},
	colors  : {
		stamp   : 'yellow',
		label   : 'white',
		metadata: 'green'
	},
	// exclude: isDebug || isLocalProduct ? [] : ["log", "info", "warn", "error", "dir", "assert"],
});

const app = express();


app.set('view cache', false);


app.use(bodyParser.json({
	limit   : '50mb',
	extended: true
}));
app.use(bodyParser.urlencoded({
	limit   : '50mb',
	extended: true
}));
app.use(express.json());

app.use(cookieParser());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use('/', indexRouter);

app.use('/public', express.static(__dirname + '/public'));


// catch 404 and forward to error handler
app.use((req, res, next)=> {
	res.render('error', {
		// Config: Config,
		title: 'ОШИБКА 404'
	});
});

app.use(function(err, req, res) {

	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

class MainClass{

	 constructor(){

		console.log('aaaaaa')

		Spammer.initSpammer()
	}
}

const ClsMainClass = new MainClass();

module.exports = app;