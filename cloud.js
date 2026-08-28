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

// 문서 주소에서 문서 번호만 떼어낸다.
// (.../documents/posts/abc123  ->  abc123)
function docId(name) {
  return name.split("/").pop();
}

async function runQuery(body) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + ":runQuery?key=" + FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error("불러오기 실패 (" + res.status + ")");
  }
  const rows = await res.json();
  // 결과가 없으면 문서가 들어있지 않은 줄이 하나 온다.
  return rows.filter((row) => row.document).map((row) => row.document);
}

async function postDoc(path, fields) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + path + "?key=" + FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fields }),
    }
  );
  if (!res.ok) {
    throw new Error("저장 실패 (" + res.status + ")");
  }
  return res.json();
}

// ---- 게시판 ----

async function cloudSavePost(post) {
  await postDoc("/posts", {
    nickname: { stringValue: post.nickname },
    goalMinutes: { integerValue: String(Math.round(post.goalMinutes)) },
    elapsedSeconds: { integerValue: String(Math.round(post.elapsedSeconds)) },
    message: { stringValue: post.message },
    at: { timestampValue: new Date(post.at).toISOString() },
  });
  return true;
}

async function cloudLoadPosts(count) {
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: "posts" }],
      orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }],
      limit: count,
    },
  });
  return docs.map((d) => ({
    id: docId(d.name),
    nickname: d.fields.nickname.stringValue,
    goalMinutes: Number(d.fields.goalMinutes.integerValue),
    elapsedSeconds: Number(d.fields.elapsedSeconds.integerValue),
    message: d.fields.message.stringValue,
    at: new Date(d.fields.at.timestampValue).getTime(),
  }));
}

// ---- 응원 ----

async function cloudSaveCheer(postId, cheer) {
  await postDoc("/posts/" + postId + "/cheers", {
    nickname: { stringValue: cheer.nickname },
    emoji: { stringValue: cheer.emoji },
    message: { stringValue: cheer.message },
    at: { timestampValue: new Date(cheer.at).toISOString() },
  });
  return true;
}

async function cloudLoadCheers(postId) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + "/posts/" + postId + "/cheers?pageSize=50&key=" + FIREBASE_KEY
  );
  if (!res.ok) {
    throw new Error("응원 불러오기 실패 (" + res.status + ")");
  }
  const data = await res.json();
  return (data.documents || [])
    .map((d) => ({
      nickname: d.fields.nickname.stringValue,
      emoji: d.fields.emoji.stringValue,
      message: d.fields.message.stringValue,
      at: new Date(d.fields.at.timestampValue).getTime(),
    }))
    .sort((a, b) => a.at - b.at);
}

// ---- 순위표 ----

// 반 전체 기록을 가져와 닉네임별로 합친다.
async function cloudLoadRanking() {
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: "records" }],
      limit: 2000,
    },
  });

  const byName = new Map();
  docs.forEach((d) => {
    const name = d.fields.nickname.stringValue;
    const result = d.fields.result.stringValue;
    const seconds = Number(d.fields.elapsedSeconds.integerValue);

    if (!byName.has(name)) {
      byName.set(name, { nickname: name, successCount: 0, totalSeconds: 0, tries: 0 });
    }
    const row = byName.get(name);
    row.tries += 1;
    if (result === "success") {
      row.successCount += 1;
      row.totalSeconds += seconds;
    }
  });

  return [...byName.values()];
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
