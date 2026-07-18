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

// 현재 접속 중인 유저들의 목록을 저장할 함수
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

  // 🎮 게임용 랜덤 정답 숫자 (1~50) - 각 소켓 세션이 아닌 클라이언트와 공유하기 위해 상위 변수 활용 가능하나, 
  // 여기서는 접속한 유저마다 독립된 숫자가 아니라 채팅방 전체가 공유하도록 처리하기 위해 고정합니다.
  if (!global.targetNumber) {
    global.targetNumber = Math.floor(Math.random() * 50) + 1;
  }

  socket.on('join', (userName) => {
    socket.userName = userName; 
    
    // 1. 기존 대화 기록 전송
    if (messageHistory.length > 0) {
      socket.emit('chat history', messageHistory);
    }

    // 2. 환영 메시지 전송
    socket.emit('bot message', `${userName}님, 채팅방에 복귀하셨습니다!`);
    socket.broadcast.emit('bot message', `${userName}님이 입장하셨습니다.`);

    // 3. 새 유저가 들어왔으므로 모든 클라이언트에게 최신 접속자 명단 전송
    io.emit('user list', getActiveUsers());
  });

  socket.on('chat message', (msg) => {
    // 사용자가 로그인하지 않고 메시지를 보낼 경우를 대비한 예외 처리
    const currentUserName = socket.userName || '알 수 없음';
    const trimmedMsg = msg.trim();
    
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
      
      // 대화 기록에 저장
      messageHistory.push(gameMsg);
      if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
      return;
    }

    // 🔢 2. 숫자 맞추기 기능 (/숫자 정답)
    if (trimmedMsg.startsWith('/숫자')) {
      const args = trimmedMsg.split(' ');
      const guess = parseInt(args[1]);

      if (isNaN(guess)) {
        socket.emit('chat message', { 
          name: '🤖 게임봇', 
          text: '사용법: /숫자 [1부터 50 사이의 숫자]를 입력하세요. (예: /숫자 25)',
          time: timeString
        });
        return;
      }

      let responseText = '';
      let botName = '🤖 게임봇';

      if (guess === global.targetNumber) {
        botName = '🎉 게임봇';
        responseText = `정답!! ${currentUserName}님이 정답 [ ${global.targetNumber} ]을(를) 맞추셨습니다! 다음 게임 숫자가 새로 생성되었습니다.`;
        global.targetNumber = Math.floor(Math.random() * 50) + 1; // 새 게임 시작
      } else if (guess < global.targetNumber) {
        responseText = `${currentUserName}님의 입력: ${guess} ➡️ [ UP ] 더 높은 숫자입니다!`;
      } else {
        responseText = `${currentUserName}님의 입력: ${guess} ➡️ [ DOWN ] 더 낮은 숫자입니다!`;
      }

      const gameMsg = { name: botName, text: responseText, time: timeString };
      io.emit('chat message', gameMsg);
      
      // 대화 기록에 저장
      messageHistory.push(gameMsg);
      if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
      return;
    }

    // 💬 일반 채팅 메시지 처리 및 시간 추가
    const chatMsg = { 
      name: currentUserName, 
      text: msg,
      time: timeString
    };

    // 전체 클라이언트에 전송 및 기록 보관
    io.emit('chat message', chatMsg);
    
    messageHistory.push(chatMsg);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift(); // 50개가 넘으면 가장 오래된 기록 삭제
    }
  });

  socket.on('disconnect', () => {
    if(socket.userName) {
      io.emit('bot message', `${socket.userName}님이 퇴장하셨습니다.`);
      
      // 4. 유저가 나갔으므로 최신 접속자 명단을 다시 계산해서 전체 전송
      io.emit('user list', getActiveUsers());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 작동 중: ${PORT}`);
});
