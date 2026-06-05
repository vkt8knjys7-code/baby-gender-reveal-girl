const scratchCard = document.getElementById("scratchCard");
const scratchLayer = document.getElementById("scratchLayer");
const scratchHint = document.getElementById("scratchHint");
const revealActions = document.getElementById("revealActions");
const readyButton = document.getElementById("readyButton");
const helpRevealButton = document.getElementById("helpRevealButton");
const modalBackdrop = document.getElementById("modalBackdrop");
const countdownPanel = document.getElementById("countdownPanel");
const countdownText = document.getElementById("countdownText");
const countdownNumber = document.getElementById("countdownNumber");
const confettiLayer = document.getElementById("confettiLayer");
const babyVoiceAudio = document.getElementById("babyVoiceAudio");

const ctx = scratchLayer.getContext("2d", { willReadFrequently: true });

let isScratching = false;
let isRevealed = false;
let countdownTimeout = null;
const SCRATCH_THRESHOLD = 0.4;
const BRUSH_RADIUS = 28;
const COVERAGE_CELL_SIZE = 18;

let scratchedCells = new Set();
let totalCells = 0;
let scratchBounds = { width: 0, height: 0, cols: 0, rows: 0 };
let lastPoint = null;
let helpRevealTimeout = null;
let copyRevealTimeout = null;
let headingRevealTimeout = null;
let messagePromptShown = false;
const REVEAL_ACTION_DELAY = 10000;
const COUNTDOWN_SECONDS = 10;
const HEADING_PAUSE_DELAY = 2000;
const COPY_PAUSE_DELAY = 5000;
let audioContext = null;

function resizeScratchLayer() {
  const ratio = window.devicePixelRatio || 1;
  const rect = scratchLayer.getBoundingClientRect();

  scratchLayer.width = rect.width * ratio;
  scratchLayer.height = rect.height * ratio;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  initializeScratchGrid(rect.width, rect.height);
  drawScratchSurface(rect.width, rect.height);
}

function initializeScratchGrid(width, height) {
  const cols = Math.ceil(width / COVERAGE_CELL_SIZE);
  const rows = Math.ceil(height / COVERAGE_CELL_SIZE);

  scratchedCells = new Set();
  totalCells = cols * rows;
  scratchBounds = { width, height, cols, rows };
}

function drawScratchSurface(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f3f4f7");
  gradient.addColorStop(0.2, "#c6cbd1");
  gradient.addColorStop(0.45, "#f9fafb");
  gradient.addColorStop(0.7, "#aab0b7");
  gradient.addColorStop(1, "#e3e7ec");

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = -height; i < width + height; i += 18) {
    ctx.strokeStyle = i % 36 === 0 ? "rgba(255,255,255,0.35)" : "rgba(126,136,149,0.2)";
    ctx.lineWidth = i % 36 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  for (let i = 0; i < 6; i += 1) {
    const shine = ctx.createLinearGradient(0, height * (0.12 + i * 0.13), width, height * (0.2 + i * 0.13));
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.24)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, height * (0.08 + i * 0.13), width, height * 0.08);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, width - 20, height - 20);
}

function getPoint(event) {
  const rect = scratchLayer.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function scratchAtPoint(x, y) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  markScratchedCells(x, y, BRUSH_RADIUS);
}

function markScratchedCells(x, y, radius) {
  const { cols, rows } = scratchBounds;
  const minCol = Math.max(0, Math.floor((x - radius) / COVERAGE_CELL_SIZE));
  const maxCol = Math.min(cols - 1, Math.floor((x + radius) / COVERAGE_CELL_SIZE));
  const minRow = Math.max(0, Math.floor((y - radius) / COVERAGE_CELL_SIZE));
  const maxRow = Math.min(rows - 1, Math.floor((y + radius) / COVERAGE_CELL_SIZE));

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const cellCenterX = col * COVERAGE_CELL_SIZE + COVERAGE_CELL_SIZE / 2;
      const cellCenterY = row * COVERAGE_CELL_SIZE + COVERAGE_CELL_SIZE / 2;
      const distance = Math.hypot(cellCenterX - x, cellCenterY - y);

      if (distance <= radius) {
        scratchedCells.add(`${col}:${row}`);
      }
    }
  }
}

function scratchLine(fromPoint, toPoint) {
  const distance = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
  const stepSize = Math.max(8, BRUSH_RADIUS * 0.45);
  const steps = Math.max(1, Math.ceil(distance / stepSize));

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = fromPoint.x + (toPoint.x - fromPoint.x) * progress;
    const y = fromPoint.y + (toPoint.y - fromPoint.y) * progress;
    scratchAtPoint(x, y);
  }
}

function handleScratch(event) {
  if (!isScratching || isRevealed) {
    return;
  }

  event.preventDefault();
  const point = getPoint(event);

  if (lastPoint) {
    scratchLine(lastPoint, point);
  } else {
    scratchAtPoint(point.x, point.y);
  }

  lastPoint = point;

  scratchHint.hidden = true;
  helpRevealButton.hidden = false;

  const scratchedRatio = scratchedCells.size / totalCells;

  if (scratchedRatio >= SCRATCH_THRESHOLD) {
    revealCard();
  }
}

function revealCard() {
  if (isRevealed) {
    return;
  }

  isRevealed = true;
  messagePromptShown = false;
  scratchCard.classList.add("revealed");
  ctx.clearRect(0, 0, scratchLayer.width, scratchLayer.height);
  helpRevealButton.hidden = true;
  launchConfetti();

  window.clearTimeout(headingRevealTimeout);
  window.clearTimeout(copyRevealTimeout);
  headingRevealTimeout = window.setTimeout(() => {
    scratchCard.classList.add("heading-visible");
  }, HEADING_PAUSE_DELAY);
  copyRevealTimeout = window.setTimeout(() => {
    scratchCard.classList.add("copy-visible");
    playBabyMessageSequence();
  }, COPY_PAUSE_DELAY);
}

function endScratch() {
  isScratching = false;
  lastPoint = null;
}

function beginScratch(event) {
  if (isRevealed) {
    return;
  }

  scratchLayer.setPointerCapture(event.pointerId);
  isScratching = true;
  lastPoint = null;
  window.clearTimeout(helpRevealTimeout);
  helpRevealTimeout = window.setTimeout(() => {
    if (!isRevealed) {
      helpRevealButton.hidden = false;
    }
  }, 2500);
  handleScratch(event);
}

function launchConfetti() {
  confettiLayer.innerHTML = "";

  const colors = ["#fff5fa", "#ffb9d5", "#ff89bb", "#ff5fa2", "#ffd6e8"];

  for (let i = 0; i < 44; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${3.8 + Math.random() * 2.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.setProperty("--drift", `${Math.random() * 120 - 60}px`);
    piece.style.transform = `scale(${0.8 + Math.random() * 1.1})`;
    confettiLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    confettiLayer.innerHTML = "";
  }, 7000);
}

function playMessageChime() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

  const notes = [
    { frequency: 740, start: 0, duration: 0.16 },
    { frequency: 988, start: 0.18, duration: 0.22 }
  ];

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
    oscillator.connect(gain);
    oscillator.start(now + note.start);
    oscillator.stop(now + note.start + note.duration);
  });
}

function playCountdownTick() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  const oscillator = audioContext.createOscillator();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.14);
}

function showMessagePrompt() {
  if (messagePromptShown) {
    return;
  }

  messagePromptShown = true;
  revealActions.hidden = false;
  playMessageChime();
  readyButton.focus({ preventScroll: true });
}

function getBabyMessageText() {
  return [
    "I've been listening to all your guesses from inside.",
    "Honestly, some of them were hilarious.",
    "I've decided to keep everyone confused for just a little longer.",
    "The answer is coming."
  ].join(" ");
}

function playRecordedBabyVoice() {
  return new Promise((resolve, reject) => {
    if (!babyVoiceAudio) {
      reject(new Error("Missing baby voice audio"));
      return;
    }

    const source = babyVoiceAudio.querySelector("source");
    if (!source || !source.getAttribute("src")) {
      reject(new Error("Missing baby voice source"));
      return;
    }

    const cleanup = () => {
      babyVoiceAudio.removeEventListener("ended", handleEnded);
      babyVoiceAudio.removeEventListener("error", handleError);
    };

    const handleEnded = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Baby voice audio failed"));
    };

    babyVoiceAudio.currentTime = 0;
    babyVoiceAudio.addEventListener("ended", handleEnded, { once: true });
    babyVoiceAudio.addEventListener("error", handleError, { once: true });

    const playPromise = babyVoiceAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        cleanup();
        reject(error);
      });
    }
  });
}

function speakFallbackMessage() {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(getBabyMessageText());
    utterance.rate = 0.88;
    utterance.pitch = 1.45;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) =>
      /female|samantha|victoria|karen|moira|zira|ava|allison/i.test(voice.name)
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Speech synthesis failed"));

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function playBabyMessageSequence() {
  try {
    await playRecordedBabyVoice();
    showMessagePrompt();
    return;
  } catch (error) {
    // Prefer a real audio file. Fall back only if it is unavailable or blocked.
  }

  try {
    await speakFallbackMessage();
  } catch (error) {
    // Avoid blocking the experience forever if browser speech is unavailable.
  }

  showMessagePrompt();
}

function openModal() {
  modalBackdrop.hidden = false;
  readyButton.setAttribute("aria-expanded", "true");
  countdownPanel.hidden = false;
  startCountdown();
}

function renderCountdown(secondsRemaining) {
  if (secondsRemaining > 0) {
    countdownNumber.textContent = secondsRemaining;
    countdownText.textContent = `Opening in ${secondsRemaining} seconds...`;
    return;
  }

  countdownNumber.textContent = "!";
  countdownText.textContent = "Check Your WhatsApp now 🙂";
}

function startCountdown() {
  if (countdownTimeout) {
    return;
  }

  let secondsRemaining = COUNTDOWN_SECONDS;
  renderCountdown(secondsRemaining);
  playCountdownTick();

  const tick = () => {
    secondsRemaining -= 1;
    renderCountdown(secondsRemaining);

    if (secondsRemaining === 0) {
      countdownTimeout = null;
      return;
    }

    playCountdownTick();
    countdownTimeout = window.setTimeout(tick, 1000);
  };

  countdownTimeout = window.setTimeout(tick, 1000);
}

scratchLayer.addEventListener("pointerdown", beginScratch);
scratchLayer.addEventListener("pointermove", handleScratch);
window.addEventListener("pointerup", endScratch);
window.addEventListener("pointercancel", endScratch);

readyButton.addEventListener("click", openModal);
helpRevealButton.addEventListener("click", revealCard);

window.addEventListener("resize", () => {
  if (!isRevealed) {
    resizeScratchLayer();
  }
});

resizeScratchLayer();
