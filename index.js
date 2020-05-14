const net = require('net');
const socketIo = require('socket.io');
const http = require('http');
const fs = require('fs');


const localport = 5556;
const remotehost = '127.0.0.1';
const remoteport = 5347;
const httpPort = 85;

const page = fs.readFileSync('./index.html');

httpServer = http.createServer(function (req, res) {
    const page = fs.readFileSync('./index.html');
    res.setHeader('Content-Type', 'text/html');
    res.write(page);
    res.end();
}).listen(httpPort);

let io = socketIo(httpServer, {path: "/debugWs"});


io.on('connection', async function (socket) {
    io.emit('data', {
        type: 'info',
        msg: `Ready.`
    });
});



process.on("uncaughtException", function (error) {
    io.emit('data', {
        type: 'error',
        msg: error.toString()
    });
});


const server = net.createServer(function (localsocket) {

    const remotesocket = new net.Socket();

    remotesocket.connect(remoteport, remotehost);

    localsocket.on('data', function (data) {
        let flushed = remotesocket.write(data);
        let flushTxt = '';
        if (!flushed) {
            localsocket.pause();
            flushTxt = ' (not flushed, pausing)';
        }
        io.emit('data', {
            type: 'info in',
            msg: `Data ${localsocket.remoteAddress.replace('::ffff:', '')} => ${remotehost}:${remoteport} ${flushTxt}`,
            data: data.toString()
        });
    });

    remotesocket.on('data', function (data) {
        let flushed = localsocket.write(data);
        let flushTxt = '';
        if (!flushed) {
            localsocket.pause();
            flushTxt = ' (not flushed, pausing)';
        }
        io.emit('data', {
            type: 'info out',
            msg: `Data ${localsocket.remoteAddress.replace('::ffff:', '')} <= ${remotehost}:${remoteport} ${flushTxt}`,
            data: data.toString()
        });
    });

    localsocket.on('drain', function () {
        io.emit('data', {
            type: 'info in',
            msg: `Resume ${localsocket.remoteAddress.replace('::ffff:', '')}`,
        });
        remotesocket.resume();
    });

    remotesocket.on('drain', function () {
        io.emit('data', {
            type: 'info out',
            msg: `Resume ${remotehost}:${remoteport}`,
        });
        localsocket.resume();
    });

    localsocket.on('error', function (e) {
        io.emit('data', {
            type: 'error in',
            msg: `Error ${localsocket.remoteAddress.replace('::ffff:', '')} ${e.toString()}`,
        });
        remotesocket.resume();
    });

    remotesocket.on('error', function (e) {
        io.emit('data', {
            type: 'error out',
            msg: `Error ${remotehost}:${remoteport} ${e.toString()}`,
        });
        localsocket.resume();
    });

    localsocket.on('close', function (had_error) {
        io.emit('data', {
            type: 'info in',
            msg: `Close ${localsocket.remoteAddress.replace('::ffff:', '')}`,
        });
        remotesocket.end();
    });

    remotesocket.on('close', function (had_error) {
        io.emit('data', {
            type: 'info out',
            msg: `Close ${remotehost}:${remoteport}`,
        });
        localsocket.end();
    });

});

server.listen(localport);


