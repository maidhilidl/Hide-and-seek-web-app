// app.js
// Two game modes sharing the same camera + detection logic:
// - Hide and Seek: timed, shows how many people were found
// - Counting Game: computer picks a target number and checks when ready

// Screens
const screenModeSelect = document.getElementById('screen-mode-select');
const screenTitle = document.getElementById('screen-title');
const screenCountingTitle = document.getElementById('screen-counting-title');
const screenCountdown = document.getElementById('screen-countdown');
const screenDetection = document.getElementById('screen-detection');
const screenResults = document.getElementById('screen-results');

const allScreens = [
  screenModeSelect, screenTitle, screenCountingTitle,
  screenCountdown, screenDetection, screenResults
];

// Mode select
const modeHideSeekBtn = document.getElementById('mode-hideseek-btn');
const modeCountingBtn = document.getElementById('mode-counting-btn');

// Hide and seek title
const titleStartBtn = document.getElementById('title-start-btn');
const timeLimitInput = document.getElementById('time-limit');
const backFromTitleBtn = document.getElementById('back-from-title-btn');

// Counting game title
const countingStartBtn = document.getElementById('counting-start-btn');
const countingTargetText = document.getElementById('counting-target-text');
const backFromCountingBtn = document.getElementById('back-from-counting-btn');

// Countdown
const countdownNumberEl = document.getElementById('countdown-number');

// Detection screen (shared)
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const timerBadge = document.getElementById('timer-badge');
const timeLeftEl = document.getElementById('time-left');
const targetBadge = document.getElementById('target-badge');
const targetNumberEl = document.getElementById('target-number');
const countEl = document.getElementById('count');
const stopBtn = document.getElementById('stop-btn');
const checkBtn = document.getElementById('check-btn');

// Results
const resultsEmoji = document.getElementById('results-emoji');
const resultsText = document.getElementById('results-text');
const playAgainBtn = document.getElementById('play-again-btn');
const resultsModeSelectBtn = document.getElementById('results-mode-select-btn');

let model = null;
let currentStream = null;
let animationFrameId = null;
let gameTimerId = null;
let latestPeopleCount = 0;
let gameActive = false;

let currentMode = null;   // 'hideseek' or 'counting'
let targetNumber = 0;     // used only in counting mode

function showScreen(screen) {
  allScreens.forEach(s => { s.style.display = 'none'; });
  screen.style.display = 'block';
}

// ---------- SCREEN 0: Mode Select ----------

modeHideSeekBtn.addEventListener('click', () => {
  currentMode = 'hideseek';
  showScreen(screenTitle);
});

modeCountingBtn.addEventListener('click', () => {
  currentMode = 'counting';
  targetNumber = Math.floor(Math.random() * 8) + 1; // random 1-8
  countingTargetText.textContent = `Can you make ${targetNumber} friend${targetNumber === 1 ? '' : 's'} stand together?`;
  showScreen(screenCountingTitle);
});

backFromTitleBtn.addEventListener('click', () => showScreen(screenModeSelect));
backFromCountingBtn.addEventListener('click', () => showScreen(screenModeSelect));
resultsModeSelectBtn.addEventListener('click', () => showScreen(screenModeSelect));

// ---------- SCREEN 1a/1b: Title screens ----------

titleStartBtn.addEventListener('click', () => runCountdown());
countingStartBtn.addEventListener('click', () => runCountdown());

// ---------- SCREEN 2: Countdown (shared) ----------

function runCountdown() {
  showScreen(screenCountdown);
  let count = 3;
  countdownNumberEl.textContent = count;

  const countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumberEl.textContent = count;
    } else {
      clearInterval(countdownInterval);
      startGame();
    }
  }, 1000);
}

// ---------- SCREEN 3: Detection (shared, branches by mode) ----------

async function startGame() {
  showScreen(screenDetection);
  gameActive = true;
  latestPeopleCount = 0;
  countEl.textContent = '0';

  // Show/hide mode-specific controls.
  if (currentMode === 'hideseek') {
    timerBadge.style.display = 'block';
    targetBadge.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    checkBtn.style.display = 'none';
  } else {
    timerBadge.style.display = 'none';
    targetBadge.style.display = 'block';
    targetNumberEl.textContent = targetNumber;
    stopBtn.style.display = 'none';
    checkBtn.style.display = 'inline-block';
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      document.getElementById('camera-container').style.aspectRatio =
        `${video.videoWidth} / ${video.videoHeight}`;

      if (!model) {
        model = await cocoSsd.load();
      }

      if (!gameActive) return;
      detectFrame();

      if (currentMode === 'hideseek') {
        startGameTimer();
      }
    };
  } catch (err) {
    console.error('Camera access failed:', err);
    alert('Camera access failed: ' + err.message);
    showScreen(screenModeSelect);
  }
}

async function detectFrame() {
  if (!currentStream || !model) {
    return;
  }

  const predictions = await model.detect(video);
  if (!gameActive || !currentStream) return;

  const people = predictions.filter(p => p.class === 'person' && p.score >= 0.35);
  const confidentPeople = people.filter(p => p.score >= 0.7);

  drawPredictions(people);
  latestPeopleCount = confidentPeople.length;
  countEl.textContent = latestPeopleCount;

  animationFrameId = requestAnimationFrame(detectFrame);
}

function drawPredictions(people) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  people.forEach(person => {
    const [x, y, width, height] = person.bbox;
    const isConfident = person.score >= 0.7;

    ctx.strokeStyle = isConfident ? '#2e8b57' : '#f1c40f';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    const label = isConfident
      ? `Person ${(person.score * 100).toFixed(0)}%`
      : 'Maybe?';

    ctx.fillStyle = isConfident ? '#2e8b57' : '#f1c40f';
    ctx.font = '16px sans-serif';
    ctx.fillText(label, x, y > 20 ? y - 6 : y + 16);
  });
}

// Hide and seek: timer-driven end
function startGameTimer() {
  let secondsLeft = parseInt(timeLimitInput.value, 10) || 15;
  timeLeftEl.textContent = secondsLeft;

  gameTimerId = setInterval(() => {
    secondsLeft--;
    timeLeftEl.textContent = secondsLeft;

    if (secondsLeft <= 0) {
      endGame();
    }
  }, 1000);
}

stopBtn.addEventListener('click', () => endGame());

checkBtn.addEventListener('click', () => endGame());

function endGame() {
  gameActive = false;
  if (gameTimerId) {
    clearInterval(gameTimerId);
    gameTimerId = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  video.srcObject = null;

  showResults();
}

// ---------- SCREEN 4: Results (shared, branches by mode) ----------

function showResults() {
  let isWin = false;

  if (currentMode === 'hideseek') {
    resultsEmoji.textContent = '🎉';
    resultsText.textContent = latestPeopleCount === 0
      ? "I couldn't find any of you, good hiding!"
      : `Yay! Found ${latestPeopleCount} of you!`;
    // No confetti/sound here - hide and seek is just a friendly count, not a win/lose game.
  } else {
    const won = latestPeopleCount === targetNumber;
    isWin = won;
    resultsEmoji.textContent = won ? '🏆' : '🤔';
    resultsText.textContent = won
      ? `You won! You made ${targetNumber} exactly!`
      : `So close! Target was ${targetNumber}, but I counted ${latestPeopleCount}. Try again!`;
  }

  showScreen(screenResults);

  if (isWin) {
    launchConfetti();
    playApplauseSound();
  }
}

// Lightweight confetti animation drawn on a canvas, no external library.
function launchConfetti() {
  const canvasEl = document.getElementById('confetti-canvas');
  const rect = screenResults.getBoundingClientRect();
  canvasEl.width = rect.width;
  canvasEl.height = rect.height;
  const ctx = canvasEl.getContext('2d');

  const colors = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#EF9F27'];
  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvasEl.width,
    y: -20 - Math.random() * canvasEl.height,
    size: 4 + Math.random() * 4,
    speed: 2 + Math.random() * 3,
    drift: (Math.random() - 0.5) * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360
  }));

  let frame = 0;
  const maxFrames = 150; // roughly 2.5 seconds at 60fps

  function animate() {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    pieces.forEach(p => {
      p.y += p.speed;
      p.x += p.drift;
      p.rotation += 5;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
  }

  animate();
}

// Synthesized cheerful "ta-da" chime using the Web Audio API.
// No audio file needed - built entirely from oscillator tones.
function playApplauseSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 - a bright little arpeggio

  notes.forEach((freq, i) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = freq;

    const startTime = audioCtx.currentTime + i * 0.12;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.4);
  });
}

playAgainBtn.addEventListener('click', () => {
  if (currentMode === 'counting') {
    // Pick a fresh random number for the next round.
    targetNumber = Math.floor(Math.random() * 8) + 1;
    countingTargetText.textContent = `Can you make ${targetNumber} friend${targetNumber === 1 ? '' : 's'} stand together?`;
    showScreen(screenCountingTitle);
  } else {
    showScreen(screenTitle);
  }
});
