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

  socket.on('chat message', (msg) => {
    if(socket.userName) {
      const messageData = { 
        name: socket.userName, 
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      messageHistory.push(messageData);
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift();
      }

      io.emit('chat message', messageData);
    }
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
