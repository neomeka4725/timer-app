// 타이머 기록을 이 기기 안에 저장하고 불러오는 코드.
// localStorage는 브라우저가 제공하는 작은 저장 공간이라 새로고침하거나
// 앱을 껐다 켜도 남아있다. 다만 기기마다 따로 저장된다.

const STORAGE_KEY = "wellness-timer-records";
const NICKNAME_KEY = "wellness-timer-nickname";

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
