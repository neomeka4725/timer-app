const nicknameScreen = document.getElementById("nickname-screen");
const nicknameInput = document.getElementById("nickname-input");
const pinInput = document.getElementById("pin-input");
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
const forgiveNote = document.getElementById("forgive-note");
const boardDot = document.getElementById("board-dot");
const clearBtn = document.getElementById("clear-btn");

let timerId = null;
let lastRecord = null; // 방금 끝낸 판 (게시판에 올릴 때 쓴다)
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

function updateSoundToggle() {
  soundToggle.textContent = soundOn
    ? "🔔 끝나면 소리로 알려줘요"
    : "🔕 소리 꺼짐 (수업 중일 때)";
  soundToggle.classList.toggle("off", !soundOn);
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

// 도-미-솔 세 음을 차례로 울린다.
function playChime() {
  if (!soundOn || !audioCtx) return;
  try {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((hz, i) => {
      const start = audioCtx.currentTime + i * 0.18;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      // 소리가 뚝 끊기면 "딱" 하는 잡음이 나므로 부드럽게 줄인다.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch (err) {
    // 소리가 안 나도 타이머는 그대로 동작해야 한다.
  }
}

soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;
  saveSoundOn(soundOn);
  updateSoundToggle();
  if (soundOn) {
    // 켜자마자 어떤 소리인지 들려준다.
    wakeUpAudio();
    playChime();
  }
});

// ---- 화면 전환 ----

function showScreen(screen) {
  nicknameScreen.classList.add("hidden");
  setupScreen.classList.add("hidden");
  timerScreen.classList.add("hidden");
  statsScreen.classList.add("hidden");
  boardScreen.classList.add("hidden");
  rankScreen.classList.add("hidden");
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

  countdownEl.textContent = formatTime(remainingSeconds);
  countdownEl.classList.remove("failed");
  runningLabel.textContent = "폰을 멀리하고 목표를 지켜보세요";
  cancelBtn.classList.remove("hidden");
  restartBtn.classList.add("hidden");
  shareBox.classList.add("hidden");

  // 이번 판의 봐주기 횟수를 초기화한다.
  forgiveCount = 0;
  leftAt = 0;
  forgiveNote.classList.add("hidden");

  showScreen(timerScreen);
  requestWakeLock();
  // 버튼을 누른 지금이 소리 장치를 깨울 수 있는 유일한 순간이다.
  wakeUpAudio();

  timerId = setInterval(() => {
    remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    countdownEl.textContent = formatTime(remainingSeconds);

    // 화면을 벗어나 있는 동안에는 성공으로 끝내지 않는다.
    // 안 그러면 나갔다 오기만 해도 성공이 되어버린다.
    // 돌아왔을 때 봐줄지 실패로 볼지 판단한 뒤에 끝낸다.
    if (remainingSeconds <= 0 && !document.hidden) {
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
  lastRecord = record;
}

function finishTimer() {
  stopTimer("success");
  playChime();
  runningLabel.textContent = "🎉 목표 시간을 지켰어요!";
  // 성공했을 때만 게시판에 자랑할 수 있게 한다.
  shareMessage.value = "";
  shareStatus.textContent = "";
  shareBtn.disabled = false;
  shareBox.classList.remove("hidden");
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
  if (timerId === null) return; // 타이머가 안 돌면 상관없다

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

  failTimer();
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

// 타이머가 도는 중에 새로고침하거나 탭을 닫으면 그때까지의 시간이 그냥 사라진다.
// 실수로 그러는 일이 없도록 브라우저에게 한 번 물어봐 달라고 부탁한다.
window.addEventListener("beforeunload", (event) => {
  if (timerId === null) return;
  event.preventDefault();
  // 옛날 브라우저는 이 값을 봐야 경고를 띄운다.
  event.returnValue = "";
});

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
  showScreen(nicknameScreen);
}

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
  // 닉네임이 문서 주소로 쓰이기 때문에 빗금은 넣을 수 없다.
  if (name.includes("/")) {
    showNicknameError("닉네임에 / 는 쓸 수 없어요.");
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

const savedNickname = loadNickname();
if (savedNickname === "") {
  // 처음 온 사람에게는 닉네임부터 묻는다.
  askNickname();
} else {
  greetingName.textContent = savedNickname;
  showScreen(setupScreen);
  checkBoardUpdates();
}
