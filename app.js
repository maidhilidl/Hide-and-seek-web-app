// app.js
// Step 3: load the COCO-SSD model.
// Camera + model only start when the teacher clicks "Start Camera" —
// not automatically on page load. This avoids a surprise permission
// popup for young children and lets the teacher control when it begins.

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

let model = null;
let currentStream = null; // keep a reference so we can stop it later

async function startCamera() {
  startBtn.disabled = true; // prevent double-clicks while starting up
  statusEl.textContent = 'Requesting camera access...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });

    currentStream = stream; // save so stopCamera() can access it
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      loadModel();
    };
  } catch (err) {
    console.error('Camera access failed:', err);
    statusEl.textContent = 'Camera access failed: ' + err.message;
    startBtn.disabled = false; // let them try again
  }
}

async function loadModel() {
  statusEl.textContent = 'Loading COCO-SSD model...';
  model = await cocoSsd.load();
  statusEl.textContent = 'Model loaded. Detection loop comes next.';
  console.log('COCO-SSD model loaded:', model);
  // Swap buttons: hide Start, show Stop, now that everything is running.
  startBtn.style.display = 'none';
  stopBtn.style.display = 'inline-block';
}

function stopCamera() {
  // Stop every track in the stream — this is what actually turns off
  // the camera's hardware light, not just hiding the video on screen.
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  video.srcObject = null;

  // Clear anything drawn on the canvas so no stale boxes remain.
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reset UI back to the starting state so the teacher can start again.
  statusEl.textContent = 'Camera stopped. Click "Start Camera" to begin again.';
  stopBtn.style.display = 'none';
  startBtn.style.display = 'inline-block';
  startBtn.disabled = false;
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
