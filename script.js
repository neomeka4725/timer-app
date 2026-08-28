const nicknameScreen = document.getElementById("nickname-screen");
const nicknameInput = document.getElementById("nickname-input");
const nicknameError = document.getElementById("nickname-error");
const nicknameSaveBtn = document.getElementById("nickname-save-btn");
const greetingName = document.getElementById("greeting-name");
const statsName = document.getElementById("stats-name");
const renameBtn = document.getElementById("rename-btn");

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
const syncStatus = document.getElementById("sync-status");
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
  nicknameScreen.classList.add("hidden");
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

  const record = {
    at: Date.now(),
    nickname: loadNickname(),
    goalMinutes: goalSeconds / 60,
    elapsedSeconds: elapsedSeconds,
    result: result,
    synced: false,
  };

  // 먼저 이 기기에 저장한다. 인터넷이 끊겨도 기록은 남아야 하니까.
  saveRecord(record);

  // 그다음 조용히 인터넷에 올린다. 실패해도 앱은 그대로 쓸 수 있고,
  // 다음에 기록 화면을 열 때 다시 올린다.
  cloudSaveRecord(record)
    .then(() => markRecordSynced(record.at))
    .catch(() => {});

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

// 아직 못 올린 기록들을 다시 올려본다.
async function pushUnsynced(nickname) {
  for (const record of unsyncedRecords()) {
    // 닉네임을 바꿨다면 지금 이름으로 올린다.
    await cloudSaveRecord({ ...record, nickname: nickname });
    markRecordSynced(record.at);
  }
}

// 보여줄 기록을 정한다. 인터넷이 되면 인터넷 기록(모든 기기의 기록)을,
// 안 되면 이 기기에 있는 기록만 쓴다.
async function collectRecords(nickname) {
  try {
    await pushUnsynced(nickname);
    const cloud = await cloudLoadRecords(nickname);
    // 방금 올리지 못한 게 남아 있으면 화면에서는 함께 보여준다.
    const stillLocal = unsyncedRecords();
    return {
      records: [...cloud, ...stillLocal].sort((a, b) => a.at - b.at),
      online: true,
    };
  } catch (err) {
    return { records: loadRecords(), online: false };
  }
}

async function renderStats() {
  const nickname = loadNickname();
  statsName.textContent = nickname;

  syncStatus.textContent = "☁️ 기록을 불러오는 중…";
  syncStatus.classList.remove("offline");

  const result = await collectRecords(nickname);
  const records = result.records;

  if (result.online) {
    syncStatus.textContent = "☁️ 모든 기기의 기록을 합쳐서 보여주고 있어요";
  } else {
    syncStatus.textContent =
      "⚠️ 인터넷에 연결되지 않아 이 기기 기록만 보여요";
    syncStatus.classList.add("offline");
  }

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
  const message =
    "이 기기에 저장된 기록을 지울까요?\n\n" +
    "이미 인터넷에 올라간 기록은 남아 있어서, 인터넷이 연결되면 다시 보입니다.";
  if (confirm(message)) {
    clearRecords();
    renderStats();
  }
});

renameBtn.addEventListener("click", () => askNickname());

// ---- 닉네임 ----

// 닉네임을 묻는 화면을 띄운다. 이미 있으면 입력칸에 미리 채워 둔다.
function askNickname() {
  nicknameInput.value = loadNickname();
  nicknameError.classList.add("hidden");
  showScreen(nicknameScreen);
}

function confirmNickname() {
  const name = saveNickname(nicknameInput.value);
  if (name === "") {
    nicknameError.classList.remove("hidden");
    return;
  }
  greetingName.textContent = name;
  showScreen(setupScreen);
}

nicknameSaveBtn.addEventListener("click", confirmNickname);

// 키보드에서 엔터를 눌러도 저장되게 한다.
nicknameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmNickname();
});

// ---- 앱 시작 ----

updateMinutesDisplay();

const savedNickname = loadNickname();
if (savedNickname === "") {
  // 처음 온 사람에게는 닉네임부터 묻는다.
  askNickname();
} else {
  greetingName.textContent = savedNickname;
  showScreen(setupScreen);
}
