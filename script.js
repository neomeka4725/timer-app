const setupScreen = document.getElementById("setup-screen");
const timerScreen = document.getElementById("timer-screen");
const statsScreen = document.getElementById("stats-screen");

const minutesSlider = document.getElementById("minutes-slider");
const minutesValue = document.getElementById("minutes-value");
const quickButtons = document.querySelectorAll(".quick-btn");
const startBtn = document.getElementById("start-btn");
const statsBtn = document.getElementById("stats-btn");
const wakelockWarning = document.getElementById("wakelock-warning");

const runningLabel = document.getElementById("running-label");
const countdownEl = document.getElementById("countdown");
const cancelBtn = document.getElementById("cancel-btn");
const restartBtn = document.getElementById("restart-btn");

const statSuccess = document.getElementById("stat-success");
const statFail = document.getElementById("stat-fail");
const statRate = document.getElementById("stat-rate");
const statTotal = document.getElementById("stat-total");
const recordList = document.getElementById("record-list");
const recordEmpty = document.getElementById("record-empty");
const statsBackBtn = document.getElementById("stats-back-btn");
const statsBackTop = document.getElementById("stats-back-top");
const clearBtn = document.getElementById("clear-btn");

let timerId = null;
let goalSeconds = 0; // 이번 판의 목표 시간(초)
let endTime = 0; // 끝나야 하는 시각
let remainingSeconds = 0;

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

// ---- 화면 꺼짐 방지 (Screen Wake Lock) ----
// 타이머가 도는 동안 브라우저에게 "화면을 끄지 말아 달라"고 요청한다.
// 지원하지 않는 기기에서는 조용히 넘어가고, 대신 안내 문구를 띄운다.
const wakeLockSupported = "wakeLock" in navigator;
let wakeLock = null;

if (!wakeLockSupported) {
  wakelockWarning.classList.remove("hidden");
}

async function requestWakeLock() {
  if (!wakeLockSupported) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    // 배터리 부족 등으로 브라우저가 스스로 풀어버릴 수도 있다.
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch (err) {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// ---- 화면 전환 ----

function showScreen(screen) {
  setupScreen.classList.add("hidden");
  timerScreen.classList.add("hidden");
  statsScreen.classList.add("hidden");
  screen.classList.remove("hidden");
  // 아래로 스크롤한 상태에서 화면을 바꾸면 엉뚱한 곳이 보이므로 맨 위로 올린다.
  window.scrollTo(0, 0);
}

// ---- 시간 표시 ----

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// 누적 시간을 "1시간 25분" 같은 읽기 쉬운 형태로 바꾼다.
function formatDuration(totalSeconds) {
  if (totalSeconds === 0) return "0분";
  // 1분이 안 되면 "45초"처럼 보여줘야 "0분"보다 덜 어색하다.
  if (totalSeconds < 60) return `${totalSeconds}초`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${totalMinutes}분`;
}

function formatDate(ms) {
  return new Date(ms).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---- 타이머 ----

function startTimer() {
  goalSeconds = Number(minutesSlider.value) * 60;
  remainingSeconds = goalSeconds;
  // 실제 시계를 기준으로 계산해야 시간이 밀리지 않는다.
  endTime = Date.now() + goalSeconds * 1000;

  countdownEl.textContent = formatTime(remainingSeconds);
  countdownEl.classList.remove("failed");
  runningLabel.textContent = "폰을 멀리하고 목표를 지켜보세요";
  cancelBtn.classList.remove("hidden");
  restartBtn.classList.add("hidden");

  showScreen(timerScreen);
  requestWakeLock();

  timerId = setInterval(() => {
    remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    countdownEl.textContent = formatTime(remainingSeconds);

    if (remainingSeconds <= 0) {
      finishTimer();
    }
  }, 250);
}

// 타이머를 멈추고 기록을 남기는 공통 처리.
function stopTimer(result) {
  clearInterval(timerId);
  timerId = null;
  releaseWakeLock();

  const elapsedSeconds =
    result === "success" ? goalSeconds : goalSeconds - remainingSeconds;

  saveRecord({
    at: Date.now(),
    goalMinutes: goalSeconds / 60,
    elapsedSeconds: elapsedSeconds,
    result: result,
  });

  cancelBtn.classList.add("hidden");
  restartBtn.classList.remove("hidden");
}

function finishTimer() {
  stopTimer("success");
  runningLabel.textContent = "🎉 목표 시간을 지켰어요!";
}

function failTimer() {
  stopTimer("left");
  runningLabel.textContent = "😢 화면을 벗어나서 실패했어요";
  countdownEl.classList.add("failed");
}

function giveUpTimer() {
  stopTimer("gaveup");
  runningLabel.textContent = "🏳️ 포기했어요";
  countdownEl.classList.add("failed");
}

// 화면이 사용자에게 안 보이게 되면(다른 탭·다른 앱·화면 꺼짐) 실패 처리.
// timerId가 있을 때 = 타이머가 돌아가는 중일 때만 검사한다.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && timerId !== null) {
    failTimer();
  }
});

// ---- 내 기록 화면 ----

const RESULT_ICONS = {
  success: "🎉",
  left: "😢",
  gaveup: "🏳️",
};

const RESULT_TEXTS = {
  success: "성공",
  left: "화면 이탈",
  gaveup: "포기",
};

function renderStats() {
  const records = loadRecords();
  const summary = summarize(records);

  statSuccess.textContent = summary.successCount;
  statFail.textContent = summary.failCount;
  statRate.textContent = `${summary.successRate}%`;
  statTotal.textContent = formatDuration(summary.totalSeconds);

  // 최근 기록 10개를 최신순으로 보여준다.
  const recent = records.slice(-10).reverse();
  recordEmpty.classList.toggle("hidden", recent.length > 0);

  recordList.innerHTML = "";
  recent.forEach((record) => {
    const li = document.createElement("li");

    const icon = document.createElement("span");
    icon.className = "record-icon";
    icon.textContent = RESULT_ICONS[record.result] || "•";

    const main = document.createElement("div");
    main.className = "record-main";
    main.textContent =
      `${record.goalMinutes}분 목표 · ` +
      `${formatDuration(record.elapsedSeconds)} 집중 · ` +
      `${RESULT_TEXTS[record.result] || ""}`;

    const date = document.createElement("div");
    date.className = "record-date";
    date.textContent = formatDate(record.at);
    main.appendChild(date);

    li.appendChild(icon);
    li.appendChild(main);
    recordList.appendChild(li);
  });
}

// ---- 버튼 연결 ----

startBtn.addEventListener("click", startTimer);
cancelBtn.addEventListener("click", giveUpTimer);
restartBtn.addEventListener("click", () => showScreen(setupScreen));

statsBtn.addEventListener("click", () => {
  renderStats();
  showScreen(statsScreen);
});

statsBackBtn.addEventListener("click", () => showScreen(setupScreen));
statsBackTop.addEventListener("click", () => showScreen(setupScreen));

clearBtn.addEventListener("click", () => {
  if (confirm("기록을 전부 지울까요? 되돌릴 수 없어요.")) {
    clearRecords();
    renderStats();
  }
});

updateMinutesDisplay();
