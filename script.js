const nicknameScreen = document.getElementById("nickname-screen");
const nicknameInput = document.getElementById("nickname-input");
const pinInput = document.getElementById("pin-input");
const nicknameError = document.getElementById("nickname-error");
const nicknameSaveBtn = document.getElementById("nickname-save-btn");
const nicknameCancelBtn = document.getElementById("nickname-cancel-btn");
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

const missionInput = document.getElementById("mission-input");
const missionLabel = document.getElementById("mission-label");

const runningLabel = document.getElementById("running-label");
const countdownEl = document.getElementById("countdown");
const ringProgress = document.getElementById("ring-progress");
const ringSub = document.getElementById("ring-sub");
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

const shareBox = document.getElementById("share-box");
const shareMessage = document.getElementById("share-message");
const shareBtn = document.getElementById("share-btn");
const shareStatus = document.getElementById("share-status");

const boardScreen = document.getElementById("board-screen");
const boardBtn = document.getElementById("board-btn");
const boardStatus = document.getElementById("board-status");
const boardList = document.getElementById("board-list");
const boardRefresh = document.getElementById("board-refresh");

const rankScreen = document.getElementById("rank-screen");
const rankBtn = document.getElementById("rank-btn");
const rankStatus = document.getElementById("rank-status");
const rankList = document.getElementById("rank-list");
const rankSortButtons = document.querySelectorAll(".rank-sort");

const soundToggle = document.getElementById("sound-toggle");
const soundTest = document.getElementById("sound-test");
const pomodoroToggle = document.getElementById("pomodoro-toggle");
const roundBadge = document.getElementById("round-badge");
const nextFocusBtn = document.getElementById("next-focus-btn");
const stopPomoBtn = document.getElementById("stop-pomo-btn");
const forgiveNote = document.getElementById("forgive-note");
const boardDot = document.getElementById("board-dot");
const installTip = document.getElementById("install-tip");

const tierBadge = document.getElementById("tier-badge");
const tierTokens = document.getElementById("tier-tokens");
const tierBarFill = document.getElementById("tier-bar-fill");
const tierNext = document.getElementById("tier-next");

const liveScreen = document.getElementById("live-screen");
const liveBtn = document.getElementById("live-btn");
const liveStatus = document.getElementById("live-status");
const liveList = document.getElementById("live-list");
const liveRefresh = document.getElementById("live-refresh");
const splitWarning = document.getElementById("split-warning");
const splitNumbers = document.getElementById("split-numbers");

let timerId = null;
let lastRecord = null; // 방금 끝낸 판 (게시판에 올릴 때 쓴다)

// ---- 쉬었다 하기(뽀모도로) ----
// 지금이 어떤 상태인지 한 곳에서 관리한다. 화면 이탈을 실패로 볼지 말지가
// 여기에 달려 있어서, 이 값이 틀리면 억울한 실패가 생긴다.
//   idle      : 타이머를 안 돌리는 중
//   focus     : 집중 중 (화면을 벗어나면 실패)
//   break     : 쉬는 중 (화면을 벗어나도 괜찮다)
//   breakDone : 쉬는 시간이 끝나고 다음 집중을 기다리는 중
let phase = "idle";
let pomodoroOn = loadPomodoroOn();
let breakTimerId = null;
let breakEndTime = 0;
let roundNo = 0; // 몇 번째 집중인지

const BREAK_SECONDS = 5 * 60;
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

// ---- 끝났을 때 소리 알리기 ----
// 소리 파일을 받지 않고 브라우저가 직접 음을 만들게 한다.
// iOS는 사용자가 버튼을 누른 적이 없으면 소리를 막기 때문에,
// "시작하기"를 누를 때 소리 장치를 미리 깨워 둔다.

let audioCtx = null;
let soundOn = loadSoundOn();

const soundHint = soundToggle.querySelector("small");
const soundIcon = soundToggle.querySelector(".switch-icon");

function updateSoundToggle() {
  soundToggle.classList.toggle("on", soundOn);
  soundToggle.setAttribute("aria-pressed", soundOn ? "true" : "false");
  soundIcon.textContent = soundOn ? "🔔" : "🔕";
  soundHint.textContent = soundOn
    ? "수업 중이면 꺼두세요"
    : "지금은 소리가 안 나요";
}

function wakeUpAudio() {
  if (!soundOn) return;
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    // 잠들어 있으면 깨운다. 버튼을 누른 지금이 아니면 못 깨운다.
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {
    audioCtx = null;
  }
}

// 알림 소리를 울린다.
// 기기 음량이 낮으면 안 들리는데, 웹 앱은 기기 음량을 올릴 권한이 없다.
// 그래서 "같은 음량에서 최대한 잘 들리게" 만드는 쪽으로 해결한다.
//  - 멜로디보다 반복되는 삐- 소리가 훨씬 잘 들린다
//  - 삼각파는 사인파보다 배음이 많아 같은 크기에서도 또렷하다
//  - 한 번 울리고 마는 대신 3세트를 반복해 놓칠 확률을 줄인다
// 지금 울리고 있는(또는 울릴 예정인) 소리를 들고 있는다.
// 예약만 해두고 놓아버리면 소리를 꺼도 이미 예약된 것이 그대로 울린다.
let liveSounds = [];

function stopChime() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  liveSounds.forEach((node) => {
    // 1) 먼저 소리 크기를 0으로 못박는다. 예약해둔 오르내림도 지운다.
    //    osc.stop() 만 부르면 "아직 시작 전인" 소리가 남아서 울리는 일이
    //    있는데, 크기를 0으로 만들면 무엇이 남아 있든 들리지 않는다.
    try {
      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(0, now);
    } catch (err) {
      // 값을 못 바꿔도 아래에서 끊어버린다.
    }
    // 2) 오실레이터를 멈추고
    try {
      node.osc.stop(now);
    } catch (err) {
      // 이미 끝난 소리는 멈출 게 없다.
    }
    // 3) 스피커에서 아예 떼어낸다. 여기까지 하면 확실히 조용해진다.
    try {
      node.gain.disconnect();
      node.osc.disconnect();
    } catch (err) {
      // 이미 끊긴 것도 있다.
    }
  });
  liveSounds = [];
}

function playChime() {
  if (!soundOn || !audioCtx) return;
  // 앞 소리가 아직 울리는 중이면 멈추고 새로 울린다.
  // 안 그러면 미리 듣기를 연달아 누를 때마다 소리가 겹쳐 쌓인다.
  stopChime();
  try {
    const beeps = [];
    for (let set = 0; set < 3; set++) {
      const base = set * 0.85;
      beeps.push({ at: base, hz: 880 });
      beeps.push({ at: base + 0.22, hz: 1175 });
      beeps.push({ at: base + 0.44, hz: 880 });
    }

    beeps.forEach((b) => {
      const start = audioCtx.currentTime + b.at;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = b.hz;
      // 소리가 뚝 끊기면 "딱" 하는 잡음이 나므로 부드럽게 올렸다 내린다.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.7, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.21);
      liveSounds.push({ osc: osc, gain: gain });
    });
  } catch (err) {
    // 소리가 안 나도 타이머는 그대로 동작해야 한다.
  }
}

// 갤럭시 등에서는 진동도 울린다. 아이폰·아이패드는 이 기능이 없어서
// 조용히 넘어간다. 음량이 낮을 때를 대비한 두 번째 수단이다.
function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  } catch (err) {
    // 진동이 안 돼도 상관없다.
  }
}

// 소리를 못 들어도 눈으로 알 수 있게 화면을 몇 번 밝게 번쩍인다.
// 타이머 중에는 화면이 켜져 있으므로(화면 꺼짐 방지) 눈에 띈다.
function flashScreen() {
  timerScreen.classList.remove("celebrate");
  // 클래스를 뗐다 바로 붙이면 브라우저가 눈치채지 못하므로 한 박자 쉰다.
  void timerScreen.offsetWidth;
  timerScreen.classList.add("celebrate");
}

// 끝났을 때 알리는 세 가지를 한꺼번에.
function alertFinished() {
  playChime();
  vibrate();
  flashScreen();
}

soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;
  saveSoundOn(soundOn);
  updateSoundToggle();

  // 스위치를 누르면 어느 쪽이든 소리를 멈춘다.
  // 켤 때 소리를 들려주면, 껐다 켰다 하는 동안 계속 삐- 소리가 나서
  // "껐는데도 소리가 난다"처럼 느껴진다. 스위치는 조용해야 한다.
  // 들어보고 싶으면 바로 아래 "미리 듣기"가 있다.
  stopChime();

  // 켤 때는 소리 장치만 깨워 둔다.
  // iOS는 버튼을 누른 그 순간이 아니면 소리 장치를 못 깨운다.
  if (soundOn) wakeUpAudio();
});

// 미리 듣기: 지금 기기 음량으로 실제로 들리는지 확인할 수 있게 한다.
soundTest.addEventListener("click", () => {
  if (!soundOn) {
    soundOn = true;
    saveSoundOn(true);
    updateSoundToggle();
  }
  wakeUpAudio();
  playChime();
  vibrate();
});

// ---- 쉬었다 하기 (뽀모도로) ----

const pomodoroHint = pomodoroToggle.querySelector("small");

function updatePomodoroToggle() {
  pomodoroToggle.classList.toggle("on", pomodoroOn);
  pomodoroToggle.setAttribute("aria-pressed", pomodoroOn ? "true" : "false");
  pomodoroHint.textContent = pomodoroOn
    ? "집중이 끝나면 5분 쉬어요"
    : "목표 시간만 재고 끝나요";
}

pomodoroToggle.addEventListener("click", () => {
  pomodoroOn = !pomodoroOn;
  savePomodoroOn(pomodoroOn);
  updatePomodoroToggle();
});

// 쉬는 시간을 시작한다. 이때부터는 화면을 벗어나도 실패가 아니다.
function startBreak() {
  phase = "break";
  breakEndTime = Date.now() + BREAK_SECONDS * 1000;

  timerScreen.classList.add("resting");
  setResultState("");
  countdownEl.classList.remove("failed");
  renderCountdown(BREAK_SECONDS);
  setRing(1);
  setRingSub("쉬고 오세요");
  // 쉬는 화면은 초록색이라 어두운 집중 화면에서 빠져나온다.
  setFocusMode(false);
  runningLabel.textContent = "☕ 쉬는 시간이에요. 폰 봐도 괜찮아요";
  forgiveNote.classList.add("hidden");

  cancelBtn.classList.add("hidden");
  restartBtn.classList.add("hidden");
  nextFocusBtn.textContent = "바로 집중 시작";
  nextFocusBtn.classList.remove("hidden");
  stopPomoBtn.classList.remove("hidden");

  breakTimerId = setInterval(() => {
    const left = Math.max(0, Math.round((breakEndTime - Date.now()) / 1000));
    renderCountdown(left);
    setRing(left / BREAK_SECONDS);
    if (left <= 0) endBreak();
  }, 250);
}

// 쉬는 시간이 끝났다. 다음 집중은 자동으로 시작하지 않는다.
// 폰을 보고 있는 사이에 몰래 시작되면 돌아오자마자 실패로 기록되기 때문이다.
function endBreak() {
  clearInterval(breakTimerId);
  breakTimerId = null;
  phase = "breakDone";

  runningLabel.textContent = "쉬는 시간 끝! 준비되면 눌러주세요";
  // 00:00 에 "쉬고 오세요"가 그대로 남아 있으면 아직 쉬는 중처럼 보인다.
  // 다음 판이 몇 분짜리인지 미리 보여준다.
  renderCountdown(goalSeconds);
  setRing(1);
  setRingSub("다음 집중");
  nextFocusBtn.textContent = "▶️ 집중 시작";
  // 화면은 이미 초록색이라 번쩍임 대신 소리와 진동으로만 알린다.
  playChime();
  vibrate();
}

function stopPomodoro() {
  clearInterval(breakTimerId);
  breakTimerId = null;
  phase = "idle";
  timerScreen.classList.remove("resting");
  releaseWakeLock();
  showScreen(setupScreen);
}

nextFocusBtn.addEventListener("click", () => {
  // 시작하기 버튼에만 막이 있으면, 쉬는 동안 화면을 나눠놓고 여기로
  // 들어오는 길이 열린다. 설정 화면의 안내는 지금 안 보이므로
  // 타이머 화면 문구로 알려준다.
  if (splitViewInfo().split) {
    runningLabel.textContent =
      "🪟 화면을 나눠 쓰는 중이에요. 전체화면으로 바꾼 뒤 눌러주세요";
    return;
  }
  clearInterval(breakTimerId);
  breakTimerId = null;
  startTimer();
});

stopPomoBtn.addEventListener("click", stopPomodoro);

// ---- 홈 화면에 추가 안내 ----
// 이미 홈 화면에서 열고 있으면 안내가 필요 없으므로 숨긴 채로 둔다.
// standalone = 주소창 없이 앱처럼 열린 상태.
// navigator.standalone 은 아이폰·아이패드 전용 표시다.
function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

if (!isInstalled()) {
  installTip.classList.remove("hidden");
}

// ---- 화면 전환 ----

function showScreen(screen) {
  nicknameScreen.classList.add("hidden");
  setupScreen.classList.add("hidden");
  timerScreen.classList.add("hidden");
  statsScreen.classList.add("hidden");
  boardScreen.classList.add("hidden");
  rankScreen.classList.add("hidden");
  liveScreen.classList.add("hidden");
  screen.classList.remove("hidden");
  // 타이머 화면이 아닌 곳으로 옮기면 어두운 배경은 반드시 풀어준다.
  // 한 곳에서 정리해두면 나중에 화면을 추가해도 어둡게 남는 일이 없다.
  if (screen !== timerScreen) setFocusMode(false);
  // 도전 중 화면을 떠나면 1초마다 도는 시계를 멈춘다.
  if (screen !== liveScreen) stopLiveTicker();
  // 설정 화면을 열 때마다 나눠쓰기 안내를 다시 확인한다.
  if (screen === setupScreen) updateSplitWarning();
  // 아래로 스크롤한 상태에서 화면을 바꾸면 엉뚱한 곳이 보이므로 맨 위로 올린다.
  window.scrollTo(0, 0);
}

// ---- 시간 표시 ----

// ---- 남은 시간 링 ----
// 숫자를 읽지 않아도 얼마나 남았는지 한눈에 보이게 한다.
// 원의 둘레만큼 점선을 그려놓고, 남은 비율만큼만 보이게 잘라낸다.
const RING_RADIUS = 120;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// left: 남은 비율(0~1). 1이면 꽉 찬 원, 0이면 아무것도 안 보인다.
function setRing(left, failed) {
  if (!ringProgress) return;
  ringProgress.classList.toggle("failed", failed === true);
  const safe = Math.max(0, Math.min(1, left));
  ringProgress.style.strokeDasharray = RING_LENGTH;
  ringProgress.style.strokeDashoffset = RING_LENGTH * (1 - safe);
}

// 시간을 화면에 쓴다. 초 단위는 흐리게 해서 자꾸 쳐다보지 않게 한다.
// (폰을 멀리하라는 앱이 화면을 계속 보게 만들면 앞뒤가 안 맞는다)
function setRingSub(text) {
  ringSub.textContent = text;
}

function renderCountdown(totalSeconds) {
  const text = formatTime(totalSeconds);
  const colon = text.indexOf(":");
  countdownEl.textContent = text.slice(0, colon);
  const sec = document.createElement("span");
  sec.className = "sec";
  sec.textContent = text.slice(colon);
  countdownEl.appendChild(sec);
}

// 집중 중에만 화면을 어둡게 한다.
// 큰 숫자 하나만 보는 화면이라 어두워도 읽기 어렵지 않고, 야자 시간에 눈이
// 덜 부시다. 글을 읽는 화면(기록·게시판)은 밝은 쪽이 잘 읽혀서 그대로 둔다.
function setFocusMode(on) {
  document.body.classList.toggle("focus-mode", on);
}

// 판이 끝났을 때 화면 전체의 색을 바꾼다. "" 은 아무 결과도 아닌 상태.
// 성공은 초록, 실패·포기는 붉은색. 번쩍임이 끝난 뒤에도 색이 남아 있어야
// 무슨 결과였는지 나중에 봐도 알 수 있다.
function setResultState(kind) {
  timerScreen.classList.toggle("done-success", kind === "success");
  timerScreen.classList.toggle("done-fail", kind === "fail");
  // 성공했을 때는 게시판에 올리는 쪽이 주인공이라 "다시 하기"를 뒤로 뺀다.
  restartBtn.classList.toggle("as-secondary", kind === "success");
}

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
  // 쉬는 시간에서 이어서 시작한 것이면 회차를 하나 올리고,
  // 이미 집중 중이면 아무것도 하지 않는다. 버튼을 겹쳐 누르면 회차가
  // 1로 되돌아가거나 시간이 다시 채워지는 일이 생긴다.
  if (phase === "focus") return;

  // 그냥 새로 시작한 것이면 1회차부터 센다.
  roundNo = phase === "break" || phase === "breakDone" ? roundNo + 1 : 1;
  phase = "focus";

  // 쉬는 시간 타이머가 남아 있으면 정리한다.
  if (breakTimerId !== null) {
    clearInterval(breakTimerId);
    breakTimerId = null;
  }
  timerScreen.classList.remove("resting");
  setResultState("");
  nextFocusBtn.classList.add("hidden");
  stopPomoBtn.classList.add("hidden");

  // 몇 번째 집중인지 보여준다. 쉬었다 하기를 안 쓰면 필요 없다.
  roundBadge.textContent = roundNo + "번째 집중";
  roundBadge.classList.toggle("hidden", !pomodoroOn);

  // 이미 도는 타이머가 있으면 반드시 먼저 멈춘다.
  // 안 그러면 옛 타이머가 계속 돌면서 기록이 중복으로 저장된다.
  // (버튼을 빠르게 두 번 누르는 것만으로도 일어날 수 있다)
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  goalSeconds = Number(minutesSlider.value) * 60;
  remainingSeconds = goalSeconds;
  // 실제 시계를 기준으로 계산해야 시간이 밀리지 않는다.
  endTime = Date.now() + goalSeconds * 1000;

  renderCountdown(remainingSeconds);
  countdownEl.classList.remove("failed");
  setRing(1);
  setRingSub("남았어요");
  setFocusMode(true);

  // 무엇에 집중하는지 적어두면 딴짓하려다 한 번 멈칫하게 된다.
  const mission = missionInput.value.trim();
  missionLabel.textContent = mission;
  missionLabel.classList.toggle("hidden", mission === "");

  runningLabel.textContent = "폰을 멀리하고 목표를 지켜보세요";
  cancelBtn.classList.remove("hidden");
  restartBtn.classList.add("hidden");
  shareBox.classList.add("hidden");
  timerScreen.classList.remove("celebrate");

  // 이번 판의 봐주기 횟수를 초기화한다.
  forgiveCount = 0;
  leftAt = 0;
  forgiveNote.classList.add("hidden");

  showScreen(timerScreen);
  // 지금 도전 중 목록에 올린다. 실패해도 타이머는 그대로 돈다.
  beginChallenge();
  requestWakeLock();
  // 버튼을 누른 지금이 소리 장치를 깨울 수 있는 유일한 순간이다.
  wakeUpAudio();

  timerId = setInterval(() => {
    remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    renderCountdown(remainingSeconds);
    setRing(goalSeconds === 0 ? 0 : remainingSeconds / goalSeconds);

    // 화면을 벗어나 있는 동안에는 성공으로 끝내지 않는다.
    // 안 그러면 나갔다 오기만 해도 성공이 되어버린다.
    // 돌아왔을 때 봐줄지 실패로 볼지 판단한 뒤에 끝낸다.
    if (remainingSeconds <= 0 && !document.hidden) {
      finishTimer();
    }
  }, 250);
}

// 타이머를 멈추고 기록을 남기는 공통 처리.
// awaySeconds: 화면을 벗어나 있던 시간. 실제로 집중한 시간에서 빼야 한다.
// 예를 들어 60분을 걸고 30분 나가 있다가 돌아오면 시계상으로는 30분이
// 지났지만 집중한 시간은 0분이다. 이걸 안 빼면 기록에 "30분 집중"이라고
// 남아서 사실과 달라진다.
function stopTimer(result, awaySeconds) {
  clearInterval(timerId);
  timerId = null;
  releaseWakeLock();
  // 성공·실패·포기·화면 이탈이 모두 여기를 지나므로 한 곳에서 내린다.
  endChallenge();

  const away = Math.round(awaySeconds || 0);
  const elapsedSeconds =
    result === "success"
      ? goalSeconds
      : Math.max(0, goalSeconds - remainingSeconds - away);

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
  lastRecord = record;
}

function finishTimer() {
  stopTimer("success");
  // 다 채웠으니 링도 꽉 찬 모습으로 둔다.
  setRing(1);
  // 남은 시간(0:00)이 아니라 채운 시간을 보여준다. 끝난 화면에서 0:00 은
  // 아무 뜻도 없고, "25:00 해냈다"가 훨씬 읽기 쉽다.
  renderCountdown(goalSeconds);
  setRingSub("채웠어요");
  // 번쩍임은 밝은 화면에서 보여야 자연스러우므로 먼저 어둠을 푼다.
  setFocusMode(false);
  setResultState("success");
  alertFinished();

  // 성공했을 때만 게시판에 자랑할 수 있게 한다.
  // 쉬는 시간에도 그대로 보여줘서 쉬면서 올릴 수 있게 한다.
  shareMessage.value = "";
  shareMessage.disabled = false;
  shareStatus.textContent = "";
  shareBtn.disabled = false;
  shareBox.classList.remove("hidden");

  if (pomodoroOn) {
    // startBreak() 안에서 쉬는 화면(초록)으로 바꾼다.
    startBreak();
  } else {
    phase = "idle";
    runningLabel.textContent = "🎉 목표 시간을 지켰어요!";
  }
}

function failTimer(awaySeconds) {
  phase = "idle";
  timerScreen.classList.remove("resting");
  setFocusMode(false);
  stopTimer("left", awaySeconds);
  runningLabel.textContent = "😢 화면을 벗어나서 실패했어요";
  showResultProgress();
}

// 실패·포기 화면. 남은 시간 대신 "얼마나 했는지"를 보여준다.
// 남은 시간을 보여주면 실패 화면에 뜬 숫자가 무슨 뜻인지 알 수 없다.
// 기록에 남는 값과 같은 숫자라서 나중에 기록 화면과도 맞아떨어진다.
function showResultProgress() {
  const done = lastRecord ? lastRecord.elapsedSeconds : 0;
  renderCountdown(done);
  setRingSub("집중했어요");
  countdownEl.classList.add("failed");
  setRing(goalSeconds === 0 ? 0 : done / goalSeconds, true);
  setResultState("fail");
}

function giveUpTimer() {
  phase = "idle";
  timerScreen.classList.remove("resting");
  setFocusMode(false);
  stopTimer("gaveup");
  runningLabel.textContent = "🏳️ 포기했어요";
  showResultProgress();
}

// ---- 화면 나눠쓰기(Split View) 확인 ----
//
// 아이패드에서 화면을 반으로 나누면 두 앱이 같이 보인다. 그러면 옆에서
// 유튜브를 틀어놔도 브라우저는 "화면을 벗어났다"고 알려주지 않는다.
// 폰에서는 앱이 하나만 보이니 없던 문제인데, 패드에서는 이 앱의 전제가
// 통째로 무너진다.
//
// "지금 화면을 나눠 쓰는 중인가?"를 알려주는 기능은 브라우저에 없다.
// 그래서 창이 기기 화면보다 뚜렷하게 좁은지로 짐작한다. 나눠 쓰면 창이
// 절반 정도로 줄어들기 때문이다.
//
// 짐작이라 완벽하지 않다. 특히 7:3 으로 나눠서 이 앱이 넓은 쪽에 있으면
// 못 잡을 수 있다. 실제 기기에서 확인이 필요하다.
function splitViewInfo() {
  // 손가락으로 쓰는 기기에서만 본다. 컴퓨터에서 창을 작게 줄인 것을
  // 나눠쓰기로 착각하면 안 된다.
  const touchDevice = navigator.maxTouchPoints > 1;
  const win = Math.round(window.innerWidth);
  const sw = Math.round(screen.width || 0);
  const sh = Math.round(screen.height || 0);
  const shortSide = sw && sh ? Math.min(sw, sh) : 0;

  // 두 가지로 본다.
  //  - screen.width 가 방향을 따라가는 기기(요즘 iOS)에서는 이것만으로 잡힌다
  //  - 안 따라가는 기기에서는 짧은 변과 비교해 절반쯤일 때 잡는다
  const narrow =
    (sw > 0 && win < sw * 0.9) ||
    (shortSide > 0 && win < shortSide * 0.85);

  return { split: touchDevice && narrow, win: win, screen: sw, shortSide: shortSide };
}

// 설정 화면에 안내를 띄운다. 숫자도 같이 보여준다 —
// 짐작이 틀렸을 때 어떤 값이었는지 알아야 고칠 수 있다.
function updateSplitWarning() {
  const info = splitViewInfo();
  splitWarning.classList.toggle("hidden", !info.split);
  if (info.split) {
    splitNumbers.textContent =
      "(창 " + info.win + "px / 화면 " + info.screen + "px)";
  }
  return info.split;
}

window.addEventListener("resize", () => {
  updateSplitWarning();
  // 타이머가 도는 중에 화면을 나누면 화면을 벗어난 것과 같다.
  if (phase === "focus" && splitViewInfo().split) splitByHalf();
});

function splitByHalf() {
  phase = "idle";
  timerScreen.classList.remove("resting");
  setFocusMode(false);
  // 기록에는 화면 이탈(left)로 남긴다. 새 종류를 만들면 Firebase 규칙과
  // 옛날 버전을 쓰는 친구들 화면이 같이 어긋난다.
  stopTimer("left");
  runningLabel.textContent = "🪟 화면을 나눠 써서 실패했어요";
  showResultProgress();
}

// ---- 화면을 벗어났을 때 ----
// 전화가 오거나 알림을 잘못 눌러도 바로 실패하면 너무 억울하다.
// 그래서 잠깐(5초) 안에 돌아오면 봐준다. 다만 횟수를 제한하고 화면에 알린다.

const FORGIVE_SECONDS = 5;
const FORGIVE_LIMIT = 3;

let leftAt = 0; // 화면을 벗어난 시각
let forgiveCount = 0; // 이번 판에서 봐준 횟수

function showForgiveNote() {
  if (forgiveCount === 0) {
    forgiveNote.classList.add("hidden");
    return;
  }
  const left = FORGIVE_LIMIT - forgiveCount;
  forgiveNote.textContent =
    `😮‍💨 잠깐 나갔다 온 걸 ${forgiveCount}번 봐줬어요. ` +
    (left > 0 ? `${left}번 더 봐줄 수 있어요.` : "다음엔 실패로 처리돼요.");
  forgiveNote.classList.remove("hidden");
}

document.addEventListener("visibilitychange", () => {
  // 쉬는 중이거나 타이머를 안 돌리는 중이면 나가도 괜찮다.
  if (phase !== "focus") return;

  if (document.hidden) {
    // 아직 실패로 정하지 않는다. 얼마나 나가 있었는지는 돌아와야 알 수 있다.
    leftAt = Date.now();
    return;
  }

  // 돌아왔다. 나가 있던 시간으로 판단한다.
  const awaySeconds = (Date.now() - leftAt) / 1000;

  if (awaySeconds <= FORGIVE_SECONDS && forgiveCount < FORGIVE_LIMIT) {
    forgiveCount += 1;
    showForgiveNote();
    // 나가 있는 동안 시간이 다 됐다면 이제 성공 처리한다.
    if (remainingSeconds <= 0) finishTimer();
    return;
  }

  // 그 밖에는 얼마를 나가 있었든 실패다.
  // 오래 비운 쪽을 봐주면 "실패를 지우려고 일부러 안 돌아오는" 길이 열린다.
  failTimer(awaySeconds);
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

  // 토큰은 저장하지 않고 기록에서 계산한다.
  renderTierInfo(calculateTokens(records));

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

// 타이머가 도는 중에 새로고침하거나 탭을 닫으면 그때까지의 시간이 그냥 사라진다.
// 실수로 그러는 일이 없도록 브라우저에게 한 번 물어봐 달라고 부탁한다.
window.addEventListener("beforeunload", (event) => {
  // 쉬는 시간에 나가는 건 정상 행동이라 경고하지 않는다.
  if (phase !== "focus") return;
  event.preventDefault();
  // 옛날 브라우저는 이 값을 봐야 경고를 띄운다.
  event.returnValue = "";
});

// ---- 티어 ----
// 토큰은 저장하지 않는다. 화면을 열 때마다 기록에서 다시 계산한다.

function renderTierInfo(tokens) {
  const info = computeTierFromTokens(tokens);

  tierBadge.textContent = info.tier.emoji + " " + info.tier.name;
  tierTokens.textContent = info.tokens + " 토큰";
  tierBarFill.style.width = info.progress + "%";

  if (info.isMax) {
    tierNext.textContent = "🎉 최고 티어 달성";
  } else {
    tierNext.textContent =
      "다음 " + info.nextTier.name + "까지 " + info.needed + " 토큰";
  }
  return info;
}

// ---- 지금 도전 중 ----
//
// 타이머를 시작하면 activeChallenges 에 올리고, 끝나면 지운다.
// 인터넷이 안 되거나 Firebase 규칙이 아직 없어도 타이머 자체는 그대로
// 돌아가야 하므로 실패는 조용히 넘긴다.

let liveTickerId = null;
let liveItems = [];
let liveCheers = {};
// 닉네임 -> 티어 이름. 순위표에 쓰는 자료를 그대로 재활용한다.
// 순위표의 누적 시간은 성공한 판만 더한 값이라, 분으로 바꾸면 토큰과 같다.
let liveTiers = {};

async function loadLiveTiers() {
  try {
    const rows = await cloudLoadRanking();
    const map = {};
    rows.forEach((row) => {
      const tokens = Math.round(row.totalSeconds / 60);
      const info = computeTierFromTokens(tokens);
      map[row.nickname] = info.tier.emoji + " " + info.tier.name;
    });
    liveTiers = map;
  } catch (err) {
    // 티어를 못 가져와도 도전 목록은 보여준다.
    liveTiers = {};
  }
}

function beginChallenge() {
  const nickname = loadNickname();
  if (!nickname) return;
  cloudStartChallenge({
    nickname: nickname,
    mission: missionInput.value.trim().slice(0, 20),
    goalMinutes: Math.round(goalSeconds / 60),
    startedAt: Date.now(),
    endAt: endTime,
  }).catch(() => {});
}

function endChallenge() {
  const nickname = loadNickname();
  if (!nickname) return;
  cloudEndChallenge(nickname).catch(() => {});
}

function stopLiveTicker() {
  if (liveTickerId !== null) {
    clearInterval(liveTickerId);
    liveTickerId = null;
  }
}

// 남은 시간을 "17분 32초" 처럼 짧게 적는다.
function shortLeft(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  if (m === 0) return sec + "초 남음";
  return m + "분 " + sec + "초 남음";
}

async function loadLive() {
  if (liveLoading) return;
  liveLoading = true;
  liveStatus.textContent = "불러오는 중…";
  liveStatus.classList.remove("offline");
  try {
    const [items, cheers] = await Promise.all([
      cloudLoadChallenges(),
      cloudLoadChallengeCheers().catch(() => ({})),
    ]);
    liveItems = items;
    liveCheers = cheers;
    liveLoadedAt = Date.now();
    liveLoading = false;
  } catch (err) {
    liveLoading = false;
    liveItems = [];
    liveStatus.classList.add("offline");
    liveStatus.textContent =
      err.status === 403
        ? "⚠️ 앱 설정이 아직 끝나지 않았어요. 만든 사람에게 알려주세요."
        : "⚠️ 인터넷에 연결되지 않아 볼 수 없어요.";
    liveList.textContent = "";
    return;
  }
  // 불러오는 사이에 다른 화면으로 갔으면 여기서 멈춘다.
  // 안 그러면 안 보이는 화면 때문에 1초 시계가 계속 돈다.
  if (liveScreen.classList.contains("hidden")) return;
  renderLive();
  startLiveTicker();
}

// 1분마다 목록을 다시 불러온다. 열어둔 사이에 새로 시작한 사람이
// 안 보이면 "지금 도전 중"이라는 이름이 무색해진다.
// 화면을 안 보고 있을 때는 읽지 않는다. (무료 요금제 읽기를 아낀다)
const LIVE_RELOAD_MS = 60 * 1000;
let liveLoadedAt = 0;
// 불러오는 데 1초가 넘게 걸리면 시계가 또 부르려 든다. 한 번에 하나만.
let liveLoading = false;

function startLiveTicker() {
  stopLiveTicker();
  // 남은 시간만 1초마다 다시 적는다. 목록을 다시 그리지는 않는다.
  liveTickerId = setInterval(() => {
    const now = Date.now();
    let changed = false;
    liveItems.forEach((item) => {
      if (item.endAt <= now) changed = true;
      const el = document.getElementById("left-" + item.challengeId);
      if (el) el.textContent = shortLeft(item.endAt - now);
    });
    // 끝난 사람이 생기면 목록을 다시 그린다.
    if (changed) {
      liveItems = liveItems.filter((i) => i.endAt > now);
      renderLive();
    }
    // 가끔 새로 불러온다.
    if (
      !document.hidden &&
      !liveScreen.classList.contains("hidden") &&
      now - liveLoadedAt > LIVE_RELOAD_MS
    ) {
      loadLive();
    }
  }, 1000);
}

function renderLive() {
  liveList.textContent = "";

  const me = loadNickname();
  liveStatus.textContent = "현재 " + liveItems.length + "명이 집중 중";

  if (liveItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "notice";
    empty.textContent =
      "지금 집중 중인 사람이 없어요. 먼저 시작해서 1등이 되어 보세요!";
    liveList.appendChild(empty);
    return;
  }

  liveItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "live-card";
    if (item.nickname === me) card.classList.add("mine");

    const head = document.createElement("div");
    head.className = "live-head";
    const name = document.createElement("span");
    name.className = "live-name";
    name.textContent = item.nickname;
    head.appendChild(name);

    // 티어는 순위표에서 이미 계산한 값을 쓴다. 없으면 비워둔다.
    const tierName = liveTiers[item.nickname];
    if (tierName) {
      const badge = document.createElement("span");
      badge.className = "live-tier";
      badge.textContent = tierName;
      head.appendChild(badge);
    }
    card.appendChild(head);

    if (item.mission) {
      const mission = document.createElement("p");
      mission.className = "live-mission";
      mission.textContent = item.mission;
      card.appendChild(mission);
    }

    const time = document.createElement("p");
    time.className = "live-time";
    const goal = document.createElement("span");
    goal.textContent = item.goalMinutes + "분 도전 · ";
    const left = document.createElement("b");
    left.id = "left-" + item.challengeId;
    left.textContent = shortLeft(item.endAt - Date.now());
    time.appendChild(goal);
    time.appendChild(left);
    card.appendChild(time);

    const row = document.createElement("div");
    row.className = "live-foot";

    const count = document.createElement("span");
    count.className = "live-count";
    count.textContent = "👏 " + (liveCheers[item.challengeId] || 0);
    row.appendChild(count);

    if (item.nickname !== me) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "live-cheer";
      if (alreadyCheered(item.challengeId)) {
        btn.textContent = "응원함";
        btn.disabled = true;
      } else {
        btn.textContent = "👏 응원하기";
        btn.addEventListener("click", () => sendChallengeCheer(item, btn, count));
      }
      row.appendChild(btn);
    }

    card.appendChild(row);
    liveList.appendChild(card);
  });
}

async function sendChallengeCheer(item, btn, countEl) {
  btn.disabled = true;
  btn.textContent = "보내는 중…";
  try {
    await cloudCheerChallenge(item.challengeId, loadNickname());
    markCheered(item.challengeId);
    liveCheers[item.challengeId] = (liveCheers[item.challengeId] || 0) + 1;
    countEl.textContent = "👏 " + liveCheers[item.challengeId];
    btn.textContent = "응원함";
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "👏 응원하기";
    liveStatus.textContent = "⚠️ 응원을 보내지 못했어요.";
  }
}

liveBtn.addEventListener("click", () => {
  showScreen(liveScreen);
  loadLiveTiers();
  loadLive();
});

liveRefresh.addEventListener("click", loadLive);
document.getElementById("live-back").addEventListener("click", () => showScreen(setupScreen));
document.getElementById("live-back-bottom").addEventListener("click", () => showScreen(setupScreen));

// ---- 게시판 ----

const CHEER_EMOJIS = ["👏", "🔥", "💪", "👍", "😍"];

// 화면에 글자를 넣을 때는 textContent를 쓴다.
// 친구가 쓴 글에 HTML 태그가 섞여 있어도 그대로 글자로만 보이게 하기 위해서다.
function makeCheerList(cheers) {
  const ul = document.createElement("ul");
  ul.className = "cheer-list";
  cheers.forEach((c) => {
    const li = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = c.nickname + " ";
    li.appendChild(who);
    li.appendChild(document.createTextNode(c.emoji + " " + c.message));
    ul.appendChild(li);
  });
  return ul;
}

function makePostCard(post) {
  const card = document.createElement("div");
  card.className = "post";

  // 내 글은 눈에 띄게 표시한다. 응원이 달렸는지 찾기 쉬워진다.
  const isMine = post.nickname === loadNickname();
  if (isMine) card.classList.add("mine");

  const head = document.createElement("div");
  head.className = "post-head";
  const name = document.createElement("span");
  name.className = "post-name";
  name.textContent = post.nickname;
  const badge = document.createElement("span");
  badge.className = "post-badge";
  badge.textContent = formatDuration(post.elapsedSeconds) + " 집중";
  const when = document.createElement("span");
  when.className = "post-when";
  when.textContent = formatDate(post.at);
  head.append(name);
  if (isMine) {
    const mineTag = document.createElement("span");
    mineTag.className = "post-mine-tag";
    mineTag.textContent = "내 글";
    head.append(mineTag);
  }
  head.append(badge, when);
  card.appendChild(head);

  if (post.message) {
    const msg = document.createElement("p");
    msg.className = "post-message";
    msg.textContent = post.message;
    card.appendChild(msg);
  }

  // 이모지를 누르면 바로 응원이 올라간다.
  const row = document.createElement("div");
  row.className = "cheer-row";
  CHEER_EMOJIS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cheer-btn";
    btn.textContent = emoji;
    btn.addEventListener("click", () => sendCheer(post.id, emoji, "", btn));
    row.appendChild(btn);
  });
  card.appendChild(row);

  const cheersHolder = document.createElement("div");
  cheersHolder.dataset.cheersFor = post.id;
  card.appendChild(cheersHolder);

  // 짧은 응원 한마디
  const form = document.createElement("div");
  form.className = "cheer-form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 30;
  input.placeholder = "응원 한마디 (30자)";
  const send = document.createElement("button");
  send.type = "button";
  send.textContent = "보내기";
  const submit = () => {
    const text = input.value.trim();
    if (text === "") return;
    input.value = "";
    sendCheer(post.id, "💬", text, send);
  };
  send.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
  form.append(input, send);
  card.appendChild(form);

  return card;
}

async function sendCheer(postId, emoji, message, button) {
  button.disabled = true;
  try {
    await cloudSaveCheer(postId, {
      nickname: loadNickname(),
      emoji: emoji,
      message: message,
      at: Date.now(),
    });
    await refreshCheers(postId);
  } catch (err) {
    boardStatus.textContent = "⚠️ 응원을 보내지 못했어요. 인터넷을 확인해 주세요.";
    boardStatus.classList.add("offline");
  }
  button.disabled = false;
}

async function refreshCheers(postId) {
  const holder = boardList.querySelector('[data-cheers-for="' + postId + '"]');
  if (!holder) return;
  try {
    const cheers = await cloudLoadCheers(postId);
    holder.replaceChildren(makeCheerList(cheers));
  } catch (err) {
    // 응원을 못 불러와도 글은 그대로 보이게 둔다.
  }
}

// 마지막으로 게시판을 본 뒤에 새 글이나 내 글에 달린 응원이 있는지 본다.
// 있으면 설정 화면의 게시판 버튼에 빨간 점을 띄운다.
async function checkBoardUpdates() {
  const me = loadNickname();
  const seen = loadBoardSeen();
  if (seen === 0) return; // 한 번도 안 봤으면 굳이 재촉하지 않는다

  try {
    // 1) 남이 쓴 새 글이 있나
    const latest = await cloudLoadPosts(1);
    let isNew =
      latest.length > 0 && latest[0].at > seen && latest[0].nickname !== me;

    // 2) 내가 쓴 최근 글에 새 응원이 달렸나
    if (!isNew) {
      const myPosts = await cloudLoadMyPosts(me, 3);
      for (const post of myPosts) {
        const cheers = await cloudLoadCheers(post.id);
        if (cheers.some((c) => c.at > seen && c.nickname !== me)) {
          isNew = true;
          break;
        }
      }
    }

    boardDot.classList.toggle("hidden", !isNew);
  } catch (err) {
    // 인터넷이 안 되면 빨간 점은 그냥 안 띄운다.
  }
}

async function renderBoard() {
  // 지금 본 것으로 치고 빨간 점을 끈다.
  saveBoardSeen(Date.now());
  boardDot.classList.add("hidden");

  boardStatus.textContent = "불러오는 중…";
  boardStatus.classList.remove("offline");
  boardList.replaceChildren();

  let posts;
  try {
    posts = await cloudLoadPosts(20);
  } catch (err) {
    boardStatus.textContent = "⚠️ 인터넷에 연결되지 않아 게시판을 볼 수 없어요.";
    boardStatus.classList.add("offline");
    return;
  }

  if (posts.length === 0) {
    boardStatus.textContent =
      "아직 올라온 글이 없어요. 타이머를 성공하면 올릴 수 있습니다.";
    return;
  }

  boardStatus.textContent = "최근 글 " + posts.length + "개";
  posts.forEach((post) => boardList.appendChild(makePostCard(post)));
  // 응원은 글을 먼저 보여준 뒤 채워 넣는다.
  posts.forEach((post) => refreshCheers(post.id));
}

async function sharePost() {
  if (!lastRecord) return;
  shareBtn.disabled = true;
  shareStatus.textContent = "올리는 중…";
  try {
    await cloudSavePost({
      nickname: loadNickname(),
      goalMinutes: lastRecord.goalMinutes,
      elapsedSeconds: lastRecord.elapsedSeconds,
      message: shareMessage.value.trim().slice(0, 100),
      at: Date.now(),
    });
    shareStatus.textContent = "✅ 게시판에 올렸어요!";
    shareMessage.disabled = true;
  } catch (err) {
    shareStatus.textContent = "⚠️ 올리지 못했어요. 인터넷을 확인해 주세요.";
    shareBtn.disabled = false;
  }
}

// ---- 순위표 ----

let rankSort = "count";

async function renderRank() {
  rankStatus.textContent = "불러오는 중…";
  rankStatus.classList.remove("offline");
  rankList.replaceChildren();

  let rows;
  try {
    rows = await cloudLoadRanking();
  } catch (err) {
    rankStatus.textContent = "⚠️ 인터넷에 연결되지 않아 순위를 볼 수 없어요.";
    rankStatus.classList.add("offline");
    return;
  }

  // 성공한 적이 없는 사람은 순위에 넣지 않는다.
  rows = rows.filter((r) => r.successCount > 0);

  if (rows.length === 0) {
    rankStatus.textContent = "아직 성공한 사람이 없어요. 1등이 되어 보세요!";
    return;
  }

  rows.sort((a, b) =>
    rankSort === "count"
      ? b.successCount - a.successCount || b.totalSeconds - a.totalSeconds
      : b.totalSeconds - a.totalSeconds || b.successCount - a.successCount
  );

  rankStatus.textContent = "모두 " + rows.length + "명";
  const me = loadNickname();

  rows.forEach((row, index) => {
    const li = document.createElement("li");
    if (row.nickname === me) li.classList.add("me");

    const no = document.createElement("span");
    no.className = "rank-no";
    no.textContent = index + 1;

    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = row.nickname;
    const sub = document.createElement("span");
    sub.className = "rank-sub";
    sub.textContent =
      rankSort === "count"
        ? formatDuration(row.totalSeconds) + " 집중"
        : row.successCount + "번 성공";
    name.appendChild(sub);

    const value = document.createElement("span");
    value.className = "rank-value";
    value.textContent =
      rankSort === "count"
        ? row.successCount + "번"
        : formatDuration(row.totalSeconds);

    li.append(no, name, value);
    rankList.appendChild(li);
  });
}

// ---- 버튼 연결 ----

startBtn.addEventListener("click", () => {
  // 나눠 쓰는 중에 시작하면 옆에서 뭘 하든 성공으로 끝난다.
  // 아예 시작하지 않고 이유를 알려준다.
  if (updateSplitWarning()) {
    splitWarning.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  startTimer();
});
cancelBtn.addEventListener("click", giveUpTimer);
restartBtn.addEventListener("click", () => showScreen(setupScreen));

statsBtn.addEventListener("click", () => {
  renderStats();
  showScreen(statsScreen);
});

statsBackBtn.addEventListener("click", () => showScreen(setupScreen));
statsBackTop.addEventListener("click", () => showScreen(setupScreen));

renameBtn.addEventListener("click", () => askNickname());

shareBtn.addEventListener("click", sharePost);

boardBtn.addEventListener("click", () => {
  showScreen(boardScreen);
  renderBoard();
});
boardRefresh.addEventListener("click", renderBoard);
document
  .getElementById("board-back")
  .addEventListener("click", () => showScreen(setupScreen));
document
  .getElementById("board-back-bottom")
  .addEventListener("click", () => showScreen(setupScreen));

rankBtn.addEventListener("click", () => {
  showScreen(rankScreen);
  renderRank();
});
rankSortButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    rankSort = btn.dataset.sort;
    rankSortButtons.forEach((b) => b.classList.toggle("active", b === btn));
    renderRank();
  });
});
document
  .getElementById("rank-back")
  .addEventListener("click", () => showScreen(setupScreen));
document
  .getElementById("rank-back-bottom")
  .addEventListener("click", () => showScreen(setupScreen));

// ---- 닉네임 ----

// 닉네임을 묻는 화면을 띄운다. 이미 있으면 입력칸에 미리 채워 둔다.
function askNickname() {
  nicknameInput.value = loadNickname();
  pinInput.value = "";
  nicknameError.classList.add("hidden");
  nicknameSaveBtn.disabled = false;
  nicknameSaveBtn.textContent = "시작하기";
  // 이미 닉네임이 있는 사람이 잘못 눌렀을 수도 있다. 그때는 그냥
  // 빠져나갈 수 있어야 한다. 처음 들어온 사람은 돌아갈 곳이 없으므로 숨긴다.
  nicknameCancelBtn.classList.toggle("hidden", loadNickname() === "");
  showScreen(nicknameScreen);
}

nicknameCancelBtn.addEventListener("click", () => {
  showScreen(setupScreen);
});

function showNicknameError(message) {
  nicknameError.textContent = message;
  nicknameError.classList.remove("hidden");
}

async function confirmNickname() {
  const name = nicknameInput.value.trim().slice(0, 8);
  const pin = pinInput.value.trim();

  if (name === "") {
    showNicknameError("닉네임을 입력해 주세요.");
    return;
  }
  // 닉네임이 그대로 문서 이름이 되기 때문에 Firestore 가 못 받는 값은 막는다.
  // 빗금, 점 하나(.), 점 둘(..), 앞뒤로 밑줄 두 개(__이름__)가 그렇다.
  // 안 막으면 저장할 때가 되어서야 깨지는데, 그때는 왜 안 되는지 알 수 없다.
  if (name.includes("/")) {
    showNicknameError("닉네임에 / 는 쓸 수 없어요.");
    return;
  }
  if (name === "." || name === ".." || /^__.*__$/.test(name)) {
    showNicknameError("그 닉네임은 쓸 수 없어요. 다른 이름으로 정해 주세요.");
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    showNicknameError("비밀번호는 숫자 4자리로 정해 주세요.");
    return;
  }

  nicknameSaveBtn.disabled = true;
  nicknameSaveBtn.textContent = "확인하는 중…";
  nicknameError.classList.add("hidden");

  try {
    const hash = await hashPin(name, pin);
    const existing = await cloudGetUser(name);

    if (existing === null) {
      // 처음 쓰는 닉네임이면 이 사람 것으로 등록한다.
      await cloudCreateUser(name, hash);
    } else if (existing.pinHash !== hash) {
      showNicknameError(
        "이미 쓰고 있는 닉네임이에요. 비밀번호가 맞지 않습니다.\n" +
          "본인이면 정했던 숫자 4자리를 넣고, 아니면 다른 닉네임을 써주세요."
      );
      nicknameSaveBtn.disabled = false;
      nicknameSaveBtn.textContent = "시작하기";
      return;
    }

    saveNickname(name);
    savePinHash(hash);
    greetingName.textContent = name;
    showScreen(setupScreen);
    checkBoardUpdates();
  } catch (err) {
    if (err.status === 403) {
      // 인터넷은 되는데 Firebase가 막은 경우다. 원인을 정확히 알려준다.
      showNicknameError(
        "앱 설정이 아직 끝나지 않았어요.\n" +
          "만든 사람에게 'Firebase 보안 규칙을 게시해 달라'고 알려주세요."
      );
    } else {
      showNicknameError(
        "인터넷에 연결되지 않아 확인할 수 없어요. 연결을 확인하고 다시 눌러주세요."
      );
    }
    nicknameSaveBtn.disabled = false;
    nicknameSaveBtn.textContent = "시작하기";
  }
}

nicknameSaveBtn.addEventListener("click", confirmNickname);

// 키보드에서 엔터를 눌러도 저장되게 한다.
[nicknameInput, pinInput].forEach((el) => {
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter") confirmNickname();
  });
});

// 비밀번호 칸에는 숫자만 들어가게 한다.
pinInput.addEventListener("input", () => {
  pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
});

// ---- 앱 시작 ----

updateMinutesDisplay();
updateSoundToggle();
updatePomodoroToggle();

const savedNickname = loadNickname();
if (savedNickname === "") {
  // 처음 온 사람에게는 닉네임부터 묻는다.
  askNickname();
} else {
  greetingName.textContent = savedNickname;
  showScreen(setupScreen);
  checkBoardUpdates();
}
