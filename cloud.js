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

// 예전 기록을 모두 버리고 새로 시작하기 위해 보관함 이름을 바꿨다.
// 옛 records / posts 는 보안 규칙에서 빠졌기 때문에 이제 아무도 읽거나
// 쓸 수 없다. (Firebase 콘솔에서 주인이 직접 지울 수는 있다)
const COL_RECORDS = "records_v2";
const COL_POSTS = "posts_v2";
// 지금 집중 중인 사람 (도전이 끝나면 지운다)
const COL_CHALLENGES = "activeChallenges";
// 도전자에게 보내는 응원. 숫자를 고치는 대신 문서를 하나씩 쌓아서 센다.
// (게시판 응원과 같은 방식이다. 이렇게 하면 수정 권한이 필요 없다)
const COL_CHEERS = "challengeCheers";

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
    FIRESTORE_BASE + "/" + COL_RECORDS + "?key=" + FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFields(record) }),
    }
  );
  if (!res.ok) {
    throw makeError("기록 저장 실패", res.status);
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
    throw makeError("불러오기 실패", res.status);
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
    throw makeError("저장 실패", res.status);
  }
  return res.json();
}

// ---- 지금 도전 중 ----
//
// 문서 번호를 닉네임으로 쓴다. 그래야 한 사람이 여러 개 올라가지 않는다.
// 앱이 갑자기 꺼져서 옛 문서가 남아 있을 수 있으므로 새로 시작할 때
// 먼저 지우고 만든다.
//
// 주의: 이 기능은 Firebase 규칙에 activeChallenges 의 create/delete 허용이
// 있어야 동작한다. 규칙이 없으면 403이 나는데, 그때도 타이머 자체는
// 그대로 돌아가야 하므로 부르는 쪽에서 실패를 무시한다.

// 창을 닫는 순간에도 보낼 수 있는 지우기.
// keepalive 를 붙이면 페이지가 사라져도 요청은 끝까지 나간다.
// 성공을 보장하지는 못하므로, 앱을 다시 열 때 하는 정리가 진짜 보험이다.
function cloudEndChallengeBeacon(nickname) {
  try {
    fetch(
      FIRESTORE_BASE + "/" + COL_CHALLENGES + "/" + encodeURIComponent(nickname) +
        "?key=" + FIREBASE_KEY,
      { method: "DELETE", keepalive: true }
    ).catch(() => {});
  } catch (err) {
    // 못 보내도 다음에 앱을 열 때 정리된다.
  }
}

async function cloudEndChallenge(nickname) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + "/" + COL_CHALLENGES + "/" + encodeURIComponent(nickname) +
      "?key=" + FIREBASE_KEY,
    { method: "DELETE" }
  );
  // 404는 이미 없다는 뜻이라 성공으로 본다.
  if (!res.ok && res.status !== 404) {
    throw makeError("도전 끝내기 실패", res.status);
  }
  return true;
}

async function cloudStartChallenge(challenge) {
  // 남아 있던 옛 도전을 먼저 치운다. 없으면 그냥 넘어간다.
  try {
    await cloudEndChallenge(challenge.nickname);
  } catch (err) {
    // 못 지워도 아래에서 만들어 본다.
  }
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + "/" + COL_CHALLENGES + "?documentId=" +
      encodeURIComponent(challenge.nickname) + "&key=" + FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          nickname: { stringValue: challenge.nickname },
          mission: { stringValue: challenge.mission || "" },
          goalMinutes: { integerValue: String(Math.round(challenge.goalMinutes)) },
          startedAt: { timestampValue: new Date(challenge.startedAt).toISOString() },
          endAt: { timestampValue: new Date(challenge.endAt).toISOString() },
        },
      }),
    }
  );
  if (!res.ok) throw makeError("도전 올리기 실패", res.status);
  return true;
}

// 지금 도전 중인 사람들을 가져온다.
// 끝날 시각이 지난 것은 빼고 보여주고, 조용히 지워둔다.
// (앱을 그냥 닫아버리면 문서가 남는데, 그러면 계속 집중 중인 것처럼 보인다)
async function cloudLoadChallenges() {
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: COL_CHALLENGES }],
      limit: 50,
    },
  });

  const now = Date.now();
  const live = [];
  const stale = [];

  docs.forEach((d) => {
    const f = d.fields;
    const item = {
      id: docId(d.name),
      nickname: f.nickname.stringValue,
      mission: f.mission ? f.mission.stringValue : "",
      goalMinutes: Number(f.goalMinutes.integerValue),
      startedAt: new Date(f.startedAt.timestampValue).getTime(),
      endAt: new Date(f.endAt.timestampValue).getTime(),
    };
    // 응원을 붙일 때 쓰는 열쇠. 판마다 달라야 지난 판의 응원이 안 따라온다.
    item.challengeId = item.nickname + "|" + item.startedAt;
    if (item.endAt > now) live.push(item);
    else stale.push(item);
  });

  // 지난 것 치우기는 덤이다. 실패해도 화면에는 이미 안 보인다.
  stale.forEach((item) => {
    cloudEndChallenge(item.nickname).catch(() => {});
  });

  live.sort((a, b) => a.endAt - b.endAt);
  return live;
}

// ---- 도전자 응원 ----

async function cloudCheerChallenge(challengeId, from) {
  await postDoc("/" + COL_CHEERS, {
    challengeId: { stringValue: challengeId },
    from: { stringValue: from },
    at: { timestampValue: new Date().toISOString() },
  });
  return true;
}

// 내 도전에 달린 응원만 가져온다.
// 집중하는 동안 1분마다 부르기 때문에 싸야 한다. 조건을 걸어서 내 것만
// 받으면 문서 몇 개로 끝난다. (정렬을 붙이면 Firebase 가 추가 설정을
// 요구하므로 붙이지 않는다)
async function cloudLoadMyChallengeCheers(challengeId) {
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: COL_CHEERS }],
      where: {
        fieldFilter: {
          field: { fieldPath: "challengeId" },
          op: "EQUAL",
          value: { stringValue: challengeId },
        },
      },
      limit: 50,
    },
  });
  return docs.map((d) => d.fields.from.stringValue);
}

// 최근 응원을 한 번에 가져와서 도전별로 모은다.
// 도전마다 따로 물어보면 사람 수만큼 요청이 늘어난다.
async function cloudLoadChallengeCheers() {
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: COL_CHEERS }],
      orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }],
      limit: 60,
    },
  });
  // 누가 보냈는지도 같이 담는다. 세는 것만으로는 이름을 못 보여준다.
  const byChallenge = {};
  docs.forEach((d) => {
    const key = d.fields.challengeId.stringValue;
    if (!byChallenge[key]) byChallenge[key] = [];
    byChallenge[key].push(d.fields.from.stringValue);
  });
  return byChallenge;
}

// ---- 게시판 ----

async function cloudSavePost(post) {
  await postDoc("/" + COL_POSTS, {
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
      from: [{ collectionId: COL_POSTS }],
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

// 내가 쓴 글만 가져온다. (응원이 새로 달렸는지 확인할 때 쓴다)
// 주의: 여기에 정렬(orderBy)을 붙이면 Firebase가 추가 설정을 요구하므로
// 가져온 뒤 자바스크립트에서 정렬한다.
async function cloudLoadMyPosts(nickname, count) {
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: COL_POSTS }],
      where: {
        fieldFilter: {
          field: { fieldPath: "nickname" },
          op: "EQUAL",
          value: { stringValue: nickname },
        },
      },
      limit: 30,
    },
  });
  return docs
    .map((d) => ({
      id: docId(d.name),
      at: new Date(d.fields.at.timestampValue).getTime(),
    }))
    .sort((a, b) => b.at - a.at)
    .slice(0, count);
}

// ---- 응원 ----

async function cloudSaveCheer(postId, cheer) {
  await postDoc("/" + COL_POSTS + "/" + postId + "/cheers", {
    nickname: { stringValue: cheer.nickname },
    emoji: { stringValue: cheer.emoji },
    message: { stringValue: cheer.message },
    at: { timestampValue: new Date(cheer.at).toISOString() },
  });
  return true;
}

async function cloudLoadCheers(postId) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + "/" + COL_POSTS + "/" + postId + "/cheers?pageSize=50&key=" + FIREBASE_KEY
  );
  if (!res.ok) {
    throw makeError("응원 불러오기 실패", res.status);
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
// 순위표는 기록 전체(최대 2000개)를 읽는다. 비싼 질의라서 잠깐 담아둔다.
// 도전 중 화면의 티어 배지도 같은 자료를 쓰기 때문에, 캐시가 없으면
// 화면을 열 때마다 2000개씩 읽게 된다. (무료 요금제는 하루 5만 개다)
const RANKING_CACHE_MS = 60 * 1000;
let rankingCache = null;
let rankingCachedAt = 0;

async function cloudLoadRanking() {
  if (rankingCache && Date.now() - rankingCachedAt < RANKING_CACHE_MS) {
    return rankingCache;
  }
  const docs = await runQuery({
    structuredQuery: {
      from: [{ collectionId: COL_RECORDS }],
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

  rankingCache = [...byName.values()];
  rankingCachedAt = Date.now();
  return rankingCache;
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
          from: [{ collectionId: COL_RECORDS }],
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
    throw makeError("기록 불러오기 실패", res.status);
  }

  const rows = await res.json();
  // 결과가 없으면 문서가 들어있지 않은 줄이 하나 온다.
  return rows
    .filter((row) => row.document)
    .map((row) => fromFields(row.document.fields))
    .sort((a, b) => a.at - b.at);
}


// ---- 닉네임 주인 확인 (PIN) ----
// 로그인이 없으므로 닉네임마다 4자리 PIN을 정해두고, 같은 닉네임을 쓰려면
// 그 PIN을 맞혀야 하도록 한다.
//
// PIN을 그대로 저장하면 데이터베이스를 열어본 사람에게 그대로 보인다.
// 그래서 알아볼 수 없는 형태(해시)로 바꿔서 저장한다.
// 다만 4자리는 경우의 수가 적어서, 마음먹고 뚫으려는 사람은 막지 못한다.
// 친구가 남의 닉네임을 무심코 쓰는 것을 막는 용도다.
async function hashPin(nickname, pin) {
  const data = new TextEncoder().encode(nickname + ":" + pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 실패했을 때 "무엇 때문에" 실패했는지 알 수 있도록 상태 번호를 함께 담는다.
// 403은 Firebase 보안 규칙이 막은 것이고, 그 밖에는 대개 인터넷 문제다.
// 오류에 상태 코드를 붙여서 던진다.
// 이걸 안 붙이면 403(보안 규칙이 막음)과 진짜 연결 실패를 구분할 수 없어서,
// 인터넷이 멀쩡한 사람에게 "인터넷을 확인하세요"라고 잘못 안내하게 된다.
// 예전에 닉네임 화면에서 실제로 겪은 문제라, 던지는 곳은 전부 이걸 쓴다.
function makeError(message, status) {
  const err = new Error(message + " (" + status + ")");
  err.status = status;
  return err;
}

// 그 닉네임이 이미 있는지 본다. 없으면 null을 준다.
async function cloudGetUser(nickname) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE + "/users/" + encodeURIComponent(nickname) + "?key=" + FIREBASE_KEY
  );
  if (res.status === 404) return null;
  if (!res.ok) throw makeError("닉네임 확인 실패", res.status);
  const data = await res.json();
  return { pinHash: data.fields.pinHash.stringValue };
}

// 새 닉네임을 등록한다. 이미 있으면 실패한다.
async function cloudCreateUser(nickname, pinHash) {
  const res = await fetchWithTimeout(
    FIRESTORE_BASE +
      "/users?documentId=" +
      encodeURIComponent(nickname) +
      "&key=" +
      FIREBASE_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          pinHash: { stringValue: pinHash },
          at: { timestampValue: new Date().toISOString() },
        },
      }),
    }
  );
  if (!res.ok) throw makeError("닉네임 등록 실패", res.status);
  return true;
}
