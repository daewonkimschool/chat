// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const cors = require('cors');

// const app = express();
// app.use(cors());

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: "*", 
//     methods: ["GET", "POST"]
//   }
// });

// // 🔥 최근 대화 기록을 저장할 배열 (메모리 임시 저장)
// const messageHistory = [];
// const MAX_HISTORY = 50; // 최대 50개까지 보관

// io.on('connection', (socket) => {
//   console.log('소켓 연결됨');

//   socket.on('join', (userName) => {
//     socket.userName = userName; 
    
//     // 1. 기존 대화 기록이 있다면 새로 들어온 사람에게만 먼저 쫙 보내주기
//     if (messageHistory.length > 0) {
//       socket.emit('chat history', messageHistory);
//     }

//     // 2. 환영 메시지 보내기
//     socket.emit('bot message', `${userName}님, 채팅방에 복귀하셨습니다!`);
//     socket.broadcast.emit('bot message', `${userName}님이 입장하셨습니다.`);
//   });

//   socket.on('chat message', (msg) => {
//     if(socket.userName) {
//       const messageData = { 
//         name: socket.userName, 
//         text: msg,
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) // 전송 시간 추가
//       };

//       // 히스토리에 저장 및 50개 제한 유지
//       messageHistory.push(messageData);
//       if (messageHistory.length > MAX_HISTORY) {
//         messageHistory.shift(); // 오래된 메시지 삭제
//       }

//       // 모두에게 메시지 전송
//       io.emit('chat message', messageData);
//     }
//   });

//   socket.on('disconnect', () => {
//     if(socket.userName) {
//       io.emit('bot message', `${socket.userName}님이 퇴장하셨습니다.`);
//     }
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`서버 작동 중: ${PORT}`);
// });
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

// 🔥 현재 접속 중인 유저들의 목록을 저장할 함수
function getActiveUsers() {
  const users = [];
  const sockets = io.sockets.sockets; // 연결된 모든 소켓 가져오기
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
    
    // 1. 기존 대화 기록 전송
    if (messageHistory.length > 0) {
      socket.emit('chat history', messageHistory);
    }

    // 2. 환영 메시지 전송
    socket.emit('bot message', `${userName}님, 채팅방에 복귀하셨습니다!`);
    socket.broadcast.emit('bot message', `${userName}님이 입장하셨습니다.`);

    // 3. 🔥 새 유저가 들어왔으므로 모든 클라이언트에게 최신 접속자 명단 전송
    io.emit('user list', getActiveUsers());
  });

  // 🎮 게임용 랜덤 정답 숫자 (1~50) - 서버가 기억합니다.
  let targetNumber = Math.floor(Math.random() * 50) + 1;

  socket.on('chat message', (msg) => {
    const trimmedMsg = msg.trim();

    // 🎲 1. 주사위 기능 (/주사위)
    if (trimmedMsg === '/주사위') {
      const dice = Math.floor(Math.random() * 6) + 1;
      io.emit('chat message', { 
        name: '🎲 게임봇', 
        text: `[내기] ${userName}님이 주사위를 굴려 [ ${dice} ]이(가) 나왔습니다!` 
      });
      return;
    }

    // 🔢 2. 숫자 맞추기 기능 (/숫자 정답)
    if (trimmedMsg.startsWith('/숫자')) {
      const args = trimmedMsg.split(' ');
      const guess = parseInt(args[1]);

      if (isNaN(guess)) {
        socket.emit('chat message', { name: '🤖 게임봇', text: '사용법: /숫자 [1부터 50 사이의 숫자]를 입력하세요. (예: /숫자 25)' });
        return;
      }

      if (guess === targetNumber) {
        io.emit('chat message', { 
          name: '🎉 게임봇', 
          text: `정답!! ${userName}님이 정답 [ ${targetNumber} ]을(를) 맞추셨습니다! 다음 게임 숫자가 새로 생성되었습니다.` 
        });
        targetNumber = Math.floor(Math.random() * 50) + 1; // 새 게임 시작
      } else if (guess < targetNumber) {
        io.emit('chat message', { name: '🤖 게임봇', text: `${userName}님의 입력: ${guess} ➡️ [ UP ] 더 높은 숫자입니다!` });
      } else {
        io.emit('chat message', { name: '🤖 게임봇', text: `${userName}님의 입력: ${guess} ➡️ [ DOWN ] 더 낮은 숫자입니다!` });
      }
      return;
    }

    // 일반 채팅 메시지는 그대로 전송
    io.emit('chat message', { name: userName, text: msg });
  });

  socket.on('disconnect', () => {
    if(socket.userName) {
      io.emit('bot message', `${socket.userName}님이 퇴장하셨습니다.`);
      
      // 4. 🔥 유저가 나갔으므로 최신 접속자 명단을 다시 계산해서 전체 전송
      io.emit('user list', getActiveUsers());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 작동 중: ${PORT}`);
});
