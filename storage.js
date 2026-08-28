// 타이머 기록을 이 기기 안에 저장하고 불러오는 코드.
// localStorage는 브라우저가 제공하는 작은 저장 공간이라 새로고침하거나
// 앱을 껐다 켜도 남아있다. 다만 기기마다 따로 저장된다.

const STORAGE_KEY = "wellness-timer-records";
const NICKNAME_KEY = "wellness-timer-nickname";
const PINHASH_KEY = "wellness-timer-pinhash";

// PIN 기능을 넣으면서 그동안 쌓인 시험용 기록을 모두 버리고 새로 시작한다.
// 이 번호가 기기에 저장된 번호와 다르면 이 기기의 기록을 한 번 싹 비운다.
// 앞으로 또 처음부터 시작해야 할 일이 생기면 이 번호를 올리면 된다.
const DATA_VERSION = "2";
const VERSION_KEY = "wellness-timer-version";

(function resetIfOldVersion() {
  try {
    if (localStorage.getItem(VERSION_KEY) === DATA_VERSION) return;
    [STORAGE_KEY, NICKNAME_KEY, PINHASH_KEY, "wellness-timer-board-seen"].forEach(
      (key) => localStorage.removeItem(key)
    );
    localStorage.setItem(VERSION_KEY, DATA_VERSION);
  } catch (err) {
    // 저장 공간을 못 쓰는 상태면 어차피 남는 기록도 없다.
  }
})();

// 닉네임은 길면 게시판이 지저분해지므로 8자로 자른다.
const NICKNAME_MAX = 8;

function loadNickname() {
  try {
    return localStorage.getItem(NICKNAME_KEY) || "";
  } catch (err) {
    return "";
  }
}

function saveNickname(name) {
  const trimmed = name.trim().slice(0, NICKNAME_MAX);
  try {
    localStorage.setItem(NICKNAME_KEY, trimmed);
  } catch (err) {
    // 저장에 실패해도 이번 실행 동안은 앱이 계속 돌아가야 한다.
  }
  return trimmed;
}

// 기록 하나의 모양:
// { at: 저장시각(밀리초), goalMinutes: 목표분, elapsedSeconds: 실제로 버틴 초,
//   result: "success" | "left" | "gaveup" }

// 이 기기에서 PIN을 맞힌 적이 있으면 그 결과를 저장해 둔다.
// 다음에 열 때 PIN을 다시 묻지 않기 위해서다.
function loadPinHash() {
  try {
    return localStorage.getItem(PINHASH_KEY) || "";
  } catch (err) {
    return "";
  }
}

function savePinHash(hash) {
  try {
    localStorage.setItem(PINHASH_KEY, hash);
  } catch (err) {
    // 저장에 실패하면 다음에 PIN을 다시 물어볼 뿐이다.
  }
}

// ---- 소리 켜기/끄기 ----
// 수업 중에 소리가 나면 곤란하므로 끌 수 있어야 한다.

const SOUND_KEY = "wellness-timer-sound";

function loadSoundOn() {
  try {
    // 저장된 적이 없으면 소리를 켠 상태로 시작한다.
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch (err) {
    return true;
  }
}

function saveSoundOn(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch (err) {
    // 저장에 실패해도 이번 실행 동안은 그대로 쓴다.
  }
}

// ---- 게시판을 마지막으로 본 시각 ----
// 그 뒤에 올라온 글이나 응원이 있으면 빨간 점을 띄운다.

const BOARD_SEEN_KEY = "wellness-timer-board-seen";

function loadBoardSeen() {
  try {
    return Number(localStorage.getItem(BOARD_SEEN_KEY)) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBoardSeen(ms) {
  try {
    localStorage.setItem(BOARD_SEEN_KEY, String(ms));
  } catch (err) {
    // 저장에 실패하면 빨간 점이 계속 보일 뿐이라 큰 문제는 없다.
  }
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // 저장된 내용이 깨졌으면 빈 목록으로 시작한다.
    return [];
  }
}

function saveRecord(record) {
  const records = loadRecords();
  records.push(record);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    // 저장 공간이 꽉 찼거나 사생활 보호 모드일 수 있다.
    // 기록은 못 남기지만 앱은 계속 돌아가야 하므로 그냥 넘어간다.
  }
  return records;
}

// 인터넷에 올리는 데 성공한 기록을 표시해둔다.
// (at은 기록마다 다른 시각이라 구분표 역할을 한다)
function markRecordSynced(at) {
  const records = loadRecords();
  const target = records.find((r) => r.at === at);
  if (!target) return;
  target.synced = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    // 표시에 실패해도 다음에 다시 올리려고 시도할 뿐이라 문제되지 않는다.
  }
}

function unsyncedRecords() {
  return loadRecords().filter((r) => !r.synced);
}

function clearRecords() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // 지우기에 실패해도 앱은 계속 돌아간다.
  }
}

// 기록 목록에서 통계를 계산한다.
function summarize(records) {
  const successes = records.filter((r) => r.result === "success");
  const totalSeconds = successes.reduce((sum, r) => sum + r.elapsedSeconds, 0);

  return {
    successCount: successes.length,
    failCount: records.length - successes.length,
    totalSeconds: totalSeconds,
    successRate:
      records.length === 0
        ? 0
        : Math.round((successes.length / records.length) * 100),
  };
}
