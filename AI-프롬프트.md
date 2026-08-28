# ChatGPT에게 붙여넣을 현황 설명

ChatGPT는 이 저장소를 볼 수 없다. 대화를 시작할 때 아래 회색 상자 안의 글을
**통째로 복사해서 붙여넣어야** 엉뚱한 코드를 주지 않는다.

붙여넣은 다음, **고치려는 파일의 내용도 복사해서 같이 준다.**
(GitHub에서 파일을 열고 오른쪽 위 복사 아이콘을 누르면 된다.)

> ⚠️ 코드를 크게 고쳤다면 이 문서도 같이 고쳐야 한다.
> 특히 파일 목록, 함수 이름, `?v=` 번호가 실제와 달라지면 ChatGPT가 헷갈린다.

---

```
나는 중학생이고, 친구와 함께 "디지털 웰빙 타이머"라는 웹 앱을 만들고 있어.
스마트폰 과의존을 예방하는 앱이고, 우리 반 친구들이 실제로 쓰고 있어.
아래 현황을 정확히 파악하고 도와줘.


■ 프로젝트 규칙 (어기면 안 됨)

- 순수 HTML / CSS / JavaScript만 쓴다.
  React, Vue, jQuery 등 프레임워크 금지. npm, 빌드 도구도 안 쓴다.
- 서버가 없다. GitHub Pages로 배포하는 정적 사이트다.
- 데이터는 Firebase Firestore에 저장하지만, Firebase 라이브러리는 쓰지 않는다.
  Firestore REST API를 fetch로 직접 호출한다.
  firebase SDK를 import 하거나 <script>로 불러오는 코드는 절대 주지 마라.
- 웹 앱은 다른 앱을 강제로 차단할 수 없다. "앱 차단" 기능은 제안하지 마라.
- 로그인·회원가입이 없다. 닉네임(8자 이하)만으로 사람을 구분한다.


■ 파일 구성

- index.html    : 화면 6개의 구조. 모든 화면이 이 파일 안에 있다.
- style.css     : 디자인
- script.js     : 화면 전환, 타이머, 소리, 각 화면 그리기
- storage.js    : 이 기기 안에 저장 (localStorage)
- cloud.js      : Firebase와 통신
- manifest.json : 홈 화면에 추가했을 때 앱처럼 보이게 하는 설정
- icon-192.png, icon-512.png : 앱 아이콘

화면 6개는 전부 index.html 안에 있고, hidden 클래스를 붙였다 뗐다 하며
하나씩 보여준다. script.js의 showScreen(화면)이 그 일을 한다.
  nickname-screen : 닉네임 정하기 (처음 들어왔을 때만)
  setup-screen    : 목표 시간 정하기
  timer-screen    : 타이머 실행 + 결과
  stats-screen    : 내 기록
  board-screen    : 우리 반 게시판
  rank-screen     : 순위표


■ 이미 완성된 기능 (다시 만들지 마라)

1. 목표 시간 설정과 타이머 (슬라이더 1~120분, 10/25/50분 빠른 버튼)
2. 타이머 중 다른 앱·탭으로 나가면 실패 처리 (Page Visibility API)
3. 타이머 중 화면이 꺼지지 않게 함 (Screen Wake Lock)
4. 개인 기록과 통계 (성공/실패 횟수, 성공률, 누적 시간, 최근 기록 10개)
   - 기기가 달라도 닉네임이 같으면 기록이 따라온다
5. 공유 게시판 (성공했을 때만 올릴 수 있음, 이모지 5종 + 30자 응원)
6. 순위표 (성공 횟수 / 누적 시간 두 기준으로 전환, 내 순위 강조)
7. 인터넷이 끊겨도 타이머와 기록 저장은 되고, 연결되면 밀린 기록을 올린다
8. 타이머가 끝나면 소리로 알린다 (Web Audio로 직접 음을 만든다.
   소리 파일은 없다. 수업 중을 위해 끄는 스위치가 있다)
9. 짧은 이탈 봐주기 — 5초 안에 돌아오면 최대 3번까지 실패로 치지 않는다
10. 홈 화면에 추가하면 앱처럼 보인다 (manifest.json)
11. 게시판에 새 글이나 내 글에 달린 응원이 있으면 버튼에 빨간 점을 띄운다


■ Firestore 데이터 구조 (프로젝트 ID: timer-app-6965c, 무료 Spark 요금제)

records — 타이머 기록. 내 기록과 순위표에 쓴다.
  nickname       문자 (1~8자)
  goalMinutes    숫자 (1~600)      목표 시간(분)
  elapsedSeconds 숫자 (0~36000)    실제로 버틴 시간(초)
  result         문자              success / left(화면이탈) / gaveup(포기)
  at             시각

posts — 게시판 글
  nickname, goalMinutes, elapsedSeconds, message(100자까지), at

posts/{글번호}/cheers — 응원
  nickname, emoji(8자까지), message(30자까지), at


■ 주요 함수

cloud.js
  cloudSaveRecord(record)      기록 1개 올리기
  cloudLoadRecords(nickname)   그 닉네임의 기록 전부 가져오기 (최대 500개)
  cloudSavePost(post)          게시판에 글 올리기
  cloudLoadPosts(개수)          최근 글 가져오기 (지금은 20개)
  cloudLoadMyPosts(nickname, 개수)  내가 쓴 글만 가져오기
  cloudSaveCheer(postId, cheer) 응원 올리기
  cloudLoadCheers(postId)      그 글의 응원 가져오기
  cloudLoadRanking()           records 전부 읽어 닉네임별로 합치기 (최대 2000개)
                               반환: [{nickname, successCount, totalSeconds, tries}]
                               ※ 날짜(at)를 버리고 합치기 때문에
                                 "언제 했는지"는 알 수 없다

storage.js
  loadNickname() / saveNickname(이름)
  loadRecords() / saveRecord(기록) / clearRecords()
  loadSoundOn() / saveSoundOn(참거짓)     소리 켜짐 여부
  loadBoardSeen() / saveBoardSeen(밀리초)  게시판을 마지막으로 본 시각
  summarize(기록목록)  → {successCount, failCount, totalSeconds, successRate}

script.js
  showScreen(화면)             화면 전환
  formatDuration(초)          "1시간 25분" 같은 문자로 바꿈
  formatDate(밀리초)           "8월 28일 오후 3:20" 같은 문자로 바꿈
  renderStats() / renderBoard() / renderRank()   각 화면 그리기
  playChime()                 끝났을 때 소리 울리기
  checkBoardUpdates()         게시판 빨간 점 확인

타이머 화면에서 주의할 점:
  화면을 벗어나 있는 동안에는 성공으로 끝내지 않는다(script.js의 setInterval 안).
  이 처리를 지우면 나갔다 오기만 해도 성공하는 꼼수가 생긴다.


■ 반드시 지킬 것

1. 코드를 줄 때는 "어느 파일의 어디를 고치는지" 먼저 말해라.
   파일 전체를 새로 줄지, 일부만 바꿀지 명확히 구분해라.

2. style.css나 .js 파일을 고쳤으면, index.html에 있는 ?v= 숫자를
   전부 같은 값으로 하나 올려야 한다고 반드시 알려줘라.
   이걸 빼먹으면 브라우저가 옛날 파일을 계속 써서,
   새 버튼이 화면에 보이는데 눌러도 아무 반응이 없다. 원인 찾기가 매우 어렵다.

3. 사용자가 쓴 글을 화면에 넣을 때 innerHTML을 절대 쓰지 마라. textContent만 써라.
   친구가 장난으로 HTML 태그를 적어도 그냥 글자로만 보이게 해야 한다.

4. Firebase에 새로운 형태의 데이터를 저장하는 코드라면,
   Firestore 보안 규칙도 함께 고쳐야 한다고 먼저 알려줘라.
   규칙에 적혀 있지 않은 필드가 하나라도 섞이면 저장이 통째로 거부된다
   (403 오류). 이미 있는 데이터로 계산만 하는 기능이면 규칙은 안 고쳐도 된다.

5. 한 번에 한 가지씩만 해라. 여러 기능을 한꺼번에 만들지 마라.

6. 나는 코딩이 거의 처음이다. 전문 용어는 풀어서 설명해라.

7. 확실하지 않으면 추측하지 말고 모른다고 말해라.

8. 한국어로 답해라.


이제 고칠 파일 내용을 붙여넣을게.
```

---

## 새 기능을 만들 때 미리 알아둘 것

아래는 지금 하려는 기능들에서 실제로 걸릴 문제들이다.
해당 기능을 작업할 때 위 프롬프트 뒤에 함께 붙여넣으면 좋다.

### 티어 (등급)

```
티어 기능을 만들려고 해. 이미 있는 records 데이터로 계산만 하면 되니까
Firebase 규칙은 안 고쳐도 돼.

미리 정해야 할 문제가 있어. 누적 성공 횟수나 누적 시간만으로 등급을 매기면,
늦게 시작한 친구는 아무리 열심히 해도 먼저 시작한 사람을 못 따라잡아.
반 전체가 쓰는 앱이라 이게 꽤 큰 문제야.
이 점을 고려한 기준을 같이 정해줘.
```

### 연속 학습 (스트릭)

```
연속 학습 일수(며칠 연속 성공했는지)를 만들려고 해.
이미 있는 records 데이터로 계산만 하면 되니까 Firebase 규칙은 안 고쳐도 돼.

주의할 점 세 가지:
1) Firestore에 저장된 at은 UTC(세계표준시)라서, 그냥 날짜를 뽑으면
   한국 시간 밤 9시 이후 기록이 다음 날로 밀린다. 저녁에 공부한 게
   내일 걸로 세지면 연속 일수가 엉망이 된다. 한국 시간 기준으로 날짜를 뽑아야 해.
2) cloudLoadRanking()은 날짜를 버리고 합치기 때문에 그대로 쓸 수 없다.
   날짜도 같이 모으도록 고쳐야 하는데, 이 함수는 순위표(renderRank)도
   같이 쓰니까 순위표가 깨지지 않는지 확인해야 한다.
3) 하루 빠졌다고 0으로 초기화되면 너무 가혹해서 사람들이 앱을 그만 쓴다.
   "주 1회 봐주기" 같은 완충 장치를 같이 생각해줘.
```

### 주간 순위표

```
이번 주 기록만으로 순위를 매기는 기능을 만들려고 해.
전체 누적 순위는 이미 있으니, 그것과 별개로 주간 순위를 추가하고 싶어.
늦게 시작한 친구도 매주 새로 겨룰 수 있게 하는 게 목적이야.
cloudLoadRanking()이 날짜를 버리는 문제는 여기서도 똑같이 걸린다.
```
