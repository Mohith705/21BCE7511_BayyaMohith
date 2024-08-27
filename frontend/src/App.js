import EmojiPicker from 'emoji-picker-react';
import React, { useEffect, useRef, useState } from 'react';

const EmojiIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-6 h-6 text-gray-300 hover:text-gray-100 cursor-pointer"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.5C6.76 4.5 3 8.261 3 12s3.76 7.5 9 7.5 9-3.761 9-7.5S17.24 4.5 12 4.5zM12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm1.5 3.5h-3v-1h3v1zm-2.328-1.5a1.5 1.5 0 01-1.413-1.5c0-.413.118-.792.328-1.11l.912-.922a1.5 1.5 0 012.158-.04l.462.464a1.5 1.5 0 01.03 2.091l-1.434 1.464a1.496 1.496 0 01-1.983.015z"
    />
  </svg>
);

function App() {
  const BOARD_SIZE = 5;

  const [isRulesVisible, setIsRulesVisible] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState({
    board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
    currentPlayer: 'A',
    message: '',
    chatMessages: []
  });
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [socket, setSocket] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const chatBoxRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (roomId) {
      const ws = new WebSocket(`ws://localhost:8081?roomId=${roomId}`);
      setSocket(ws);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'boardState') {
          setGameState(prevState => ({
            ...prevState,
            board: data.boardState,
            currentPlayer: data.currentPlayer
          }));
        } else if (data.type === 'move') {
          setGameState(prevState => ({
            ...prevState,
            board: data.boardState,
            currentPlayer: data.currentPlayer
          }));

          const fromLabel = getLabelForPosition(data.fromX, data.fromY);
          const toLabel = getLabelForPosition(data.toX, data.toY);
          setMoveHistory(prevHistory => [
            ...prevHistory,
            `Player ${data.currentPlayer === "A" ? "B" : "A"} moved ${data.character} from ${fromLabel} to ${toLabel}`
          ]);
        } else if (data.type === 'chat') {
          setGameState(prevState => ({
            ...prevState,
            chatMessages: [...prevState.chatMessages, `${data.playerId}: ${data.message}`]
          }));
        } else if (data.error) {
          console.error('Error from server:', data.error);
          setGameState(prevState => ({
            ...prevState,
            message: data.error
          }));
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      return () => {
        ws.close();
      };
    }
  }, [roomId]);

  const getCellClass = (cell) => {
    if (cell) {
      const type = cell.slice(1);
      switch (type) {
        case 'P1':
        case 'P2':
        case 'P3':
          return 'pawn';
        case 'H1':
          return 'hero1';
        case 'H2':
          return 'hero2';
        default:
          return '';
      }
    }
    return '';
  };

  const isValidMove = (character, fromX, fromY, toX, toY) => {
    const deltaX = Math.abs(toX - fromX);
    const deltaY = Math.abs(toY - fromY);

    switch (character.slice(1)) {
      case 'P1':
      case 'P2':
      case 'P3':
        return (deltaX === 1 && deltaY === 0) || (deltaX === 0 && deltaY === 1);
      case 'H1':
        return (deltaX === 2 && deltaY === 0) || (deltaX === 0 && deltaY === 2);
      case 'H2':
        return deltaX === 1 && deltaY === 1;
      default:
        return false;
    }
  };

  const getLabelForPosition = (x, y) => {
    const rowLabel = String.fromCharCode('A'.charCodeAt(0) + x);
    const colLabel = (y + 1).toString();
    return `${rowLabel}${colLabel}`;
  };

  const handleCellClick = (x, y) => {
    const character = gameState.board[x][y];

    if (selectedCharacter) {
      const [fromX, fromY] = findCharacterPosition(selectedCharacter, gameState.board);

      if (isValidMove(selectedCharacter, fromX, fromY, x, y)) {
        const targetCell = gameState.board[x][y];
        const targetPlayer = targetCell ? targetCell.charAt(0) : null;

        if (targetPlayer === null || targetPlayer !== gameState.currentPlayer) {
          const newBoard = gameState.board.map(row => row.slice());

          newBoard[fromX][fromY] = null;
          newBoard[x][y] = selectedCharacter;

          if (socket) {
            socket.send(JSON.stringify({
              type: 'move',
              character: selectedCharacter,
              fromX,
              fromY,
              toX: x,
              toY: y,
              boardState: newBoard,
              currentPlayer: gameState.currentPlayer
            }));
          }

          setGameState(prevState => ({
            ...prevState,
            board: newBoard,
            currentPlayer: prevState.currentPlayer === 'A' ? 'B' : 'A',
            message: ''
          }));

          setSelectedCharacter(null);
        } else {
          setGameState(prevState => ({
            ...prevState,
            message: `You are not eligible to move to the occupied cell of your own`,
            messageType: 'occupied-message'
          }));
        }
      } else {
        setGameState(prevState => ({
          ...prevState,
          message: `Nahh.. you made a wrong move for ${selectedCharacter}`,
          messageType: 'wrong-move-message'
        }));
      }
    } else if (character && character.startsWith(gameState.currentPlayer)) {
      setSelectedCharacter(character);
      setGameState(prevState => ({
        ...prevState,
        message: ''
      }));
    }
  };

  const findCharacterPosition = (character, board) => {
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (board[i][j] === character) {
          return [i, j];
        }
      }
    }
    return null;
  };

  const BoardCell = React.memo(({ cell, rowIndex, cellIndex }) => (
    <div
      className={`board-cell ${getCellClass(cell)} flex items-center justify-center text-xl font-bold text-white border border-gray-700 w-[50px] h-[50px] text-[20px] cursor-pointer`}
      onClick={() => handleCellClick(rowIndex, cellIndex)}
    >
      {cell ? cell : ""}
    </div>
  ));

  const handleCreateRoom = () => {
    const newRoomId = (Math.floor(Math.random() * 100000) + 1).toString();
    setRoomId(newRoomId);
  };

  const sendMessage = () => {
    if (chatMessage.trim() && socket) {
      console.log("Sending message:", chatMessage); // Debug log
      socket.send(JSON.stringify({
        type: 'chat',
        message: chatMessage,
      }));
      setChatMessage('');
    } else {
      console.error("WebSocket not connected or no message to send");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleEmojiClick = (emoji) => {
    setChatMessage(prevMessage => prevMessage + emoji.emoji);
    setShowEmojiPicker(false);
  };

  const toggleRules = () => {
    setIsRulesVisible(!isRulesVisible);
  };

  return (
    <div className='grid grid-cols-3 items-center justify-between gap-2 bg-gray-900'>

      <div>
        <div class="game-rules-container h-screen overflow-y-auto scrollbar-thin p-4 bg-gray-100 border border-gray-300 rounded-md shadow-md">
          <h2 class="text-xl font-semibold mb-4">Game Rules</h2>
          <p class="mb-2">Welcome to the 5x5 Chess-like Game! Here are the rules to get you started:</p>

          <h3 class="text-lg font-semibold mt-4 mb-2">Objective</h3>
          <p class="mb-4">The goal of the game is to strategically move your characters to outmaneuver your opponent and gain control of the board. The game is played on a 5x5 grid with each player controlling a set of characters.</p>

          <h3 class="text-lg font-semibold mt-4 mb-2">Characters</h3>
          <ul class="list-disc ml-5 mb-4">
            <li><strong>Pawns (P1, P2, P3):</strong> Move one step horizontally or vertically.</li>
            <li><strong>Hero1 (H1):</strong> Moves two steps horizontally or vertically.</li>
            <li><strong>Hero2 (H2):</strong> Moves diagonally one step.</li>
          </ul>

          <h3 class="text-lg font-semibold mt-4 mb-2">Setup</h3>
          <p class="mb-4">At the beginning of the game, each player places their characters on the two rows closest to them. Player A's characters start on the top row, and Player B's characters start on the bottom row.</p>

          <h3 class="text-lg font-semibold mt-4 mb-2">Turn Order</h3>
          <p class="mb-4">Players alternate turns. Player A starts first. On your turn, you can move one of your characters to a new position on the board. After making a move, it becomes the other player's turn.</p>

          <h3 class="text-lg font-semibold mt-4 mb-2">Valid Moves</h3>
          <p class="mb-4">Ensure that you follow these movement rules based on your character type:</p>
          <ul class="list-disc ml-5 mb-4">
            <li><strong>Pawns:</strong> Move one step horizontally or vertically. Cannot move diagonally.</li>
            <li><strong>Hero1:</strong> Can move two steps horizontally or vertically, but not diagonally.</li>
            <li><strong>Hero2:</strong> Can move one step diagonally in any direction.</li>
          </ul>

          <h3 class="text-lg font-semibold mt-4 mb-2">Winning the Game</h3>
          <p class="mb-4">To win the game, capture all of the opponent's characters or strategically control the board to force the opponent into a position where they cannot make a valid move.</p>

          <h3 class="text-lg font-semibold mt-4 mb-2">Chat Functionality</h3>
          <p class="mb-4">Use the chat feature to communicate with your opponent during the game. You can send messages to all players in your room.</p>

          <h3 class="text-lg font-semibold mt-4 mb-2">Additional Rules</h3>
          <p class="mb-4">- Players must make a move on each turn. Failing to do so will result in a missed turn.</p>
          <p class="mb-4">- Cheating or exploiting bugs may result in disqualification from the game.</p>

          <p class="mb-2">Enjoy the game and may the best strategist win!</p>
        </div>

      </div>


      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">Turn-Based Chess-Like Game</h1>

        {!isConnected ? (
          <div className="mb-8 flex flex-col-reverse gap-2 items-center justify-center">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Join with room ID"
              className="p-2 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
            />
            <button
              onClick={handleCreateRoom}
              className="ml-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Create Room
            </button>
          </div>
        ) : (
          <div className="text-center mb-8">
            <p className="text-lg">Connected to room: <span className="font-bold text-green-400">{roomId}</span></p>
            <p className="text-md text-black font-bold bg-white p-3 rounded-lg">Player's Turn: {gameState.currentPlayer}</p>
          </div>
        )}

        <div className="board-grid grid grid-cols-5 gap-2 mb-8 px-[20px]">
          {gameState.board.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <BoardCell
                  key={`${rowIndex}-${cellIndex}`}
                  cell={cell}
                  rowIndex={rowIndex}
                  cellIndex={cellIndex}
                />
              ))}
            </React.Fragment>
          ))}
        </div>

        {gameState.message && (
          <div className={`text-center text-lg p-4 mb-4 rounded-md ${gameState.messageType === 'wrong-move-message' ? 'bg-red-500' : 'bg-yellow-500'}`}>
            {gameState.message}
          </div>
        )}

        <div className="move-history bg-gray-800 p-4 rounded-md w-full max-w-md overflow-y-auto max-h-48">
          <h2 className="text-xl font-semibold mb-2">Move History:</h2>
          <ul className="list-disc list-inside text-sm">
            {moveHistory.map((move, index) => (
              <li key={index}>{move}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="chat-section w-full max-w-md mb-4 bg-gray-900">
        <div className="chat-box bg-gray-600 p-4 rounded-md overflow-y-auto h-[400px] mb-2" ref={chatBoxRef}>
          {gameState.chatMessages.map((msg, index) => (
            <div key={index} className="text-sm mt-1 bg-white rounded-md p-2">
              {msg}
            </div>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <EmojiIcon />
          </button>
          {showEmojiPicker && (
            <div className="absolute z-10">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="w-full p-2 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            className="ml-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
