// 인터넷 너머 Firebase(Firestore)에 기록을 올리고 내려받는 코드.
// Firebase 라이브러리를 따로 받지 않고, 주소로 직접 주고받는다(REST 방식).
// 그래서 사이트가 가볍고 빠르다.

const FIREBASE_PROJECT = "timer-app-6965c";
// 이 키는 웹에서 공개되는 게 정상이다. 실제 보안은 Firebase의 "규칙"이 담당한다.
const FIREBASE_KEY = "AIzaSyCO8WTwNoI3jabPkU4WDHLPyAWN_Eq4Ju0";

const FIRESTORE_BASE =
  "https://firestore.googleapis.com/v1/projects/" +
  FIREBASE_PROJECT +
  "/databases/(default)/documents";

// 통신이 오래 걸리면 앱이 멈춘 것처럼 보이므로 시간 제한을 둔다.
const TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// Firestore는 값마다 종류를 함께 적어서 주고받는다. (문자는 stringValue 등)
function toFields(record) {
  return {
    nickname: { stringValue: record.nickname },
    goalMinutes: { integerValue: String(Math.round(record.goalMinutes)) },
    elapsedSeconds: { integerValue: String(Math.round(record.elapsedSeconds)) },
    result: { stringValue: record.result },
    at: { timestampValue: new Date(record.at).toISOString() },
  };
}

function fromFields(fields) {
  return {
    nickname: fields.nickname.stringValue,
    goalMinutes: Number(fields.goalMinutes.integerValue),
    elapsedSeconds: Number(fields.elapsedSeconds.integerValue),
    result: fields.result.stringValue,
    at: new Date(fields.at.timestampValue).getTime(),
    synced: true,
  };
}

// 기록 하나를 올린다. 실패하면 예외를 던진다.
async function cloudSaveRecord(record) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + "/records?key=" + FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFields(record) }),
    }
  );
  if (!res.ok) {
    throw new Error("기록 저장 실패 (" + res.status + ")");
  }
  return true;
}

// 닉네임이 같은 기록을 전부 내려받는다.
async function cloudLoadRecords(nickname) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + ":runQuery?key=" + FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "records" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "nickname" },
              op: "EQUAL",
              value: { stringValue: nickname },
            },
          },
          limit: 500,
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error("기록 불러오기 실패 (" + res.status + ")");
  }

  const rows = await res.json();
  // 결과가 없으면 문서가 들어있지 않은 줄이 하나 온다.
  return rows
    .filter((row) => row.document)
    .map((row) => fromFields(row.document.fields))
    .sort((a, b) => a.at - b.at);
}
