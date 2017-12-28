$(document).ready(function() {
  // will holds the current player value
  var player;
  //will hold the player's game id. Used also to determine if game is still opened / socket connected.
  var gameId;
  var socket = io.connect('https://cryptic-lowlands-42400.herokuapp.com/');
  // var socket = io.connect('http://localhost:3000');

  class Player {
    constructor(name, type) {
      this.name = name;
      this.type = type;
      this.currentTurn = true;
      this.currentBitValue = 0;
      this.status = false;

      //game
      this.board = [];
      this.moves = 0;
      this.cellValue = 0;
    }

    // Set the bit value of the move played by the player. This will be then compared with the preset winning bit values.
    updateCurrentBitValue(cell) {
      var row = parseInt(cell.split('-')[1][0], 10);
      var col = parseInt(cell.split('-')[1][1], 10);
      var newValue = 1 << ((row * 3) + col);
      this.currentBitValue += newValue;
    }

    // Set the currentTurn for player
    setCurrentTurn(turn) {
      this.currentTurn = turn;
      var message = turn ? 'Your turn' : 'Waiting for Opponent';
      $('#turn').text(message);
    }

    // Create the board. Attaching event listeners to the board cells.
    initBoard() {
      this.resetBoard();
      $('.cell').off('click');
      $('.cell').on('click', function() {
        // console.log('cell clicked');
        if (!gameId) {
          alert("Game is no longer opened.");
          return;
        }
        if (!player.currentTurn) {
          alert("Wait for opponent to play.");
          return;
        }
        if ($(this).prop('disabled')) {
          alert("Cell has already been played.");
          return;
        }
        player.updateBoard(this.id, player.type);
        player.setCurrentTurn(false);
        player.updateCurrentBitValue(this.id);
        socket.emit('playTurn', {
          gameId: gameId,
          player: player,
          cell: this.id
        });
      });
    }

    //Update game board UI
    updateBoard(cell, type) {
      var row = parseInt(cell.split('-')[1][0], 10);
      var col = parseInt(cell.split('-')[1][1], 10);
      // console.log(this);
      $('#' + cell).text(type).prop('disabled', true);
    }

    resetBoard() {
      $('.cell').text(" ").prop('disabled', false);
    }

  }

  // Create a new game. Emit newGame event.
  $('#start-game .btn').on('click', function(e) {
    // console.log('Start game');
    e.preventDefault();
    var name = $('#player-name').val();
    gameId = $('#game-id').val();
    if (gameId == '') {
      player = new Player(name, 'X');
      socket.emit('createGame', {
        player: player
      });
    } else {
      player = new Player(name, 'O');
      socket.emit('joinGame', {
        gameId: gameId,
        player: player
      });
    }
    // console.log(player);
    player.initBoard();
  });

  // Reset game. Emit resetGame event.
  $('#reset-game-request').on('click', function() {
    if (!gameId) {
      return;
    }
    $('#modal-reset-game-request').modal('toggle');
    // console.log('#reset-game-request clicked');
    socket.emit('resetGameRequest', {
      gameId: gameId,
      player: player
    });
  });

  // Leave game. Emit leaveGame event.
  $('#leave-game').on('click', function() {
    if (!gameId) {
      return;
    }
    $('#modal-leave-game').modal('toggle');
    // console.log('#leave-game clicked');
    socket.emit('leaveGame', {
      gameId: gameId,
      player: player
    });
  });

  // New Game has been created for first player.
  socket.on('newGame', function(data) {
    // console.log('socket.on(newGame)');
    // console.log(player);
    gameId = data.gameId;
    $('#player').html('Hi, ' + player.name);
    $('#message').html('Waiting for player 2 to join the game... . Game id: ' + data.gameId);
  });

  // Game has been created for second player, Current turn is set true for first player
  socket.on('startGame', function(data) {
    // console.log('socket.on(startGame)');
    // console.log(player);
    var message = 'Player 1: ' + data.player1.name + "    -    Player 2: " + data.player2.name;
    $('#message').html(message);
    $('#player').html('Hi, ' + player.name);
    if (player.name == data.player2.name) {
      player.setCurrentTurn(false);
    } else {
      player.setCurrentTurn(true);
    }
  });

  //Turn  has been played. Update board. Pass next turn to the other player
  socket.on('turnPlayed', function(data) {
    // console.log('socket.on(turnPlayed)');
    const opponentType = data.player.type;
    player.updateBoard(data.cell, opponentType);
    player.setCurrentTurn(true);
  });

  //Opponent player has requested game reset. Open dialog box for the other player to confirm.
  //Reset player with new player, preserving name and type. Emit reset game for the opponent on confirm.
  socket.on('resetGameRequest', function(data) {
    // console.log('socket.on(resetGameRequest)');
    $('#modal-reset-game').modal('toggle');
    $('#reset-game').on('click', function() {
      player = new Player(player.name, player.type);
      socket.emit('resetGame', {
        gameId: gameId,
        player1: data.player,
        player2: player
      });
      $('#modal-reset-game').modal('toggle');
    });
  });

  //After reset request confirmation, game has been reset.
  //Reset player that initiated the reset (player1) with new player, preserving name and type. Set current turn to player1.
  socket.on('resetedGame', function(data) {
    // console.log('socket.on(resetedGame)');
    var message = 'Player 1: ' + data.player1.name + "    -    Player 2: " + data.player2.name;
    $('#message').html(message);
    player = new Player(player.name, player.type);
    if (player.name == data.player2.name) {
      player.setCurrentTurn(false);
    } else {
      player.setCurrentTurn(true);
    }
    player.resetBoard();
  });

  // This is called on game finish. Show the result message.
  socket.on('endGame', function(data) {
    // console.log('socket.on(endGame)');
    $('#message').text(data.message);
    $('#turn').text('');
  });


  // Delete game and room
  socket.on('dropGame', function(data) {
    // console.log('socket.on(dropGame)');
    $('#message').text(data.message);
    $('#turn').text('');
    $('#reset-game-request-modal').remove();
    $('#leave-game-modal').remove();
    gameId = 0;
    socket.emit('dropGame', {});
  });


  //End the game on any err event.
  socket.on('err', function(data) {
    // console.log('socket.on(err)');
    $('#message').text(data.message);
    gameId = 0;
  });

});
