var express = require('express'),
app = express(),
server = require('http').Server(app),
io = require('socket.io')(server),

app.use(express.static('.'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

server.listen(3000);
