const setupScreen = document.getElementById("setup-screen");
const timerScreen = document.getElementById("timer-screen");

const minutesSlider = document.getElementById("minutes-slider");
const minutesValue = document.getElementById("minutes-value");
const quickButtons = document.querySelectorAll(".quick-btn");
const startBtn = document.getElementById("start-btn");

const runningLabel = document.getElementById("running-label");
const countdownEl = document.getElementById("countdown");
const cancelBtn = document.getElementById("cancel-btn");
const restartBtn = document.getElementById("restart-btn");

let remainingSeconds = 0;
let timerId = null;

function updateMinutesDisplay() {
  minutesValue.textContent = minutesSlider.value;
  quickButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.minutes === minutesSlider.value);
  });
}

minutesSlider.addEventListener("input", updateMinutesDisplay);

quickButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    minutesSlider.value = btn.dataset.minutes;
    updateMinutesDisplay();
  });
});

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function showScreen(screen) {
  setupScreen.classList.add("hidden");
  timerScreen.classList.add("hidden");
  screen.classList.remove("hidden");
}

function startTimer() {
  remainingSeconds = Number(minutesSlider.value) * 60;
  countdownEl.textContent = formatTime(remainingSeconds);
  runningLabel.textContent = "폰을 멀리하고 목표를 지켜보세요";
  cancelBtn.classList.remove("hidden");
  restartBtn.classList.add("hidden");

  showScreen(timerScreen);

  timerId = setInterval(() => {
    remainingSeconds -= 1;
    countdownEl.textContent = formatTime(remainingSeconds);

    if (remainingSeconds <= 0) {
      finishTimer();
    }
  }, 1000);
}

function finishTimer() {
  clearInterval(timerId);
  timerId = null;
  runningLabel.textContent = "🎉 목표 시간을 지켰어요!";
  cancelBtn.classList.add("hidden");
  restartBtn.classList.remove("hidden");
}

function cancelTimer() {
  clearInterval(timerId);
  timerId = null;
  showScreen(setupScreen);
}

startBtn.addEventListener("click", startTimer);
cancelBtn.addEventListener("click", cancelTimer);
restartBtn.addEventListener("click", () => showScreen(setupScreen));

updateMinutesDisplay();
