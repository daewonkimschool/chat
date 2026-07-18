const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const messageHistory = [];
const MAX_HISTORY = 50;

// 🎮 방 전체가 공유하는 숫자 맞추기 정답 (서버 최상단에 배치)
let targetNumber = Math.floor(Math.random() * 50) + 1;

// 현재 접속 중인 유저들의 목록을 저장할 함수
function getActiveUsers() {
  const users = [];
  const sockets = io.sockets.sockets;
  for (const [id, socket] of sockets) {
    if (socket.userName) {
      users.push(socket.userName);
    }
  }
  return users;
}

io.on('connection', (socket) => {
  console.log('소켓 연결됨');

  socket.on('join', (userName) => {
    socket.userName = userName; 
    
    if (messageHistory.length > 0) {
      socket.emit('chat history', messageHistory);
    }

    socket.emit('bot message', `${userName}님, 채팅방에 복귀하셨습니다!`);
    socket.broadcast.emit('bot message', `${userName}님이 입장하셨습니다.`);
    io.emit('user list', getActiveUsers());
  });

  socket.on('chat message', (msg) => {
    const currentUserName = socket.userName || '익명';
    // 문자열 양 끝 공백 제거 및 여러 개의 공백을 하나로 통일
    const trimmedMsg = msg.trim().replace(/\s+/g, ' '); 
    
    // 한국 시간(KST) 기준 오전/오후 시:분 생성
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // 🎲 1. 주사위 기능 (/주사위)
    if (trimmedMsg === '/주사위') {
      const dice = Math.floor(Math.random() * 6) + 1;
      
      const gameMsg = { 
        name: '🎲 게임봇', 
        text: `[내기] ${currentUserName}님이 주사위를 굴려 [ ${dice} ]이(가) 나왔습니다!`,
        time: timeString
      };
      
      io.emit('chat message', gameMsg);
      messageHistory.push(gameMsg);
      if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
      return; // 일반 채팅으로 넘어가지 않게 종료
    }

    // 🔢 2. 숫자 맞추기 기능 (/숫자 정답)
    if (trimmedMsg.startsWith('/숫자')) {
      const args = trimmedMsg.split(' ');
      const guess = parseInt(args[1]);

      // 숫자를 제대로 입력하지 않았을 때 예외 처리
      if (isNaN(guess)) {
        socket.emit('chat message', { 
          name: '🤖 게임봇', 
          text: '사용법을 확인해 주세요! 예시) /숫자 25',
          time: timeString
        });
        return;
      }

      let responseText = '';
      let botName = '🤖 게임봇';

      if (guess === targetNumber) {
        botName = '🎉 게임봇';
        responseText = `정답!! ${currentUserName}님이 정답 [ ${targetNumber} ]을(를) 맞추셨습니다! 다음 게임 숫자가 새로 생성되었습니다.`;
        targetNumber = Math.floor(Math.random() * 50) + 1; // 새 게임 정답 생성
      } else if (guess < targetNumber) {
        responseText = `${currentUserName}님의 입력: ${guess} ➡️ [ UP ] 더 높은 숫자입니다!`;
      } else {
        responseText = `${currentUserName}님의 입력: ${guess} ➡️ [ DOWN ] 더 낮은 숫자입니다!`;
      }

      const gameMsg = { name: botName, text: responseText, time: timeString };
      io.emit('chat message', gameMsg);
      
      messageHistory.push(gameMsg);
      if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
      return; // 일반 채팅으로 넘어가지 않게 종료
    }

    // 💬 일반 채팅 메시지 처리
    const chatMsg = { 
      name: currentUserName, 
      text: msg,
      time: timeString
    };

    io.emit('chat message', chatMsg);
    messageHistory.push(chatMsg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
  });

  socket.on('disconnect', () => {
    if(socket.userName) {
      io.emit('bot message', `${socket.userName}님이 퇴장하셨습니다.`);
      io.emit('user list', getActiveUsers());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 작동 중: ${PORT}`);
});
