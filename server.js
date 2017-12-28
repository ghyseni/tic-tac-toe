var express = require('express'),
  path = require('path'),
  app = express(),
  server = require('http').Server(app),
  io = require('socket.io')(server),
  gameId = 0,
  game = null;

app.use(express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});



//handle events on client connect to the server
io.on('connection', function(socket) {

  //Game class
  // gameId Id of the gameId in which the game is running on the server.
  class Game {
    constructor(gameId, player1, player2) {
      this.gameId = gameId;
      this.moves = 0;
      this.status = 'initialised';
      this.player1 = player1;
      this.player2 = player2;
    }

    static get winBitValues() {
      return [7, 56, 448, 73, 146, 292, 273, 84];
    }

    updateMoves() {
      this.moves++;
    }

    getgameId() {
      return this.gameId;
    }

    //check status: win, tied or continue
    checkStatus(player) {
      var message = '';
      var status = this.status;
      Game.winBitValues.forEach((winBitValue) => {
        if ((winBitValue & player.currentBitValue) == winBitValue) {
          message =  player.name + ' won!';
          status = 'ended';
        }
      });

      if (status != 'ended' && this.moves >= 9) {
        message = 'Game over. No winner this time!';
        status = 'ended';
      }

      if (status == 'ended') {
        socket.emit('endGame', {
          gameId: this.gameId,
          message: message,
        });
        socket.broadcast.to(this.gameId).emit('endGame', {
          gameId: this.gameId,
          message: message,
        });
        this.status = status;
      }
    }
  }

  //Create a new game and gameId and notify the initiator (player1).
  socket.on('createGame', function(data) {
    console.log('socket.on(createGame)');
    ++gameId;
    socket.join(gameId);
    game = new Game(gameId, data.player, null);
    socket.emit('newGame', {
      player: data.player,
      gameId: gameId
    });
  });

  //Connect second player to the game by specified gameId. Show error if gameId not found or full.
  socket.on('joinGame', function(data) {
    console.log('socket.on(joinGame)');
    var room = io.nsps['/'].adapter.rooms[data.gameId];
    if (room && room.length === 1) {
      game.player2 = data.player;
      game.status = 'progress';

      socket.join(data.gameId);
      socket.broadcast.to(data.gameId).emit('startGame', {
        player1: game.player1,
        player2: game.player2
      });
      socket.emit('startGame', {
        player1: game.player1,
        player2: game.player2
      })
    } else {
      socket.emit('err', {
        message: 'Sorry, The game with id:' + data.gameId + ' is not opened or is full!'
      });
    }
  });

  //Handle the turn played by player and notify the other.
  socket.on('playTurn', function(data) {
    console.log('socket.on(playTurn)');
    game.updateMoves();
    socket.broadcast.to(gameId).emit('turnPlayed', {
      player: data.player,
      cell: data.cell,
    });
    game.checkStatus(data.player);
  });

  //Reset game request has been made. Ask other player for confirmation.
  socket.on('resetGameRequest', function(data) {
    console.log('socket.on(resetGameRequest)');
    socket.broadcast.to(data.gameId).emit('resetGameRequest', {
      player: data.player,
      cell: data.cell,
    });
  });

  //Player confirmed game reset. Reset game with newGame. Update both players.
  socket.on('resetGame', function(data) {
    console.log('socket.on(resetGame)');
    game = new Game(gameId, data.player1, data.player2);
    game.status = 'progress';

    socket.broadcast.to(data.gameId).emit('resetedGame', {
      player1: data.player1,
      player2: data.player2
    });
    socket.emit('resetedGame', {
      player1: data.player1,
      player2: data.player2
    })
  });

  //Leave game notify the other player.
  socket.on('leaveGame', function(data) {
    console.log('socket.on(leaveGame)');
    game = null;
    socket.broadcast.to(data.gameId).emit('dropGame', {
      message: 'Game ended! Player ' + data.player.name + ' dropped the game.',
    });
    socket.emit('dropGame', {
      message: 'Game ended! Opponent player was notified.',
    });
    socket.leave(gameId);
  });
  //End game automatically after one player has left the room.
  socket.on('dropGame', function(data) {
    console.log('socket.on(dropGame)');
    socket.leave(gameId);
  });

});

server.listen(process.env.PORT || 3000);
