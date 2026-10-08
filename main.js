// 관리자 화면 — 회원·점수 관리 / 이벤트 집계 / 보상 지급.
import { sb, $, fmt, fmtDate, fmtDateTime, fmtTime, esc, kstToday, askReason, askReasonRequired, rpc } from "./app.js";

/** 처음 열었을 때 보이는 탭. 차트다(사용자 지시) — 관리자가 가장 자주 확인하는 건
 *  개별 회원이 아니라 "어제 오늘 뭐가 달라졌나"이기 때문이다. */
let TAB = "charts";
let PLAYERS = [], EVENTS = [], AUDIT = [], REWARDS = [], BATCHES = [], STATS = [], BUCKETS = [];
let FUNNEL = [], RETENTION = [], NOTICES = [], PUSHES = [];
let DAILY_BUCKETS = [];
// 푸시 집계(089). 기간과, 시간대 표를 볼 발송(null이면 전체).
let PUSH_DAILY = [], PUSH_HOURS = [], PUSH_DAYS = 30, PUSH_HOUR_MSG = null;
let PAY_DAILY = [], PAY_MONTHLY = [], PAY_PRODUCT = [], PAY_LEDGER = [], COIN_SINKS = [];
/** 같이하기(대전) — 일자별/계정별/판 크기별 집계와 기능 스위치. */
let VS_DAILY = [], VS_PLAYERS = [], VS_BOARDS = [], VS_MODES = [], VS_ON = false;
/** 지금 살아 있는 대전 방 목록. */
let VS_ROOMS = [];
/** 공개 매칭 — 현황 한 줄과 신고 목록. */
let MATCH = null, REPORTS = [];
/** 경제 건강 요약 한 줄과 오늘 코인 이상 획득 계정. */
let ECON = null, ANOMALIES = [];
// 상단 카드 숫자. 서버가 센다(092). 회원 목록(50명 한 쪽)으로 세면 50명을 넘을 때 틀렸다.
let SUMMARY = null;
/** 앱 설정값 전체 (key → value). 업데이트 관문·기능 스위치가 여기 들어 있다. */
let CONFIG = {};
/** 회원 id → {orders, revenue, currency}. 회원 목록 옆에 붙여 쓴다. */
let PAY_TOTALS = {};
/** 회원마다 마지막으로 켠 앱의 기기와 버전(109). 함수가 없는 서버면 null이고 칸에 ?를 보인다. */
let APP_VERSIONS = null;
/** 이벤트 이력을 펼쳐 놓은 회원. */
let OPEN_MEMBER = null, MEMBER_EVENTS = [], MEMBER_PAYS = [];
let SORT = "total", QUERY = "", EMAIL = "";
/** 회원 목록도 끊어 받는다(079). **찾기는 서버가 한다** — 브라우저에서 거르면
 *  지금 쪽 안에서만 찾게 되어, 3쪽에 있는 사람이 「없다」고 나온다. */
let PLAYER_PAGE = 0, PLAYER_TOTAL = 0;
/** 차트 막대를 눌러 넘어온 조건(098). { label, arg } — arg는 서버가 준 값을 그대로 admin_players_ranked의 p_filter로 넘긴다.
 *  찾기(QUERY)와 같이 걸린다. 회원 목록 위의 「조건 해제」로 푼다. */
let PLAYER_FILTER = null;
/** 「코인을 어디에 썼나」와 그 막대에서 넘어간 회원 목록이 같은 기간을 본다. */
const SINK_DAYS = 30;
/** 찾기 요청을 미루는 타이머. 타자마다 서버를 두드리지 않기 위해서다. */
let QUERY_TIMER = null;
const PLAYER_SIZE = 50;
/** 내림차순인가. 기준을 바꾸면 그 기준의 기본 방향으로 돌아간다. */
let DESC = true;
/** 기준마다 자연스러운 방향. 이름만 가나다순(오름)이고 나머지는 큰 것부터다. */
const defaultDesc = (key) => key !== "username";
/** 표 머리글 → 정렬 기준. 여기 없는 칸(결제)은 눌러도 안 세운다 —
 *  PAY_TOTALS는 브라우저에서 합친 값이라 서버가 그걸로 못 세운다. */
const SORT_BY_COL = {
  username: "username", level: "level", total: "total", daily: "daily", coins: "coins",
  vs: "vs_wins", coop: "coop_wins", played: "played", created: "created",
};
/** 다중 삭제용 선택 목록. 검색어를 바꿔도 선택은 유지된다 — 여러 번 걸러 가며
 *  고르는 게 자연스럽고, 안 보이는 걸 지우는 사고는 삭제 직전 명단 확인으로 막는다. */
let SELECTED = new Set();
// 지금 푸시를 받을 수 있는 회원 → { devices, consented_at }. 회원 탭에서만 불러온다(085).
// 못 읽었으면 null — 「받을 사람이 없다」와 가른다.
let REACH = {};
/** 보상 탭에서 펼쳐 놓은 묶음 id와 그 명단. */
let OPEN_BATCH = null, BATCH_MEMBERS = [];
/** 보상 탭 안의 하위 탭 — "live"(진행 중) / "done"(지난 것). */
let BATCH_VIEW = "live";
/** 관리 기록 필터 — 작업 종류와 검색어. */
let AUDIT_KIND = "", AUDIT_Q = "";
/** 이벤트 메뉴(103 admin_live_events). 시작 내림차순이다. 103 전 서버면 빈 목록과 LE_ERR.
 *  이벤트 메뉴, 푸시(이벤트 링크·조건), 차트의 이벤트 보기가 같이 쓴다. */
let LIVE_EVENTS = [], LE_ERR = null;
/** 차트 메뉴의 하위 화면(7절). all은 지금까지의 차트, 나머지는 107 보고서 하나와 원본 기록 표다. */
let CHART_VIEW = "all";
/** 오늘의 퍼즐·숫자 보기의 기간(일)과 시험 계정 포함 여부. 이벤트 보기는 PLAY_EVENT 하나를 본다. */
let PLAY_DAYS = 14, PLAY_TEST = false, PLAY_EVENT = null;
/** 보고서(107 admin_*_report)와 원본 기록 한 쪽. PLAY_FILTER는 막대를 눌러 고른 조건 { label, arg }이고
 *  arg는 서버가 그 막대에 실어 준 filter를 그대로 원본 표 함수에 넘긴다(107 「지킬 약속」: 막대 n = 표 total_count). */
let PLAY_REPORT = null, PLAY_ERR = null, PLAY_ROWS = [], PLAY_ROWS_ERR = null, PLAY_TOTAL = 0, PLAY_PAGE = 0, PLAY_FILTER = null;
const PLAY_SIZE = 50;
/** 회원 이력의 모드별 기록 버튼이 넘기는 회원 { id, label }. loadPlay가 바탕 조건을 정한 뒤 PLAY_FILTER로 옮긴다. */
let PLAY_PENDING_MEMBER = null;
/** 회원 기록을 볼 때의 기간(일). 서버 보고서 상한 92일 안이다. */
const PLAY_MEMBER_DAYS = 90;
/** 보기마다 [보고서, 원본 표] 함수(107). */
const PLAY_RPC = {
  daily: ["admin_daily_record_report", "admin_daily_record_rows"],
  number: ["admin_number_report", "admin_number_board_rows"],
  event: ["admin_live_event_report", "admin_live_event_run_rows"],
};
/** 랭킹 보상을 우편함에서 받을 수 있는 날 수(18절). 서버 099 mailbox_rank_claim_until(정산된 날 + 8일 0시)과 짝이다.
 *  화면 문구는 이 값만 읽는다. */
const RANK_CLAIM_DAYS = 7;
/** 이벤트 종류별 기본값(7절). 새 이벤트 창이 이것으로 채운다. 산책길 여는 레벨은 표 check live_events_walk_level(103)과 같은
 *  하한이라 창도 이보다 낮게 저장하지 못하게 한다. 보상 제안값은 10절 표의 「7일 이벤트」 줄이다. */
const KIND_DEFAULTS = {
  walk: {
    label: "산책길", minLevel: 8, minBuild: { ios: 51, android: 51 },
    tiers: [
      { to: 1, coins: 700, hints: 2, autos: 2 },
      { to: 2, coins: 400, hints: 1, autos: 1 },
      { to: 3, coins: 300, hints: 1, autos: 0 },
      { to: 10, coins: 100, hints: 0, autos: 0 },
    ],
  },
};

// ------------------------------------------------------------------ 설명 배지
// 긴 설명과 예는 이름 옆 동그란 「?」 배지에 넣는다(사용자 요청, 2026-10-08). 모든 화면이 이 함수 하나로 만든다.
// 마우스를 올리면 보이고, 누르면 열고 닫는다(휴대폰). 정적 HTML(index.html 대화상자)은 data-infotip="설명"으로 적어 두면
// 아래 upgradeTips가 같은 모양으로 바꾼다.
function infoTip(text) {
  if (!text) return "";
  return `<span class="tip" tabindex="0" role="button" aria-label="설명 보기"><span class="tip-i" aria-hidden="true">?</span>`
    + `<span class="tip-b" role="tooltip">${esc(text)}</span></span>`;
}
function upgradeTips(root = document) {
  root.querySelectorAll("[data-infotip]").forEach((el) => { el.outerHTML = infoTip(el.dataset.infotip); });
}
/** 말풍선 하나. 대화상자(dialog)가 열려 있으면 그 안에 둬야 맨 위에 보이므로 띄울 때마다 자리를 옮긴다. */
function tipBubble() {
  let el = document.getElementById("tipBubble");
  if (!el) { el = document.createElement("div"); el.id = "tipBubble"; el.setAttribute("role", "tooltip"); }
  const host = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
  if (el.parentElement !== host) host.append(el);
  return el;
}
/** 배지 tip의 설명을 배지 바로 아래에 띄운다. 화면 오른쪽·아래 밖으로 나가면 안쪽으로 당긴다. 좁은 화면은 CSS가 아래 띠로 띄운다. */
function showTip(tip) {
  const el = tipBubble();
  el.textContent = tip.querySelector(".tip-b")?.textContent || "";
  const r = tip.getBoundingClientRect();
  el.style.left = `${Math.max(8, r.left - 8)}px`;
  el.style.top = `${r.bottom + 6}px`;
  el.classList.add("show");
  const w = el.getBoundingClientRect();
  if (w.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - 8 - w.width)}px`;
  if (w.bottom > window.innerHeight - 8 && r.top - 6 - w.height > 8) el.style.top = `${r.top - 6 - w.height}px`;
}
function hideTip() {
  document.getElementById("tipBubble")?.classList.remove("show");
  document.querySelectorAll(".tip.open").forEach((t) => t.classList.remove("open"));
}
// 화면을 통째로 다시 그려도 배지가 동작하게 문서에 한 번만 건다.
// 누름은 잡아 먹는다. 배지가 label·정렬 머리글 안에 있어도 체크박스가 바뀌거나 정렬이 돌지 않게 한다.
document.addEventListener("click", (e) => {
  const tip = e.target.closest?.(".tip");
  if (!tip) { hideTip(); return; }
  e.preventDefault();
  e.stopPropagation();
  const wasOpen = tip.classList.contains("open");
  hideTip();
  if (!wasOpen) { tip.classList.add("open"); showTip(tip); }
}, true);
document.addEventListener("keydown", (e) => {
  const tip = e.target.closest?.(".tip");
  if (tip && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    const wasOpen = tip.classList.contains("open");
    hideTip();
    if (!wasOpen) { tip.classList.add("open"); showTip(tip); }
  }
  if (e.key === "Escape") hideTip();
});
// 마우스가 있는 화면은 올리기만 해도 보인다. 눌러서 열어 둔 것은 마우스가 떠나도 남긴다.
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const tip = e.target.closest?.(".tip");
  if (tip && !document.querySelector(".tip.open")) showTip(tip);
});
document.addEventListener("pointerout", (e) => {
  if (e.pointerType !== "mouse") return;
  const tip = e.target.closest?.(".tip");
  if (tip && !tip.contains(e.relatedTarget) && !tip.classList.contains("open")) document.getElementById("tipBubble")?.classList.remove("show");
});
// fixed 말풍선은 화면을 굴리면 배지와 떨어진다. 굴리면 닫는다.
document.addEventListener("scroll", hideTip, true);
upgradeTips();

// ------------------------------------------------------------------ 접는 칸 · 더 보기 · 0 숨기기 (2026-10-08)
// 화면이 너무 길다는 요청으로 넣었다. 서버에 묻는 것은 하나도 바꾸지 않고 그리는 방식만 바꾼다.

/** 기기에 적어 두는 화면 상태. 사생활 보호 창 등에서는 localStorage가 던지므로 늘 감싸고, 못 읽으면 기본값으로 그린다. */
function loadStore(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? def; } catch { return def; }
}
function saveStore(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 못 적어도 이번 화면은 그대로 쓴다 */ }
}

/** 접는 칸이 열려 있는지(칸 이름 → 참·거짓). 적어 둔 적이 없는 칸은 sec()의 open 기본값을 따른다. */
const SEC_STORE = "dogadm.sections";
const SEC_OPEN = loadStore(SEC_STORE, {});

/**
 * 머리 줄을 눌러 접고 펴는 덩어리. id는 화면마다 겹치지 않는 이름이고, 열고 닫은 상태를 이 이름으로 기억한다.
 * 접어도 안의 버튼·입력칸은 그대로 그려 두므로 버튼 배선과 저장 함수는 달라지지 않는다.
 * note는 접혀 있을 때만 제목 옆에 보이는 짧은 글이다(예: 「3건」).
 */
function sec(id, title, body, { open = false, note = "", sub = false } = {}) {
  const isOpen = id in SEC_OPEN ? SEC_OPEN[id] : open;
  const head = sub ? `<h3 class="sub">${title}</h3>` : `<h2>${title}</h2>`;
  return `<details class="sec${sub ? " sub" : ""}" data-sec="${esc(id)}"${isOpen ? " open" : ""}>`
    + `<summary>${head}${note ? `<span class="sec-note">${note}</span>` : ""}</summary><div class="sec-body">${body}</div></details>`;
}
// toggle은 위로 전달되지 않아서 붙잡기 단계(capture)로 받는다. 화면을 다시 그려도 문서에 한 번만 건다.
document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.sec) return;
  SEC_OPEN[d.dataset.sec] = d.open;
  saveStore(SEC_STORE, SEC_OPEN);
}, true);

/** 긴 표는 처음에 30줄만 보이고 「더 보기」마다 30줄씩 더 보인다. 서버에서 받는 줄 수는 그대로다. */
const MORE_STEP = 30;
/** 표 이름 → 지금 보이는 줄 수. 버튼을 누른 뒤 화면을 다시 그려도 펼친 만큼 남긴다. 새로고침하면 처음으로. */
const MORE_SHOWN = {};

/** 줄 묶음(한 항목에 tr이 여럿일 수 있다)마다 번호를 달고, 보일 수를 넘는 것은 가린다. */
function moreRows(key, items) {
  const n = MORE_SHOWN[key] ?? MORE_STEP;
  const k = esc(key);
  return items.map((h, i) => h.replace(/<tr(?=[\s>])/g,
    `<tr data-mr="${k}" data-mri="${i}"${i >= n ? " data-mr-hide" : ""}`)).join("");
}
function moreBarText(n, total) {
  return [`더 보기 · ${fmt(Math.min(MORE_STEP, total - n))}줄 더`, `${fmt(Math.min(n, total))} / ${fmt(total)}줄 보는 중`];
}
/** 표 아래 「더 보기」 줄. 다 보이면 그리지 않는다. */
function moreBar(key, total) {
  const n = MORE_SHOWN[key] ?? MORE_STEP;
  if (total <= n) return "";
  const [b, s] = moreBarText(n, total);
  return `<div class="more-bar"><button class="ghost sm" type="button" data-more="${esc(key)}" data-total="${total}">${b}</button>`
    + `<span class="muted" style="font-size:12.5px">${s}</span></div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-more]");
  if (!b) return;
  const key = b.dataset.more, total = Number(b.dataset.total) || 0;
  const n = (MORE_SHOWN[key] ?? MORE_STEP) + MORE_STEP;
  MORE_SHOWN[key] = n;
  document.querySelectorAll("tr[data-mr]").forEach((tr) => {
    if (tr.dataset.mr === key) tr.toggleAttribute("data-mr-hide", Number(tr.dataset.mri) >= n);
  });
  const bar = b.closest(".more-bar");
  if (n >= total) bar.remove();
  else { const [bt, st] = moreBarText(n, total); b.textContent = bt; bar.querySelector("span").textContent = st; }
  syncPickAll();
});

/** 0이라 알려 주는 것이 없는 값인가. 1~9가 하나도 없으면 0이거나 값이 없다는 표시다. */
const zeroish = (t) => !/[1-9]/.test(String(t));
const EMPTY_LINE = '<div class="empty">아직 기록이 없어요</div>';

/**
 * 값이 전부 0인 것을 숨긴다(사용자 요청, 2026-10-08). 그린 뒤에 화면을 훑는다.
 *   표: <table data-z="rows cols">. rows는 숫자 칸(td.num)이 모두 0인 줄을, cols는 모든 줄이 0인 숫자 칸을 숨긴다.
 *       지금 세우는 기준 칸(th.on)과 data-keep을 단 머리글은 남긴다. 줄이 다 숨으면 표 대신 「아직 기록이 없어요」 한 줄.
 *   카드: <div class="card" data-z>. 값이 0이면 숨긴다. 한 줄의 카드가 다 숨으면 「아직 기록이 없어요」 한 줄.
 * data-z를 단 것만 본다. 오늘 숫자처럼 0이 뜻이 있는 카드에는 달지 않았다.
 */
function pruneZeros(root = document) {
  root.querySelectorAll("table[data-z]").forEach((t) => {
    const mode = t.dataset.z;
    const heads = [...t.querySelectorAll(":scope > thead > tr > th")];
    const rows = [...t.querySelectorAll(":scope > tbody > tr")];
    if (mode.includes("rows")) {
      rows.forEach((tr) => {
        const nums = [...tr.children].filter((td) => td.matches("td.num"));
        if (nums.length && nums.every((td) => zeroish(td.textContent))) tr.setAttribute("data-zh", "");
      });
    }
    if (mode.includes("cols")) {
      const full = rows.filter((tr) => !tr.hasAttribute("data-zh") && tr.children.length === heads.length);
      heads.forEach((th, c) => {
        if (!th.classList.contains("num") || th.classList.contains("on") || th.hasAttribute("data-keep")) return;
        if (!full.length || !full.every((tr) => zeroish(tr.children[c].textContent))) return;
        th.setAttribute("data-zh", "");
        full.forEach((tr) => tr.children[c].setAttribute("data-zh", ""));
      });
    }
    if (rows.length && rows.every((tr) => tr.hasAttribute("data-zh"))) {
      (t.closest(".table-scroll") || t).outerHTML = EMPTY_LINE;
    }
  });
  root.querySelectorAll(".card[data-z]").forEach((c) => {
    if (zeroish(c.querySelector(".value")?.textContent ?? "")) c.setAttribute("data-zh", "");
  });
  root.querySelectorAll(".cards").forEach((g) => {
    const cs = [...g.children];
    if (cs.length && cs.every((c) => c.hasAttribute("data-zh"))) g.outerHTML = EMPTY_LINE;
  });
}

/** 머리(.head) 높이를 CSS에 알린다. 붙는 하위 탭(.subtabs.stick)이 머리 바로 아래에 붙는다. */
function syncHeadH() {
  const h = document.querySelector(".head");
  if (h) document.documentElement.style.setProperty("--head-h", h.offsetHeight + "px");
}
window.addEventListener("resize", syncHeadH);

// ------------------------------------------------------------------ 로그인
function renderLogin(msg) {
  $("#app").innerHTML = `
    <div class="login">
      <h2>DogPuzzle 관리자</h2>
      <p>회원 정보를 다루는 화면입니다. 관리자로 등록된 이메일로 로그인하세요.</p>
      <input type="email" id="email" placeholder="이메일" autocomplete="username">
      <input type="password" id="pw" placeholder="비밀번호" autocomplete="current-password">
      <button id="go" style="width:100%">로그인</button>
      <div class="err" id="err">${esc(msg || "")}</div>
    </div>`;
  const submit = async () => {
    $("#err").textContent = "";
    $("#go").disabled = true;
    const { error } = await sb.auth.signInWithPassword({
      email: $("#email").value.trim(),
      password: $("#pw").value,
    });
    $("#go").disabled = false;
    if (error) $("#err").textContent = "로그인하지 못했습니다. " + plainError(error.message);
    else boot();
  };
  $("#go").onclick = submit;
  $("#pw").onkeydown = (e) => { if (e.key === "Enter") submit(); };
  $("#email").focus();
}

// ------------------------------------------------------------------ 2차 인증 (111)
// 비밀번호 다음에 OTP 앱(Google Authenticator 등)의 6자리 코드를 받는다. Supabase Auth TOTP MFA다.
// 서버 is_admin()이 aal2 로그인만 관리자로 보므로, 이 화면을 건너뛰어도 관리자 함수는 열리지 않는다.
const MFA_ISSUER = "DogPuzzle 관리자";

/** 로그인은 됐는데 2차 인증 전이면 코드 화면을 띄우고 true를 돌려준다. 끝났으면 false. */
async function needsMfa() {
  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) { renderLogin("2차 인증 상태를 읽지 못했습니다. " + plainError(error.message)); return true; }
  if (data.currentLevel === "aal2") return false;
  const { data: f, error: fe } = await sb.auth.mfa.listFactors();
  if (fe) { renderLogin("2차 인증 정보를 읽지 못했습니다. " + plainError(fe.message)); return true; }
  const verified = (f.totp || []).find((x) => x.status === "verified");
  if (verified) renderMfaCode(verified.id);
  else await renderMfaEnroll(f.all || []);
  return true;
}

/** 코드 입력 칸과 확인 버튼. 등록 화면과 확인 화면이 같이 쓴다. */
function mfaCodeBox(factorId, intro, extra = "") {
  $("#app").innerHTML = `
    <div class="login">
      <h2>2차 인증</h2>
      <p>${intro}</p>
      ${extra}
      <input type="text" id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6자리 숫자">
      <button id="mfaGo" style="width:100%">확인</button>
      <button class="ghost" id="mfaOut" style="width:100%;margin-top:8px">로그아웃</button>
      <div class="err" id="mfaErr"></div>
    </div>`;
  const submit = async () => {
    const code = $("#mfaCode").value.replace(/\D/g, "");
    if (code.length !== 6) { $("#mfaErr").textContent = "6자리 숫자를 넣어 주세요"; return; }
    $("#mfaGo").disabled = true;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    $("#mfaGo").disabled = false;
    if (error) { $("#mfaErr").textContent = "코드가 맞지 않습니다. " + plainError(error.message); $("#mfaCode").select(); return; }
    boot();
  };
  $("#mfaGo").onclick = submit;
  $("#mfaCode").onkeydown = (e) => { if (e.key === "Enter") submit(); };
  $("#mfaOut").onclick = async () => { await sb.auth.signOut(); renderLogin(); };
  $("#mfaCode").focus();
}

function renderMfaCode(factorId) {
  mfaCodeBox(factorId, "휴대폰 인증 앱에 뜬 「" + esc(MFA_ISSUER) + "」의 6자리 숫자를 넣어 주세요. 숫자는 30초마다 바뀝니다.");
}

/** 처음 한 번 등록. 끝내지 못한 옛 등록이 있으면 지우고 새로 만든다. */
async function renderMfaEnroll(all) {
  for (const x of all.filter((x) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", issuer: MFA_ISSUER, friendlyName: MFA_ISSUER });
  if (error) { renderLogin("2차 인증 등록을 시작하지 못했습니다. " + plainError(error.message)); return; }
  // qr_code는 판에 따라 SVG 코드 자체이거나 data: 주소다. 코드면 data: 주소로 바꿔 img에 넣는다.
  const qr = String(data.totp.qr_code || "");
  const qrSrc = qr.trim().startsWith("<") ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr) : qr;
  mfaCodeBox(data.id,
    "처음 한 번만 등록합니다. 휴대폰의 인증 앱, 예를 들어 Google Authenticator로 아래 QR을 찍은 뒤 앱에 나온 6자리 숫자를 넣어 주세요.",
    `<img src="${esc(qrSrc)}" alt="2차 인증 QR" style="display:block;width:200px;height:200px;margin:0 auto 10px;background:#fff;border-radius:8px">
     <div class="muted" style="font-size:12px;word-break:break-all;margin-bottom:12px">QR을 못 찍으면 인증 앱에 이 글자를 직접 넣으세요: ${esc(data.totp.secret)}</div>`);
}

// ------------------------------------------------------------------ 데이터
async function loadAnomalies() {
  // 문턱은 설정에서. 경제가 바뀌면 값도 바뀌어야 하니 하드코딩하지 않는다.
  const th = Number(CONFIG?.anomaly_threshold ?? 3000) || 3000;
  ANOMALIES = await rpc("admin_coin_anomalies", { p_threshold: th }).catch(() => []) || [];
}

/**
 * 회원 목록.
 *
 * 052/053의 admin_players_ranked를 쓴다 — profiles를 직접 읽으면 대전 전적과
 * 코인 잔액이 안 온다(다른 표에 있다). 정렬도 서버가 한다: 대전 승수처럼 profiles에
 * 없는 값으로 세우려면 여기서는 방법이 없다.
 *
 * **옛 경로를 남겨 둔다.** 관리자 페이지는 서버보다 먼저 배포될 수 있어서, 함수가
 * 아직 없으면 예전처럼 profiles를 읽어 최소한 목록은 보이게 한다.
 */
async function loadPlayers() {
  const serverSorts = ["total", "level", "daily", "coins", "vs_wins", "coop_wins",
                       "created", "username", "played"];
  if (serverSorts.includes(SORT)) {
    // ⚠️ **방향·찾기·끊어 받기를 모두 서버가 한다**(075·079). 한 쪽만 받아 와서
    // 브라우저에서 뒤집거나 거르면 **그 쪽 안에서만** 맞는 답이 나온다.
    const rows = await rpc("admin_players_ranked", {
      p_sort: SORT, p_limit: PLAYER_SIZE, p_desc: DESC,
      p_offset: PLAYER_PAGE * PLAYER_SIZE,
      p_query: QUERY.trim() || null,
      p_filter: PLAYER_FILTER ? PLAYER_FILTER.arg : null,
    }).catch(() => null);
    if (rows) {
      PLAYERS = rows;
      PLAYER_TOTAL = rows.length ? Number(rows[0].total_count) || 0 : 0;
      return null;
    }
  }
  // 되돌아가는 길 — 옛 정렬 이름을 profiles 칸 이름으로 옮긴다.
  const col = SORT === "daily" ? "daily_score"
            : SORT === "created" ? "created_at"
            : SORT === "username" ? "username" : "total_score";
  const from = PLAYER_PAGE * PLAYER_SIZE;
  const { data, error } = await sb.from("profiles").select("*")
    .order(col, { ascending: !DESC }).range(from, from + PLAYER_SIZE - 1);
  PLAYERS = data || [];
  PLAYER_TOTAL = 0;          // 옛 서버에서는 전체 수를 모른다 — 쪽 수를 안 그린다.
  return error;
}

async function loadEvents() {
  // 집계는 서버에서 끝낸다 — 원본 이벤트를 다 내려받으면 금세 수십만 행이 된다.
  try { EVENTS = await rpc("admin_event_summary", { days: 14 }) || []; return null; }
  catch (e) { EVENTS = []; return e; }
}

async function loadAudit() {
  const { data, error } = await sb.from("admin_actions").select("*")
    .order("created_at", { ascending: false }).limit(100);
  AUDIT = data || [];
  return error;
}

async function loadRewards() {
  const { data, error } = await sb.from("pending_rewards").select("*")
    .order("created_at", { ascending: false }).limit(100);
  REWARDS = data || [];
  return error;
}

async function loadBatches() {
  try { BATCHES = await rpc("admin_batch_summary") || []; return null; }
  catch (e) { BATCHES = []; return e; }
}

async function loadStats() {
  try {
    STATS = await rpc("admin_daily_stats", { days: 30 }) || [];
    BUCKETS = await rpc("admin_level_buckets") || [];
    // 레벨 1~30만 받던 admin_level_funnel 대신 끝까지 받는다(097). 밤 정리 전 오늘 깬 판도 센다.
    FUNNEL = await rpc("admin_level_reach").catch(() => []) || [];
    DAILY_BUCKETS = await rpc("admin_daily_score_buckets").catch(() => []) || [];
    RETENTION = await rpc("admin_retention", { p_days: 21 }) || [];
    // 기간을 30일로 맞춘다. 이 카드만 14일이라 바로 아래 30일 그래프와 숫자가 안 맞았다 —
    // 같은 화면에서 같은 주제를 다른 창으로 보여 주면 매번 어느 쪽 기간인지 되짚어야 한다.
    ECON = (await rpc("admin_economy_health", { p_days: 30 }).catch(() => []))[0] || null;
    // 코인 소모처는 **구매 탭에 있었다.** 구매는 실제 결제(IAP) 이야기고 코인 소모는
    // 게임 안 경제라 주제가 다르다. 경제를 한자리에 모으려고 이쪽으로 옮겼다.
    COIN_SINKS = await rpc("admin_coin_sinks", { p_days: SINK_DAYS }).catch(() => []) || [];
    return null;
  } catch (e) { STATS = []; BUCKETS = []; FUNNEL = []; DAILY_BUCKETS = []; RETENTION = []; return e; }
}

async function loadPurchases() {
  try {
    PAY_DAILY = await rpc("admin_purchase_daily", { p_days: 30 }) || [];
    PAY_MONTHLY = await rpc("admin_purchase_monthly", { p_months: 12 }) || [];
    PAY_PRODUCT = await rpc("admin_purchase_by_product") || [];
    PAY_LEDGER = await rpc("admin_purchase_ledger", { p_limit: 200 }) || [];
    return null;
  } catch (e) {
    PAY_DAILY = []; PAY_MONTHLY = []; PAY_PRODUCT = []; PAY_LEDGER = [];
    return e;
  }
}

/** 회원 목록에 결제 정보를 붙이려면 목록과 같이 불러와야 한다. */
async function loadAppVersions() {
  try {
    const rows = await rpc("admin_app_versions") || [];
    APP_VERSIONS = Object.fromEntries(rows.map((r) => [r.profile_id, r]));
  } catch { APP_VERSIONS = null; }
}

/** 앱이 app_open에 담아 보낸 버전 숫자(주 × 10000 + 부 × 100 + 수, 109)를 1.5.0 꼴로. */
function versionName(code) {
  const v = Number(code);
  return `${Math.floor(v / 10000)}.${Math.floor(v / 100) % 100}.${v % 100}`;
}

/** 회원 목록 「앱」 칸. 버전을 담기 시작한 것이 1.5.0이라 빈 값은 그 전 앱이다. */
function appVersionCell(id) {
  if (APP_VERSIONS === null) return '<span class="muted" title="앱 버전 기록을 못 읽었습니다">?</span>';
  const a = APP_VERSIONS[id];
  if (!a) return '<span class="muted" title="최근 90일 안에 앱을 켠 기록이 없습니다">—</span>';
  const os = PLATFORM_NAMES[a.platform] || a.platform || "";
  const ver = a.version_code == null ? '<span class="muted">1.4.4 이하</span>' : esc(versionName(a.version_code));
  return `<span title="마지막으로 켠 때 ${esc(fmtDateTime(a.opened_at))}">${esc(os)} ${ver}</span>`;
}

async function loadPayTotals() {
  try {
    const rows = await rpc("admin_purchase_totals") || [];
    PAY_TOTALS = Object.fromEntries(rows.map((r) => [r.profile_id, r]));
  } catch { PAY_TOTALS = {}; }
}

async function loadNotices() {
  // 099(우편함) 이후 서버는 창 여부(popup)를 같이 준다. 그 전 서버는 옛 함수로 떨어진다.
  try { NOTICES = await rpc("admin_notices_v2") || []; return null; }
  catch { /* 아래 옛 함수로 */ }
  try { NOTICES = await rpc("admin_notices") || []; return null; }
  catch (e) { NOTICES = []; return e; }
}

/** 지금 푸시를 받을 수 있는 회원(085). 없는 서버에서도 회원 목록은 떠야 하니 실패는 빈 표로 둔다. */
async function loadReach() {
  try {
    const rows = await rpc("admin_push_reachable") || [];
    REACH = Object.fromEntries(rows.map((r) => [r.user_id, r]));
  } catch { REACH = null; }
}

/** 067이 없는 서버에서도 페이지는 떠야 한다 — 관리자 페이지가 서버보다 먼저 배포될 수 있다. */
async function loadPush() {
  try { PUSHES = await rpc("admin_push_list", { p_limit: 50 }) || []; }
  catch (e) { PUSHES = []; return e; }
  // 집계는 없어도 목록은 떠야 한다(089 이전 서버).
  [PUSH_DAILY, PUSH_HOURS] = await Promise.all([
    rpc("admin_push_daily", { p_days: PUSH_DAYS }).catch(() => []),
    rpc("admin_push_open_hours", { p_days: PUSH_DAYS, p_message_id: PUSH_HOUR_MSG }).catch(() => []),
  ]);
  PUSH_DAILY = PUSH_DAILY || []; PUSH_HOURS = PUSH_HOURS || [];
  return null;
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");

/** 일자별 발송·성공·실패·열림. 아무 일도 없던 날은 뺀다. */
function pushDailyTable() {
  const rows = PUSH_DAILY.filter((d) => d.messages || d.sent || d.failed || d.opens);
  const sum = rows.reduce((a, d) => ({ messages: a.messages + d.messages, sent: a.sent + d.sent,
                                       failed: a.failed + d.failed, opens: a.opens + d.opens }),
                          { messages: 0, sent: 0, failed: 0, opens: 0 });
  const line = (label, d, strong) => `<tr${strong ? ' style="font-weight:700"' : ""}>
      <td>${label}</td><td class="num">${fmt(d.messages)}</td><td class="num">${fmt(d.sent)}</td>
      <td class="num">${d.failed ? `<span class="pill heart">${fmt(d.failed)}</span>` : "0"}</td>
      <td class="num">${pct(d.sent, d.sent + d.failed)}</td>
      <td class="num">${fmt(d.opens)}</td><td class="num">${pct(d.opens, d.sent)}</td></tr>`;
  // 줄이 다 0이면 줄을, 칸이 다 0이면 칸을 숨긴다(pruneZeros).
  return `<div class="table-scroll"><table data-z="rows cols">
    <thead><tr><th>날짜</th><th class="num">보낸 푸시</th><th class="num">닿은 기기</th>
      <th class="num">못 닿은 기기</th><th class="num">닿은 비율</th>
      <th class="num">눌러서 연 수</th><th class="num">연 비율</th></tr></thead>
    <tbody>${line(`최근 ${PUSH_DAYS}일 합계`, sum, true)}${rows.map((d) => line(esc(d.day), d)).join("") ||
      '<tr><td colspan="7" class="muted">이 기간에 보낸 푸시도, 눌러서 연 기록도 없습니다</td></tr>'}</tbody></table></div>
    <div class="muted" style="font-size:12px">연 비율은 그날 알림을 눌러서 연 수 ÷ 그날 알림이 닿은 기기 수입니다. 전날 보낸 알림을 오늘 열면 오늘에 셉니다.
      보낸 것도 연 것도 없는 날은 뺐습니다.</div>`;
}

/** 시간대(0~23시) 합계 막대와 날짜 × 시간 표. 칸의 진하기가 열린 수다. */
function pushHoursView() {
  const byHour = Array(24).fill(0);
  const days = new Map();
  for (const r of PUSH_HOURS) {
    byHour[r.hour] += r.opens;
    if (!days.has(r.day)) days.set(r.day, Array(24).fill(null));
    days.get(r.day)[r.hour] = r;
  }
  const max = Math.max(1, ...byHour);
  const cellMax = Math.max(1, ...PUSH_HOURS.map((r) => r.opens));
  const sent = PUSHES.filter((m) => m.sent_at);
  // 보기 글이 길어(시각 · 제목 · 열림) 폰에서는 상자가 화면 밖으로 450px까지 나갔다. 폭을 화면에 묶는다.
  const pick = `<select id="pushHourMsg" style="max-width:100%">
      <option value="">모든 푸시 합계</option>
      ${sent.map((m) => `<option value="${m.id}" ${String(PUSH_HOUR_MSG) === String(m.id) ? "selected" : ""}>${
        esc(fmtDateTime(m.sent_at))} · ${esc(m.title)} · 연 수 ${fmt(m.opens || 0)}</option>`).join("")}
    </select>`;
  const bars = `<div style="display:grid;grid-template-columns:repeat(24,1fr);gap:3px;align-items:end;height:90px;margin-top:10px">
      ${byHour.map((n, h) => `<div title="${h}시 · ${fmt(n)}회" style="height:${Math.max(2, Math.round((n / max) * 80))}px;
        background:var(--accent);opacity:${n ? 1 : 0.15};border-radius:3px 3px 0 0"></div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:3px;font-size:10px;text-align:center" class="muted">
      ${byHour.map((_, h) => `<div>${h}</div>`).join("")}</div>`;
  const heat = days.size ? `<div class="table-scroll" style="margin-top:12px"><table style="font-size:11px">
      <thead><tr><th>날짜</th>${byHour.map((_, h) => `<th class="c" style="padding:4px 2px">${h}</th>`).join("")}<th class="num">합계</th></tr></thead>
      <tbody>${[...days].map(([day, cells]) => `<tr><td style="white-space:nowrap">${esc(day)}</td>${cells.map((c, h) => c
          ? `<td title="${h}시 · iOS ${c.ios} · AOS ${c.android}" class="c" style="padding:4px 2px;
              background:color-mix(in srgb, var(--accent) ${Math.round((c.opens / cellMax) * 85) + 15}%, transparent);color:#fff">${c.opens}</td>`
          : '<td class="c" style="padding:4px 2px"></td>').join("")}<td class="num">${fmt(cells.reduce((a, c) => a + (c ? c.opens : 0), 0))}</td></tr>`).join("")}
      </tbody></table></div>` : '<div class="muted" style="margin-top:8px">이 기간에 알림을 눌러서 연 기록이 없습니다</div>';
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${pick}
      <span class="muted" style="font-size:12px">알림을 눌러서 연 때를 한국시간 기준으로 셉니다. 막대는 몇 시에 많이 열었는지 합계이고, 표의 칸에 마우스를 올리면 iOS와 AOS 수가 보입니다.</span></div>
    ${bars}${heat}`;
}

// ------------------------------------------------------------------ 차트
// 라이브러리를 쓰지 않는다. 필요한 건 시계열 두어 개와 막대 하나뿐이고,
// 외부 스크립트를 붙이면 그쪽이 죽는 날 관리자 페이지가 통째로 안 열린다.

/**
 * 여러 계열을 겹쳐 그리는 선 그래프. series = [{name, color, values:[n]}]
 *
 * 선만 SVG로 그리고 눈금 글자와 점은 HTML로 올린다. SVG를 preserveAspectRatio="none"으로
 * 늘려 폭을 채우는데, 그 안에 글자를 두면 글자도 같이 늘어나 날짜가 안 읽혔다.
 * 자리는 전부 백분율로 잡아서 SVG가 얼마나 늘어나든 HTML과 어긋나지 않는다.
 * 포인터를 올렸을 때 쓸 값은 data-lc에 JSON으로 실어 둔다. 짚는 코드는 아래 lcShow다.
 */
function lineChart(labels, series, height = 160) {
  // 보는 기간 내내 0인 선은 그리지 않는다(사용자 요청, 2026-10-08). 남는 선이 없으면 한 줄로 알린다.
  series = series.filter((s) => s.values.some((v) => Number(v) !== 0 && v != null));
  if (!series.length || !labels.length) return EMPTY_LINE;
  const W = 720, H = height, PAD = { t: 10, b: 6 };
  const ih = H - PAD.t - PAD.b;
  const n = labels.length;
  // 가운데 눈금이 반올림으로 틀리지 않게, 정수만 있는 계열은 꼭대기를 짝수로 올린다.
  // 값이 다 0이면 눈금이 0, 1, 1로 적혀 있었다. 이제 0, 1, 2다.
  const top = Math.max(0, ...series.flatMap((s) => s.values));
  const ints = series.every((s) => s.values.every((v) => Number.isInteger(v)));
  const max = ints ? Math.max(2, top + (top % 2)) : Math.max(1, top);
  const x = (i) => (n < 2 ? W / 2 : (i * W) / (n - 1));
  const y = (v) => PAD.t + ih - (v / max) * ih;
  // HTML로 올리는 것들의 자리. SVG 좌표를 백분율로 옮긴 값이다.
  const px = (i) => +((x(i) / W) * 100).toFixed(2);
  const py = (v) => +((y(v) / H) * 100).toFixed(2);

  const yTicks = [0, 0.5, 1].map((f) => ({ top: py(max * f), text: fmt(Math.round(max * f * 100) / 100) }));
  const grid = yTicks.map((t) => `<i class="lc-gl" style="top:${t.top}%"></i>`).join("");
  // 눈금 글자는 절대 위치라 칸 폭을 못 정한다. 가장 긴 글자를 안 보이게 깔아 폭을 잡는다.
  const widest = yTicks.reduce((a, t) => (t.text.length > a.length ? t.text : a), "");
  const yAxis = `<b>${esc(widest)}</b>` + yTicks.map((t) =>
    `<span style="top:${t.top}%">${esc(t.text)}</span>`).join("");

  // 늘어난 비율대로 선이 굵어지거나 가늘어지지 않게 non-scaling-stroke를 건다.
  const paths = series.map((s) => {
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"
                  vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join("");
  // 마지막 날의 점. SVG circle은 같이 늘어나 타원이 되므로 HTML로 올린다.
  const ends = series.map((s) => {
    const last = s.values.length - 1;
    return last < 0 ? "" : `<i class="lc-end" style="left:${px(last)}%;top:${py(s.values[last] || 0)}%;background:${s.color}"></i>`;
  }).join("");

  // 좁은 화면에서는 lc-minor를 숨겨 하나 걸러 적는다. 처음과 끝은 남기고, 끝과 붙는 바로 앞 눈금도 숨긴다.
  const tickAt = lcTicks(n), lastJ = tickAt.length - 1;
  const ticks = tickAt.map((i, j) => {
    const minor = (j % 2 === 1 && j !== lastJ) || (lastJ % 2 === 1 && j === lastJ - 1);
    return `<span class="lc-tick${minor ? " lc-minor" : ""}" style="left:${px(i)}%">${esc(lcShortDate(labels[i]))}</span>`;
  }).join("");

  const legend = series.map((s) =>
    `<span class="lg"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("");

  // 포인터를 올렸을 때 짚는 점과 말풍선 줄. 자리와 값은 lcShow가 채운다.
  const marks = series.map((s) => `<i class="lc-pt" style="background:${s.color}"></i>`).join("");
  const rows = series.map((s) =>
    `<div class="lc-row"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><b></b></div>`).join("");
  const data = {
    labels: labels.map(String),
    xs: labels.map((_, i) => px(i)),
    series: series.map((s) => ({ values: s.values, ys: s.values.map((v) => py(v || 0)) })),
  };

  return `<div class="chart lc" data-lc="${esc(JSON.stringify(data))}">
    <div class="lc-body">
      <div class="lc-y">${yAxis}</div>
      <div class="lc-plot">${grid}
        <div class="lc-area">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${paths}</svg>
          ${ends}<i class="lc-guide"></i>${marks}
        </div>
      </div>
      <div class="lc-x"><div class="lc-xin">${ticks}<span class="lc-chip"></span></div></div>
    </div>
    <div class="legend">${legend}</div>
    <div class="lc-tip"><div class="lc-date"></div>${rows}</div>
  </div>`;
}

/** 아래 축에 날짜를 적을 자리. 처음과 끝은 늘 넣고, 그 사이는 같은 간격으로 7개를 넘지 않게 고른다.
 *  점이 7개 이하면 다 적는다. 30일이면 5일 간격으로 7개, 14일이면 3일 간격으로 5개다.
 *  간격이 딱 안 떨어지면 끝 칸만 짧아지고, 끝 날짜와 붙을 만큼 짧으면 그 앞 눈금을 뺀다.
 *  반올림으로 고르게 나누면 14일에서 3, 2, 3, 2칸으로 들쭉날쭉해 보여서 이렇게 했다. */
function lcTicks(n) {
  if (n <= 7) return [...Array(n).keys()];
  const step = Math.ceil((n - 1) / 6);
  const out = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  if (n - 1 - out[out.length - 1] < step * 0.6) out.pop();
  out.push(n - 1);
  return out;
}

const LC_WEEK = "일월화수목금토";

/** 축과 칩에 적는 짧은 날짜. 2026-10-07과 10-07은 10/07로 적고, 날짜가 아니면 그대로 둔다. */
function lcShortDate(s) {
  const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(s));
  return m ? `${m[1]}/${m[2]}` : String(s);
}

/** 말풍선에 적는 날짜. 2026-10-07이면 「10월 7일 (수)」.
 *  요일은 문자열의 연월일만으로 센다. 브라우저 시간대로 Date를 만들면 해외에서 하루 밀린다.
 *  순위 차트처럼 연도 없이 월-일만 오면 요일을 셀 수 없어 날짜만 적는다. */
function lcLongDate(s) {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (full) {
    const w = new Date(Date.UTC(+full[1], +full[2] - 1, +full[3])).getUTCDay();
    return `${+full[2]}월 ${+full[3]}일 (${LC_WEEK[w]})`;
  }
  const md = /^(\d{2})-(\d{2})$/.exec(String(s));
  return md ? `${+md[1]}월 ${+md[2]}일` : String(s);
}

// 선 그래프 위에서 포인터가 움직이면 가장 가까운 날을 짚는다.
// 화면을 innerHTML로 통째로 다시 그리므로 그래프마다 달면 그릴 때마다 다시 달아야 한다.
// 그래서 문서에 한 번만 달고, 값은 그래프 요소의 data-lc에서 읽는다.
const LC_DATA = new WeakMap();
/** 지금 짚고 있는 그래프. 없으면 null. */
let LC_ON = null;

function lcShow(chart, clientX) {
  let d = LC_DATA.get(chart);
  if (!d) {
    try { d = JSON.parse(chart.dataset.lc); } catch { return; }
    LC_DATA.set(chart, d);
  }
  const n = d.labels.length;
  if (!n) return;
  if (LC_ON !== chart) lcHide();
  const ar = chart.querySelector(".lc-area").getBoundingClientRect();
  const i = n < 2 ? 0
    : Math.min(n - 1, Math.max(0, Math.round(((clientX - ar.left) / ar.width) * (n - 1))));
  LC_ON = chart;
  chart.classList.add("on");

  const left = d.xs[i] + "%";
  chart.querySelector(".lc-guide").style.left = left;
  chart.querySelectorAll(".lc-pt").forEach((p, k) => {
    const top = d.series[k].ys[i];
    p.style.left = left;
    p.style.top = top + "%";
    p.style.visibility = top == null ? "hidden" : "";
  });
  chart.querySelector(".lc-date").textContent = lcLongDate(d.labels[i]);
  chart.querySelectorAll(".lc-row b").forEach((b, k) => { b.textContent = fmt(d.series[k].values[i]); });

  // 아래 축의 날짜 칩. 안내선과 같은 left를 써서 바로 밑에 온다. 칩에 가리는 눈금 글자는 잠깐 숨긴다.
  const chip = chart.querySelector(".lc-chip");
  chip.textContent = lcShortDate(d.labels[i]);
  chip.style.left = left;
  const cr = chip.getBoundingClientRect();
  chart.querySelectorAll(".lc-tick").forEach((t) => {
    const tr = t.getBoundingClientRect();
    t.classList.toggle("lc-hide", tr.right + 4 > cr.left && tr.left - 4 < cr.right);
  });

  // 말풍선은 안내선 오른쪽에 둔다. 오른쪽 끝에서 넘치면 왼쪽으로 넘기고, 어느 쪽이든 그래프 칸 안에 가둔다.
  const tip = chart.querySelector(".lc-tip");
  const cb = chart.getBoundingClientRect();
  const gx = ar.left - cb.left - chart.clientLeft + (d.xs[i] / 100) * ar.width;
  const tw = tip.offsetWidth, room = chart.clientWidth, GAP = 12, EDGE = 6;
  let tl = gx + GAP;
  if (tl + tw > room - EDGE) tl = gx - GAP - tw;
  tip.style.left = Math.max(EDGE, Math.min(tl, room - tw - EDGE)) + "px";
  tip.style.top = (ar.top - cb.top - chart.clientTop + 4) + "px";
}

function lcHide() {
  if (!LC_ON) return;
  LC_ON.classList.remove("on");
  LC_ON.querySelectorAll(".lc-hide").forEach((t) => t.classList.remove("lc-hide"));
  LC_ON = null;
}

const lcPlotOf = (e) => e.target.closest?.(".lc-plot");
document.addEventListener("pointermove", (e) => {
  const plot = lcPlotOf(e);
  if (plot) lcShow(plot.closest(".lc"), e.clientX);
  else if (e.pointerType !== "touch") lcHide();
});
// 손가락은 누르는 순간 짚는다. 떼어도 그대로 두고, 그래프 밖을 누르면 닫는다.
document.addEventListener("pointerdown", (e) => {
  const plot = lcPlotOf(e);
  if (plot) lcShow(plot.closest(".lc"), e.clientX);
  else lcHide();
});
// 마우스가 그림 밖으로 나가면 닫는다. pointerleave는 위로 전달되지 않아서 pointerout으로 받는다.
document.addEventListener("pointerout", (e) => {
  if (!LC_ON || e.pointerType === "touch") return;
  if (!LC_ON.querySelector(".lc-plot").contains(e.relatedTarget)) lcHide();
});
// 그래프 위에서 시작한 손가락이 스크롤로 바뀌면 짚기를 그만둔다.
document.addEventListener("pointercancel", lcHide);

/** 가로 막대 — 구간별 인원처럼 항목이 몇 개 안 될 때. */
function barChart(rows) {
  // 0인 막대는 숨긴다(사용자 요청, 2026-10-08). 다 0이면 한 줄로 알린다.
  rows = rows.filter((r) => Number(r.players) !== 0);
  if (!rows.length) return EMPTY_LINE;
  const max = Math.max(1, ...rows.map((r) => r.players));
  // filter가 있는 줄은 누르면 그 회원들을 회원 목록에서 본다(098). 조건 값은 서버가 준 것을 그대로 싣는다.
  const pick = (r) => r.filter ? ` clickable" data-chartfilter="${esc(JSON.stringify(r.filter))}"`
    + ` data-chartlabel="${esc(r.filterLabel || r.bucket)}" data-chartsort="${esc(r.sort || "")}"`
    + ` title="누르면 이 회원들을 회원 목록에서 봅니다` : "";
  return `<div class="bars">${rows.map((r) => `
    <div class="bar-row${pick(r)}">
      <span class="bar-label">${esc(r.bucket)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(r.players / max) * 100}%"></span></span>
      <span class="bar-value">${fmt(r.players)}</span>
    </div>`).join("")}</div>`;
}

/**
 * 한눈 지표(KPI).
 *
 * 그래프는 "어떻게 움직였나"를 보여 주지만 "지금 좋은가 나쁜가"에는 바로 답하지 않는다.
 * 맨 위에 숫자 몇 개를 놓고 **어제·지난주와 견준 화살표**를 붙인다 — 화살표가 없으면
 * 숫자를 보고도 매번 아래 그래프를 눈으로 훑어야 한다.
 *
 * 새 조회를 만들지 않았다. 전부 이미 받아 둔 STATS·RETENTION·ECON에서 나온다.
 */
function kpiRow() {
  if (!STATS.length) return "";
  const num = (r, k) => Number(r?.[k] ?? 0);
  const last = STATS[STATS.length - 1];
  const prev = STATS[STATS.length - 2];
  // 최근 7일 평균과 그 이전 7일 평균. 하루치는 요일을 타서 혼자서는 못 믿는다.
  // 그 이전 7일이 없으면(서버를 연 지 7일이 안 됨) null로 두어 화살표를 안 붙인다.
  const avg = (arr, k) => (arr.length
    ? Math.round(arr.reduce((a, r) => a + num(r, k), 0) / arr.length) : null);
  const w1 = STATS.slice(-7), w0 = STATS.slice(-14, -7);
  // 어제 줄이 없으면 견줄 것이 없다. 0으로 채우면 첫날 숫자가 통째로 「+」로 붙었다.
  const was = (k) => (prev ? num(prev, k) : null);
  const net = (r) => num(r, "coin_earned") - num(r, "coin_spent");

  // D1 리텐션은 **어제 가입한 사람은 아직 하루가 안 지났다.** 그래서 다음 날이 한국시간으로
  // 다 지난 가입일 중 가장 최근 것을 본다. 안 그러면 늘 0%에 가깝게 나온다.
  // admin_retention은 최신 날짜부터 주므로(006) 줄 순서가 아니라 날짜로 고른다.
  const rtRow = RETENTION
    .filter((r) => Number(r.cohort) > 0 && retentionDayDone(r.cohort_date, 1))
    .reduce((a, r) => (!a || String(r.cohort_date) > String(a.cohort_date) ? r : a), null);
  const d1 = rtRow ? Math.round((Number(rtRow.d1) / Number(rtRow.cohort)) * 100) : null;
  const ratio = sinkRatio();

  const cards = [
    ["오늘 앱을 켠 사람", fmt(num(last, "active")), delta(num(last, "active"), was("active"))],
    ["오늘 새로 가입", fmt(num(last, "signups")), delta(num(last, "signups"), was("signups"))],
    ["최근 7일 하루 평균 앱을 켠 사람", fmt(avg(w1, "active")), delta(avg(w1, "active"), avg(w0, "active"))],
    ["다음 날 다시 온 비율", d1 == null ? "—" : d1 + "%", ""],
    ["오늘 늘어난 코인 · 번 것 − 쓴 것", fmt(net(last)), delta(net(last), prev ? net(prev) : null)],
    ["쓴 코인 ÷ 번 코인 · 30일", ratio == null ? "—" : String(ratio), ""],
  ];
  return `<div class="cards">${cards.map(([label, value, d]) => `
    <div class="card"><div class="label">${label}${infoTip(KPI_TIPS[label])}</div>
      <div class="value">${value} ${d}</div></div>`).join("")}</div>`;
}

/** 어제(또는 지난주) 대비. 0에서 늘어난 건 비율로 말할 수 없어 숫자만 적는다.
 *  before가 null이면 견줄 날이 없는 것이라 아무것도 안 붙인다. */
function delta(now, before) {
  if (before == null) return "";
  if (before === 0) return now === 0 ? "" : `<span class="dl">+${fmt(now)}</span>`;
  const diff = now - before;
  if (diff === 0) return "";
  const pct = Math.round((diff / Math.abs(before)) * 100);
  // 방향은 화살표가 말한다. 색까지 쓰지 않는 이유는 CSS 주석에 적어 뒀다.
  return `<span class="dl">${diff > 0 ? "▲" : "▼"}${Math.abs(pct)}%</span>`;
}

/** 「오늘 앱을 켠 사람」과 「오늘 판을 깬 사람」은 이름이 비슷해 헷갈렸다(2026-10-08). 두 카드가 같은 설명을 나눠 쓴다. */
const TIP_APP_OPEN = "한국시간 오늘 앱을 한 번이라도 켠 사람 수입니다. 판을 하나도 안 깼어도 셉니다. 맨 위 「오늘 판을 깬 사람」은 오늘 판을 하나 이상 깨서 오늘 점수가 생긴 사람만 셉니다. 두 숫자는 기록하는 곳이 달라 정확히 포개지지 않습니다.";
const TIP_BOARD_CLEAR = "한국시간 오늘 판을 하나 이상 깨서 오늘 점수가 0보다 큰 사람 수입니다. 앱만 켜고 판을 안 깬 사람은 세지 않습니다. 앱을 켠 사람 수는 차트 메뉴 맨 위 「오늘 앱을 켠 사람」에 있습니다.";

// 차트 맨 위 카드의 설명 배지. 카드 이름으로 찾는다.
const KPI_TIPS = {
  "오늘 앱을 켠 사람": TIP_APP_OPEN,
  "다음 날 다시 온 비율": "가입한 다음 날에도 앱을 켠 사람의 비율입니다. 다음 날이 다 지난 가입일 중 가장 최근 날로 셉니다.",
  "오늘 늘어난 코인 · 번 것 − 쓴 것": "오늘 회원들이 번 코인에서 쓴 코인을 뺀 값입니다. 플러스면 코인이 쌓이고, 마이너스면 줄고 있습니다.",
  "쓴 코인 ÷ 번 코인 · 30일": "1에 가까울수록 번 만큼 씁니다. 0.5면 번 코인의 절반만 쓰고 나머지는 쌓인다는 뜻입니다.",
  "최근 7일 하루 평균 앱을 켠 사람": "최근 7일 동안 하루에 앱을 켠 사람 수의 평균입니다. 화살표는 그 전 7일과 견준 것입니다.",
};

/** 소모/발행이 이 값 아래면 경고한다. 문구도 이 값을 읽는다. */
const SINK_WARN = 0.35;

/**
 * 소모/발행 비율. 발행이 0이면 null이다.
 * 서버는 0으로 나누지 않으려고 분모를 1로 바꿔 계산한다(029). 그래서 발행이 0인 서버에서는
 * 비율 자리에 소모 합이 그대로 들어와 뜻이 없다.
 */
function sinkRatio() {
  if (!ECON || !(Number(ECON.earned) > 0)) return null;
  return Number(ECON.sink_ratio);
}

/** 소모/발행 경고를 띄울지. 비율이 0이면 띄우지 않는다(사용자 지시).
 *  소모가 하나도 없으면 상점을 안 쓴 게 아니라 소모 기록이 아직 안 쌓인 경우였다(개발 서버·새 서버). */
function sinkLow() {
  const r = sinkRatio();
  return r != null && r > 0 && r < SINK_WARN;
}

function chartsTab(err) {
  if (err) return loadFail("차트 숫자를 불러오지 못했습니다.", err, "supabase_admin_v2.sql");
  if (!STATS.length) return `<div class="empty">아직 모은 숫자가 없습니다</div>`;
  const days = STATS.map((r) => r.day);
  // 여섯 덩어리가 평평하게 나열돼 있었다. **묻는 질문이 다른 것끼리** 갈라 놓으면
  // 무엇을 보러 왔는지에 따라 눈이 바로 그 자리로 간다.
  //   사람 — 몇 명이 들어오고 남는가
  //   경제 — 코인이 도는가, 쌓이기만 하는가
  //   진행 — 어디까지 가고 어디서 그만두는가
  // 모든 창은 **30일로 맞췄다**(경제 건강 카드만 14일이었다).
  // 덩어리 셋을 접는 칸으로 둔다(2026-10-08). 「사람」만 처음에 펴 둔다.
  return `
    ${kpiRow()}
    ${sec("charts.people", "사람", `
    <h3 class="sub">새로 가입한 사람 · 앱을 켠 사람 · 최근 30일</h3>
    ${lineChart(days, [
      { name: "새로 가입", color: "#17b3a8", values: STATS.map((r) => Number(r.signups)) },
      { name: "앱을 켠 사람", color: "#7aa2f7", values: STATS.map((r) => Number(r.active)) },
    ])}
    <h3 class="sub">다시 온 사람 · 가입한 날 기준</h3>
    ${retentionTable()}`, { open: true })}

    ${sec("charts.economy", "경제", `
    ${ECON ? `
    <div class="cards">
      <div class="card" data-z><div class="label">번 코인 · 30일</div><div class="value">${fmt(ECON.earned)}</div></div>
      <div class="card" data-z><div class="label">쓴 코인 · 30일</div><div class="value">${fmt(ECON.spent)}</div></div>
      <div class="card"><div class="label">쓴 코인 ÷ 번 코인${infoTip(KPI_TIPS["쓴 코인 ÷ 번 코인 · 30일"])}</div>
        <div class="value" style="${sinkLow() ? "color:var(--danger)" : ""}">${sinkRatio() ?? "—"}</div></div>
    </div>
    ${sinkLow() ? `<div class="notice">쓴 코인이 번 코인의 ${SINK_WARN}배보다 적습니다. 예를 들어 100코인을 벌면 ${Math.round(SINK_WARN * 100)}코인도 안 쓰고 있다는 뜻입니다.
      코인이 쌓이기만 하고 있으니 상점 가격이나 판마다 주는 코인을 살펴볼 때입니다.</div>` : ""}
` : ""}
    <h3 class="sub">날마다 번 코인 · 쓴 코인</h3>
    ${lineChart(days, [
      { name: "번 코인", color: "#d9a441", values: STATS.map((r) => Number(r.coin_earned)) },
      { name: "쓴 코인", color: "#d95757", values: STATS.map((r) => Number(r.coin_spent)) },
    ])}
    <h3 class="sub">코인을 어디에 썼나</h3>
    ${COIN_SINKS.length
      ? barChart(COIN_SINKS.map((r) => ({
          bucket: r.sink, players: Number(r.spent),
          filter: r.sink_key ? { sink: r.sink_key, days: SINK_DAYS } : null,
          filterLabel: `최근 ${SINK_DAYS}일 「${r.sink}」에 코인을 쓴 회원`,
        })))
      : `<div class="empty">아직 코인을 쓴 기록이 없습니다</div>`}`)}

    ${sec("charts.progress", "진행", `
    <h3 class="sub">레벨마다 도착한 사람 · 어디서 그만두는지</h3>
    <div class="muted" style="margin-bottom:6px">그 레벨까지 온 사람 수입니다. 오늘 깬 판까지 셉니다.</div>
    ${FUNNEL.length
      // 선 그래프는 아래 눈금을 날짜로 보고 앞 다섯 글자를 잘라서, 레벨 숫자가 하나도 안 보였다. 막대로 바꿨다.
      ? barChart(FUNNEL.map((r) => ({
          bucket: `레벨 ${fmt(r.level)}`, players: Number(r.players),
          filter: { level_min: Number(r.level) }, filterLabel: `레벨 ${fmt(r.level)}까지 온 회원`, sort: "level",
        })))
      : `<div class="empty">레벨 클리어 기록이 아직 없습니다</div>`}
    <h3 class="sub">누적 점수가 어느 구간에 몰려 있나</h3>
    ${BUCKETS.length ? barChart(scoreRows(BUCKETS, "total", "누적 점수"))
                     : `<div class="empty">아직 없습니다</div>`}
    <h3 class="sub">오늘 점수가 어느 구간에 몰려 있나 · 한국시간 오늘</h3>
    <div class="muted" style="margin-bottom:6px">오늘 점수를 낸 사람만 셉니다. 0점인 날은 기록이 없습니다.</div>
    ${DAILY_BUCKETS.some((r) => Number(r.players) > 0) ? barChart(scoreRows(DAILY_BUCKETS, "daily", "오늘 점수"))
                           : `<div class="empty">오늘 점수를 낸 회원이 아직 없습니다</div>`}`)}`;
}

/** 점수 분포 막대. 0명인 구간은 숨기고(사용자 요청), 누르면 그 구간 회원을 본다.
 *  구간 범위(lo·hi)는 서버가 준다(098) — 여기서 숫자를 다시 적으면 서버와 갈라진다. */
function scoreRows(rows, kind, name) {
  return rows.filter((r) => Number(r.players) > 0).map((r) => {
    const lo = Number(r.lo), hi = r.hi == null ? null : Number(r.hi);
    const range = hi == null ? `${fmt(lo)} 이상` : lo === 0 && hi === 1 ? "0점" : `${fmt(lo)} ~ ${fmt(hi - 1)}`;
    return {
      bucket: r.bucket, players: Number(r.players),
      filter: kind === "total" ? { total_lo: lo, total_hi: hi } : { daily_lo: lo, daily_hi: hi },
      filterLabel: `${name} ${range}`, sort: kind,
    };
  });
}

/** 가입일에서 n일째 되는 날이 한국시간으로 다 지났는가.
 *  안 지난 날은 재방문이 아직 다 안 세어져 0%에 가깝게 나온다. 날짜를 못 읽으면 지난 것으로 본다. */
function retentionDayDone(cohortDate, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(cohortDate));
  if (!m) return true;
  const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10);
  return day < kstToday();
}

function retentionTable() {
  if (!RETENTION.length) return `<div class="empty">아직 계산할 가입 기록이 없습니다</div>`;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + "%" : "—");
  // 그날이 아직 안 지났으면 0%로 적지 않고 비워 둔다.
  const cell = (r, k, n) => (retentionDayDone(r.cohort_date, n)
    ? `${pct(Number(r[k]), Number(r.cohort))}
        <span class="muted">(${fmt(r[k])})</span>`
    : `<span class="muted" title="${n === 1 ? "다음 날이" : `${n}일째가`} 아직 안 지났습니다">—</span>`);
  // 가입한 사람이 0인 날은 줄째 숨긴다(pruneZeros).
  return `<div class="table-scroll"><table style="min-width:460px" data-z="rows">
    <thead><tr><th>가입한 날</th><th class="num">가입한 사람</th>
      <th class="num">다음 날 다시 온 비율</th><th class="num">7일째 다시 온 비율</th></tr></thead>
    <tbody>${RETENTION.map((r) => `<tr>
      <td class="muted">${fmtDate(r.cohort_date)}</td>
      <td class="num">${fmt(r.cohort)}</td>
      <td class="num">${cell(r, "d1", 1)}</td>
      <td class="num">${cell(r, "d7", 7)}</td>
    </tr>`).join("")}</tbody></table></div>
    <p class="muted" style="font-size:12px">가입한 사람이 적은 날은 비율이 크게 튑니다. 인원수를 같이 보세요.
      그날이 아직 안 지난 칸은 「—」로 비워 둡니다.</p>`;
}

/** 통화를 섞어 더하면 안 된다 — 통화별로 나눠서 보여준다. */
const money = (v, cur) => `${fmt(Math.round(Number(v) || 0))} ${esc(cur || "")}`.trim();

function purchasesTab(err) {
  if (err) return loadFail("구매 기록을 불러오지 못했습니다.", err, "supabase_purchases.sql");
  if (!PAY_LEDGER.length) {
    return `<div class="empty">아직 기록된 구매가 없습니다.<br>
      결제 기록은 서버에 남기기 시작한 앱부터 쌓입니다. 그 전 결제는 여기에 나오지 않습니다.</div>`;
  }

  // 통화가 여럿이면 통화마다 선을 하나씩 그린다.
  const currencies = [...new Set(PAY_DAILY.map((r) => r.currency))];
  const days = [...new Set(PAY_DAILY.map((r) => r.day))].sort();
  const colors = ["#17b3a8", "#d9a441", "#7aa2f7", "#d95757"];
  const series = currencies.map((cur, i) => ({
    name: cur, color: colors[i % colors.length],
    values: days.map((d) => Number(PAY_DAILY.find((r) => r.day === d && r.currency === cur)?.revenue || 0)),
  }));

  const totals = currencies.map((cur) => {
    const rows = PAY_DAILY.filter((r) => r.currency === cur);
    return { cur, revenue: rows.reduce((a, r) => a + Number(r.revenue), 0),
             orders: rows.reduce((a, r) => a + Number(r.orders), 0) };
  });

  return `
    <div class="cards">
      ${totals.map((t) => `<div class="card">
        <div class="label">최근 30일 매출 · ${esc(t.cur)}</div>
        <div class="value">${fmt(Math.round(t.revenue))}</div></div>`).join("")}
      <div class="card"><div class="label">결제 건수</div>
        <div class="value">${fmt(PAY_LEDGER.length)}</div></div>
      <div class="card"><div class="label">결제한 회원</div>
        <div class="value">${fmt(new Set(PAY_LEDGER.map((r) => r.profile_id)).size)}</div></div>
    </div>

    <h2>날마다 매출 · 최근 30일</h2>
    ${days.length ? lineChart(days, series) : `<div class="empty">아직 없습니다</div>`}

    <h2>달마다 매출</h2>
    <div class="table-scroll"><table style="min-width:420px">
      <thead><tr><th>월</th><th>통화</th><th class="num">매출</th>
        <th class="num">건수</th><th class="num">인원</th></tr></thead>
      <tbody>${PAY_MONTHLY.map((r) => `<tr>
        <td>${esc(r.month)}</td><td class="muted">${esc(r.currency)}</td>
        <td class="num">${fmt(Math.round(r.revenue))}</td>
        <td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.buyers)}</td>
      </tr>`).join("")}</tbody></table></div>

    <h2>상품마다</h2>
    <div class="table-scroll"><table style="min-width:520px">
      <thead><tr><th>상품</th><th>종류</th><th>통화</th><th class="num">매출</th>
        <th class="num">건수</th><th class="num">인원</th></tr></thead>
      <tbody>${PAY_PRODUCT.map((r) => `<tr>
        <td>${productName(r.product_id)}</td><td class="muted">${esc(PRODUCT_KINDS[r.kind] || r.kind)}</td>
        <td class="muted">${esc(r.currency)}</td>
        <td class="num">${fmt(Math.round(r.revenue))}</td>
        <td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.buyers)}</td>
      </tr>`).join("")}</tbody></table></div>

    <h2>결제 하나하나 · 최근 200건</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>시각</th><th>회원</th><th>상품</th><th class="num">코인</th>
        <th class="num">금액</th><th>기기</th></tr></thead>
      <tbody>${moreRows("ledger", PAY_LEDGER.map((r) => `<tr>
        <td class="muted">${new Date(r.created_at).toLocaleString("ko-KR")}</td>
        <td>${esc(r.username || (r.profile_id || "").slice(0, 8) || "(삭제됨)")}</td>
        <td>${productName(r.product_id)}</td>
        <td class="num">${r.coins ? fmt(r.coins) : "—"}</td>
        <td class="num">${money(r.amount, r.currency)}</td>
        <td class="muted">${esc(PLATFORM_NAMES[r.store] || r.store)}</td>
      </tr>`))}</tbody></table></div>${moreBar("ledger", PAY_LEDGER.length)}`;
}

// 공지가 앱에 보이는 방식(099). 작성 창 안내와 목록 위 안내가 같은 문장을 읽는다.
const NOTICE_HOW = "모든 공지는 1.5.0 이상 앱의 우편함에 들어갑니다. 「창으로도 띄우기」를 켠 공지 중 가장 최근 것 하나는 앱을 켤 때 창으로 한 번 뜹니다. 1.4.4 이하 앱은 이 설정과 상관없이 가장 최근 공지를 창으로 띄웁니다.";

function noticesTab(err) {
  if (err) return loadFail("공지를 불러오지 못했습니다.", err, "supabase_admin_v3.sql");
  const now = Date.now();
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");
  return `<div class="toolbar">
      <span class="muted" style="font-size:12.5px">${NOTICE_HOW}</span>
      <div style="flex:1"></div>
      <button class="sm" id="newNotice">공지 쓰기</button>
    </div>
    ${!NOTICES.length ? `<div class="empty">등록된 공지가 없습니다</div>` : `
    <div class="table-scroll"><table>
      <thead><tr><th>올린 때</th><th>제목</th><th>내용</th><th>보이는 기간</th><th>앱 켤 때 창</th><th>관리</th></tr></thead>
      <tbody>${NOTICES.map((n) => {
        const expired = n.expires_at && new Date(n.expires_at).getTime() <= now;
        const notYet = n.starts_at && new Date(n.starts_at).getTime() > now;
        return `<tr>
          <td class="muted">${when(n.created_at)}</td>
          <td>${esc(n.title)}</td>
          <td class="muted long" style="max-width:360px">${esc(n.body)}</td>
          <td class="muted">${when(n.starts_at)} ~ ${when(n.expires_at)}
            ${expired ? '<span class="pill heart">기간 끝</span>' : ""}
            ${notYet ? '<span class="pill today">시작 전</span>' : ""}</td>
          <td>${n.popup === undefined ? '<span class="muted">—</span>' : `<label class="switch">
            <input type="checkbox" data-noticepopup="${n.id}" ${n.popup ? "checked" : ""}><span>${n.popup ? "창으로도 띄움" : "우편함에만"}</span></label>`}</td>
          <td><button class="danger sm" data-delnotice="${n.id}">삭제</button></td>
        </tr>`;
      }).join("")}</tbody></table></div>`}`;
}

// 관리자 창이 아닌 곳에서 만든 발송 줄의 표시(push_messages.source, 099·110). admin은 표시가 없다.
// 이 줄들은 우편함에 「받은 푸시」로 들어가지 않는다. 공지·선물·랭킹 보상 줄이 이미 있어서다.
const PUSH_SOURCES = {
  mailbox_reminder: "우편함 기한 알림",
  notice: "공지 푸시",
  gift: "선물 도착 푸시",
  rank_reward: "랭킹 보상 도착 푸시",
};

function pushTab(err) {
  if (err) return loadFail("푸시 목록을 불러오지 못했습니다.", err, "sql/migrations/067_push.sql");
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "—");
  const now = new Date();
  const target = (m) => {
    switch (m.target) {
      case "all": return "알림 켠 회원 전체";
      case "users": {
        const ids = (m.target_arg || "").split(",").filter(Boolean);
        return `직접 고른 ${fmt(ids.length)}명<br><span style="font-size:11px" title="${esc(ids.join("\n"))}">${esc(ids[0] || "")}${ids.length > 1 ? " …" : ""}</span>`;
      }
      case "filter": return `조건에 맞는 회원<br><span style="font-size:11px">${describeConds(m.target_arg)}</span>`;
      case "user": return `직접 고른 회원<br><span style="font-size:11px">${esc(m.target_arg || "")}</span>`;
      case "inactive_7d": return "7일 넘게 안 들어온 사람";
      case "top100": return "오늘 점수 상위 100명";
      default: return esc(m.target);
    }
  };
  const status = (m) => {
    if (m.sent_at) {
      // 0대이고 실패도 0이면 받을 사람이 없었거나, 발송 함수가 대상을 고르다 실패한 것이다
      // (send-push는 그 경우 이 줄을 「보냄」으로 둔 채 넘어간다). 둘을 가를 기록은 없다.
      const none = !m.sent_count && !m.fail_count && !m.error;
      return `<span class="pill today">보냄</span> 기기 ${fmt(m.sent_count)}대${
        m.fail_count ? ` <span class="pill heart">못 닿음 ${fmt(m.fail_count)}</span>` : ""}
        ${m.error ? `<div class="err" style="font-size:11px">받을 사람을 고르지 못했습니다: ${esc(plainError(m.error))}</div>` : ""}
        ${none ? '<div class="muted" style="font-size:11px">받을 사람이 없었습니다</div>' : ""}
        <div class="muted" style="font-size:11px">${when(m.sent_at)}</div>`;
    }
    const at = new Date(m.scheduled_at);
    if (at > now) return '<span class="pill">예약됨</span>';
    // 시각은 지났는데 안 나갔다 — 밤 시간이면 8시를 기다리는 중이다(084).
    return inQuiet(now) ? `<span class="pill">${QUIET_END}에 나감</span>` : '<span class="pill">곧 나감</span>';
  };
  const pending = PUSHES.filter((m) => !m.sent_at).length;
  return `<div class="toolbar">
      <span class="muted" style="font-size:12.5px">휴대폰 알림으로 나갑니다. <b>보낸 뒤에는 되돌릴 수 없습니다</b>.
        <b>앱에서 광고성 정보 알림을 켠 사람에게만</b> 갑니다. 1.4.2부터 생긴 설정이고 처음에는 꺼져 있습니다.
        한국시간 ${QUIET_TEXT}에는 보내지 않고 ${QUIET_END}에 모아서 내보냅니다.
        광고성 정보라면 제목 앞 「(광고)」와 본문 끝 수신거부 안내를 서버가 붙이고, 서비스 안내에는 붙이지 않습니다.${pending ? ` 아직 안 나간 푸시 ${fmt(pending)}건.` : ""}</span>
      <div style="flex:1"></div>
      <button class="sm" id="newPush">푸시 보내기</button>
    </div>
    <h3 style="margin:18px 0 6px">날마다 보낸 수 · 눌러서 연 수
      <select id="pushDays" style="margin-left:8px">${[7, 30, 90].map((d) =>
        `<option value="${d}" ${d === PUSH_DAYS ? "selected" : ""}>최근 ${d}일</option>`).join("")}</select></h3>
    ${pushDailyTable()}
    <h3 id="pushHours" style="margin:22px 0 6px">몇 시에 눌러서 열었나</h3>
    ${pushHoursView()}
    <h3 style="margin:22px 0 6px">보낸 푸시와 예약</h3>
    ${!PUSHES.length ? `<div class="empty">보낸 푸시가 없습니다</div>` : `
    <div class="table-scroll"><table>
      <thead><tr><th>만든 때</th><th>제목</th><th>본문</th><th>받을 사람</th><th>나갈 시각</th><th>결과</th><th class="num">눌러서 연 수</th><th>관리</th></tr></thead>
      <tbody>${moreRows("push", PUSHES.map((m) => `<tr>
          <td class="muted">${when(m.created_at)}</td>
          <td>${PUSH_SOURCES[m.source] ? `<span class="pill warn" title="서버가 저절로 보낸 푸시입니다. 우편함에 따로 들어가지 않습니다">${PUSH_SOURCES[m.source]}</span> ` : ""}${m.kind === "notice" ? '<span class="pill">서비스 안내</span> ' : ""}${esc(m.title)}</td>
          <td class="muted long" style="max-width:320px">${esc(m.body)}${
            `<div style="font-size:11px">누르면 열리는 화면: ${esc(linkLabel(m.link, m.kind))}</div>`}</td>
          <td class="muted long" style="max-width:260px">${target(m)}</td>
          <td class="muted">${when(m.scheduled_at)}</td>
          <td>${status(m)}</td>
          <td class="num" style="white-space:nowrap">${m.sent_at ? `${fmt(m.opens || 0)}회<div class="muted" style="font-size:11px">${pct(m.opens || 0, m.sent_count)}</div>
            <button class="ghost sm" data-hourpush="${m.id}" title="이 푸시를 몇 시에 눌러서 열었는지 아래 표로 봅니다">몇 시에 열었나</button>` : '<span class="muted">—</span>'}</td>
          <td style="white-space:nowrap">${m.sent_at ? "" : `<button class="sm" data-editpush="${m.id}">고치기</button>
              <button class="danger sm" data-cancelpush="${m.id}">보내지 않기</button>`}
            <button class="ghost sm" data-copypush="${m.id}" title="받을 사람과 문구를 그대로 채운 새 보내기 창을 엽니다">같은 내용으로 새로</button></td>
        </tr>`))}</tbody></table></div>${moreBar("push", PUSHES.length)}`}`;
}

// ------------------------------------------------------------------ 동작
async function act(fn, done) {
  try { await fn(); await done?.(); }
  catch (e) { alert("처리하지 못했습니다.\n\n" + plainError(e.message)); }
}

// 서버·로그인 라이브러리가 영어로 주는 흔한 오류를 한국어로 옮긴다. 모르는 것은 원문 그대로 둔다.
// 서버 함수가 직접 내는 오류는 대부분 이미 한국어라 그대로 지나간다.
const PLAIN_ERRORS = [
  [/invalid login credentials/i, "이메일이나 비밀번호가 맞지 않습니다"],
  [/email not confirmed/i, "이메일 확인이 끝나지 않은 계정입니다"],
  [/failed to fetch|networkerror|load failed/i, "서버에 닿지 못했습니다. 인터넷 연결을 확인하고 다시 해 보세요"],
  [/jwt expired|invalid jwt|refresh token/i, "로그인이 풀렸습니다. 새로고침한 뒤 다시 로그인하세요"],
  [/permission denied|not authorized|row-level security/i, "이 계정에는 권한이 없습니다"],
  [/could not find the function|function .* does not exist/i, "서버에 이 기능이 아직 없습니다. 개발 쪽 서버 업데이트가 필요합니다"],
  [/invalid totp|invalid mfa|code.*(invalid|expired)/i, "코드가 맞지 않거나 시간이 지났습니다. 앱에 새로 뜬 코드를 넣어 주세요"],
  [/^bad$/i, "서버가 넣은 값을 받아들이지 않았습니다"],
];
function plainError(msg) {
  const m = String(msg ?? "");
  const hit = PLAIN_ERRORS.find(([re]) => re.test(m));
  return hit ? `${hit[1]}. 원문: ${m}` : m;
}

/** 불러오기 실패 안내. 사장님이 읽을 말을 앞에 두고, 개발 담당에게 넘길 단서는 아래에 작게 둔다. */
function loadFail(what, err, devHint = "") {
  return `<div class="notice">${esc(what)} ${esc(plainError(err?.message ?? err))}${devHint
    ? `<div class="muted" style="font-size:12px;margin-top:4px">개발 담당에게 전할 단서: ${esc(devHint)}</div>` : ""}</div>`;
}

const findPlayer = (id) => PLAYERS.find((p) => p.id === id);

async function editScores(id) {
  const p = findPlayer(id);
  const daily = window.prompt(`오늘 점수 (현재 ${p.daily_score ?? 0})`, p.daily_score ?? 0);
  if (daily === null) return;
  const total = window.prompt(`누적 점수 (현재 ${p.total_score ?? 0})`, p.total_score ?? 0);
  if (total === null) return;
  const reason = askReason(`${p.username}의 점수를 바꿉니다`);
  if (reason === null) return;
  await act(() => rpc("admin_set_scores", {
    p_target: id, p_daily: Number(daily), p_total: Number(total), p_reason: reason,
  }), refresh);
}

async function editName(id) {
  const p = findPlayer(id);
  const name = window.prompt("새 닉네임", p.username || "");
  if (name === null || !name.trim()) return;
  const reason = askReason(`${p.username}의 닉네임을 바꿉니다`);
  if (reason === null) return;
  await act(() => rpc("admin_set_username", {
    p_target: id, p_name: name.trim(), p_reason: reason,
  }), refresh);
}

async function toggleSupporter(id) {
  const p = findPlayer(id);
  const next = !p.supporter;
  const reason = askReason(`${p.username}의 응원 배지를 ${next ? "켭니다" : "끕니다"}`);
  if (reason === null) return;
  await act(() => rpc("admin_set_supporter", {
    p_target: id, p_value: next, p_reason: reason,
  }), refresh);
}

async function resetScores(id) {
  const p = findPlayer(id);
  const reason = askReason(`${p.username}의 점수를 0으로 되돌립니다`);
  if (reason === null) return;
  await act(() => rpc("admin_set_scores", {
    p_target: id, p_daily: 0, p_total: 0, p_reason: reason,
  }), refresh);
}

async function requestGameReset(id) {
  const p = findPlayer(id);
  // 서버가 직접 지울 수 없는 값(레벨·코인·아이템)이라 "요청"만 남긴다.
  if (!confirm(`${p.username}의 게임 진행을 초기화 요청합니다.\n\n` +
    `레벨·코인·아이템은 기기 안에 있어서 서버가 직접 지울 수 없습니다.\n` +
    `표시만 남기고, 그 사람이 다음에 앱을 켤 때 앱이 스스로 초기화합니다.`)) return;
  const reason = askReason("게임 진행 초기화 요청");
  if (reason === null) return;
  await act(() => rpc("admin_request_game_reset", { p_target: id, p_reason: reason }), refresh);
}

/**
 * 전체 초기화.
 *
 * 예전에는 브라우저 prompt에 "daily"를 손으로 쳐 넣게 했다. 무엇을 칠 수 있는지
 * 안내문을 읽어야 알 수 있었고, 오타는 그냥 실패였고, **대전 전적은 아예 대상에도
 * 없었다**(사용자 지적). 고를 수 있는 것만 보여 주고 고르게 한다.
 */
const RESET_SCOPES = [
  ["daily",  "오늘 점수만"],
  ["total",  "누적 점수만"],
  ["both",   "오늘 + 누적 점수"],
  ["versus", "대전 전적만 (판·결과·요약을 모두 지웁니다)"],
  ["all",    "전부 (점수 + 대전 전적)"],
];

async function resetAllScores() {
  const menu = RESET_SCOPES.map(([k, label], i) => `${i + 1}. ${label}`).join("\n");
  const pick = window.prompt(
    "전체 회원을 초기화합니다. 번호를 고르세요.\n\n" + menu + "\n\n번호:", "1");
  if (pick === null) return;
  const chosen = RESET_SCOPES[Number(pick) - 1];
  if (!chosen) { alert("1~" + RESET_SCOPES.length + " 중 하나를 골라 주세요"); return; }
  const [scope, label] = chosen;
  // 대전 전적은 점수와 달리 **줄이 사라진다.** 그 차이를 확인창에 그대로 적는다.
  const extra = (scope === "versus" || scope === "all")
    ? "\n\n대전 판·결과·요약이 통째로 삭제됩니다. 랭킹이 비워집니다."
    : "";
  if (!confirm(`정말로 전체 회원의 "${label}"을(를) 초기화할까요?${extra}\n\n되돌릴 수 없습니다.`)) return;
  const reason = askReason("전체 점수 초기화");
  if (reason === null) return;
  await act(async () => {
    const n = await rpc("admin_reset_all_scores", { p_scope: scope, p_reason: reason });
    alert(`${n}명의 점수를 초기화했습니다`);
  }, refresh);
}

async function resetAllGames() {
  // 테스트 중 "모든 계정을 처음 상태로" 돌릴 때 쓴다. 되돌릴 수 없는 작업이라
  // 인원수를 먼저 보여주고, 정해진 문구를 직접 입력하게 해서 오조작을 막는다.
  // 전체 인원은 서버 집계로(회원 목록은 50명 한 쪽뿐이다).
  const n = SUMMARY?.members ?? PLAYERS.length;
  const typed = window.prompt(
    `전체 ${n}명의 게임 진행(레벨·코인·아이템)을 초기화합니다.\n\n` +
    `표시만 남기고, 각자 앱을 켜거나 앱으로 돌아올 때 앱이 스스로 초기화합니다.\n` +
    `이미 초기화된 사람은 되돌릴 수 없습니다.\n\n` +
    `확인을 위해 초기화 라고 입력하세요:`);
  if (typed === null) return;
  if (typed.trim() !== "초기화") { alert("입력이 달라 취소했습니다"); return; }
  const reason = askReason("전체 게임 초기화");
  if (reason === null) return;
  await act(async () => {
    const affected = await rpc("admin_request_all_game_reset", { p_reason: reason });
    alert(`${affected}명에게 초기화를 걸었습니다.\n각자 앱을 켜는 시점에 반영됩니다.`);
  }, refresh);
}

async function cancelGameResets() {
  // 잘못 눌렀을 때, 아직 앱을 켜지 않은 사람들만이라도 살리는 유일한 방법.
  // 대기 건수는 서버 집계로(회원 목록은 50명 한 쪽뿐이라 다른 쪽 사람이 안 세졌다).
  const waiting = SUMMARY?.reset_waiting ?? PLAYERS.filter((p) => p.reset_requested_at).length;
  if (waiting === 0) { alert("걸려 있는 초기화 요청이 없습니다"); return; }
  if (!confirm(`아직 반영되지 않은 초기화 요청 ${waiting}건을 취소합니다.\n\n` +
    `이미 앱을 켜서 초기화된 사람은 되돌릴 수 없습니다.`)) return;
  const reason = askReason("초기화 요청 취소");
  if (reason === null) return;
  await act(async () => {
    const affected = await rpc("admin_cancel_game_reset", { p_reason: reason });
    alert(`${affected}건을 취소했습니다`);
  }, refresh);
}

async function removePlayer(id) {
  const p = findPlayer(id);
  // 되돌릴 수 없다 — 닉네임을 직접 입력하게 해서 오조작을 막는다.
  const typed = window.prompt(
    `계정을 삭제합니다. 되돌릴 수 없습니다.\n확인을 위해 닉네임을 그대로 입력하세요:\n\n${p.username}`);
  if (typed !== p.username) {
    if (typed !== null) alert("닉네임이 일치하지 않아 취소했습니다");
    return;
  }
  const reason = askReason("계정 삭제");
  if (reason === null) return;
  await act(() => rpc("admin_delete_profile", { p_target: id, p_reason: reason }), refresh);
}

async function deleteSelected() {
  const ids = [...SELECTED];
  if (!ids.length) { alert("선택된 회원이 없습니다"); return; }
  // 되돌릴 수 없다 — 지울 명단을 눈으로 보여주고 인원수를 직접 입력하게 한다.
  const names = ids.map((id) => findPlayer(id)?.username || id.slice(0, 8));
  const shown = names.slice(0, 20).join(", ") + (names.length > 20 ? ` 외 ${names.length - 20}명` : "");
  const typed = window.prompt(
    `${ids.length}명을 삭제합니다. 되돌릴 수 없습니다.\n\n${shown}\n\n` +
    `확인을 위해 인원수를 그대로 입력하세요:`);
  if (typed === null) return;
  if (typed.trim() !== String(ids.length)) { alert("숫자가 달라 취소했습니다"); return; }
  const reason = askReason(`회원 ${ids.length}명 삭제`);
  if (reason === null) return;
  await act(async () => {
    const n = await rpc("admin_delete_profiles", { p_targets: ids, p_reason: reason });
    SELECTED.clear();
    alert(`${n}명을 삭제했습니다`);
  }, refresh);
}

/** datetime-local 칸이 먹는 모양("YYYY-MM-DDTHH:mm")으로. toISOString()을 쓰면
 *  UTC로 바뀌어 한국시간과 9시간 어긋난 값이 칸에 박힌다. */
function localDatetimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
       + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 이벤트 기간을 정한다. 둘 다 비우면 상시다(기본 14종이 그렇다).
 *
 * 보상 지급과 같은 대화상자 틀을 쓴다 — 관리자가 이미 아는 모양이라 새로 배울 게 없다.
 */
function openEventWhen(id) {
  const ev = VS_EVENTS.find((x) => x.id === id);
  if (!ev) return;
  const dlg = $("#evDlg");
  $("#evTitle").textContent = `「${EV_INFO[ev.code]?.[1] ?? ev.code}」 장난 기간`;
  const toLocal = (v) => {
    if (!v) return "";
    const d = new Date(v);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
         + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  $("#evStart").value = toLocal(ev.starts_at);
  $("#evEnd").value = toLocal(ev.ends_at);
  $("#evErr").textContent = "";
  dlg.showModal();
  $("#evCancel").onclick = () => dlg.close();
  $("#evOk").onclick = async () => {
    const at = (v) => (v ? new Date(v).toISOString() : null);
    const starts = at($("#evStart").value), ends = at($("#evEnd").value);
    if (starts && ends && ends <= starts) { $("#evErr").textContent = "끝이 시작보다 빠릅니다"; return; }
    await act(async () => {
      const { error } = await sb.from("versus_events")
        .update({ starts_at: starts, ends_at: ends }).eq("id", id);
      if (error) throw error;
      dlg.close();
    }, refresh);
  };
}

// 1.5.0부터 선물은 우편함에 들어가 직접 받는다. 그 전 앱은 접속할 때 저절로 받는다(099).
const GRANT_HOW = "1.5.0 이상 앱은 우편함에서 눌러서 받고, 그 전 앱은 앱을 켤 때 저절로 받습니다.";

/** id가 null이면 전체 지급. 기간을 비워 두면 제한 없이 받을 수 있다. */
function openGrant(id) {
  const p = id ? findPlayer(id) : null;
  const dlg = $("#grantDlg");
  $("#grantTitle").textContent = id ? "보상 주기" : "모든 회원에게 보상 주기";
  $("#grantWho").textContent = id
    ? `${p.username} 님에게 줍니다. ${GRANT_HOW}`
    : `전체 회원 ${SUMMARY?.members ?? PLAYERS.length}명에게 줍니다. ${GRANT_HOW}`;
  $("#gErr").textContent = "";
  ["#gCoins", "#gHints", "#gAutos"].forEach((s) => ($(s).value = 0));
  $("#gMemo").value = "";
  // 받기 시작은 **오늘 지금**을 미리 넣어 둔다(사용자 지시). 비워 두면 "즉시"와 같지만,
  // 빈 칸은 "안 정했다"로도 읽혀서 매번 무엇이 기본인지 다시 생각해야 했다.
  // 마감은 비워 둔다 — 언제까지 받게 할지는 보상마다 다르고, 잘못 넣으면 못 받는다.
  $("#gStart").value = localDatetimeValue(new Date());
  $("#gEnd").value = "";
  // 110 푸시는 기본 꺼짐. 켜면 지급 뒤 admin_send_gift_push를 부른다.
  $("#gPush").checked = false;
  $("#gPushHow").textContent = `받는 사람에게 「우편함 / 선물이 도착했어요.」 알림을 각자의 앱 언어로 보냅니다. 광고가 아닌 서비스 안내로 나갑니다. `
    + `1.5.0 이상 앱을 쓴 적이 있고 광고성 정보 알림을 켠 사람에게만 닿습니다. `
    + `받기 시작을 나중으로 정했으면 그 시각에 나가고, 한국시간 ${QUIET_TEXT}에 걸리면 ${QUIET_END}에 나갑니다.`;
  const showPush = () => { $("#gPushHow").style.display = $("#gPush").checked ? "" : "none"; };
  $("#gPush").onchange = showPush;
  showPush();
  dlg.showModal();
  $("#gCancel").onclick = () => dlg.close();
  $("#gOk").onclick = async () => {
    const coins = Number($("#gCoins").value) || 0;
    const hints = Number($("#gHints").value) || 0;
    const autos = Number($("#gAutos").value) || 0;
    if (coins + hints + autos <= 0) { $("#gErr").textContent = "코인, 힌트, 자동배치 중 하나는 1 이상 넣어 주세요"; return; }
    // datetime-local은 표준시 표기가 없다 — 브라우저(=한국) 기준으로 해석해 ISO로 보낸다.
    const at = (v) => (v ? new Date(v).toISOString() : null);
    const starts = at($("#gStart").value), ends = at($("#gEnd").value);
    if (starts && ends && ends <= starts) { $("#gErr").textContent = "받기 마감이 받기 시작보다 빠릅니다"; return; }
    const withPush = $("#gPush").checked;
    try {
      if (id) {
        const giftId = await rpc("admin_grant_reward", {
          p_target: id, p_coins: coins, p_hints: hints, p_autos: autos,
          p_memo: $("#gMemo").value.trim() || null,
          p_starts_at: starts, p_expires_at: ends,
        });
        if (withPush) await sendGiftPush(giftId, null);
      } else {
        const reason = askReason("모든 회원에게 보상 주기");
        if (reason === null) return;
        const batchId = await rpc("admin_grant_reward_all", {
          p_coins: coins, p_hints: hints, p_autos: autos,
          p_memo: $("#gMemo").value.trim() || null,
          p_starts_at: starts, p_expires_at: ends, p_reason: reason,
        });
        if (withPush) await sendGiftPush(null, batchId);
      }
      dlg.close();
      refresh();
    } catch (e) { $("#gErr").textContent = e.message; }
  };
}

/** 110 지급한 선물의 도착 푸시. 지급은 이미 끝났으므로 푸시가 실패해도 창의 오류로 남기지 않고 알리기만 한다. */
async function sendGiftPush(giftId, batchId) {
  try {
    const r = await rpc("admin_send_gift_push", { p_gift_id: giftId, p_batch_id: batchId });
    alert(r?.people
      ? `「선물이 도착했어요」 푸시를 ${fmt(r.people)}명에게 보냅니다.`
      : "푸시를 받을 수 있는 사람이 없어 푸시는 나가지 않았습니다. 보상은 우편함에 들어갔습니다.");
  } catch (e) {
    alert("보상은 줬지만 푸시는 보내지 못했습니다.\n\n" + plainError(e.message));
  }
}

function openNotice() {
  const dlg = $("#noticeDlg");
  ["#nTitle", "#nBody", "#nStart", "#nEnd"].forEach((x) => ($(x).value = ""));
  $("#nPopup").checked = true;
  $("#nHow").textContent = NOTICE_HOW;
  $("#nErr").textContent = "";
  // 110 푸시는 기본 꺼짐. 종류 칸과 안내는 푸시 발송 창의 것을 그대로 옮겨 써서 두 창의 말이 갈리지 않게 한다.
  $("#nPush").checked = false;
  $("#nPushKind").innerHTML = $("#pKind").innerHTML;
  $("#nPushKind").value = "ad";
  $("#nPushKindNote").innerHTML = $("#pKindNote").innerHTML;
  $("#nPushHow").textContent = `공지 제목과 내용을 광고성 정보 알림을 켠 회원 전체에게 보냅니다. 알림을 누르면 우편함이 열립니다. `
    + `보낸 뒤에는 되돌릴 수 없습니다. 보이기 시작을 정했으면 그 시각에 나가고, 한국시간 ${QUIET_TEXT}에 걸리면 ${QUIET_END}에 나갑니다.`;
  const showPush = () => {
    $("#nPushRow").style.display = $("#nPush").checked ? "" : "none";
    $("#nPushKindNote").style.display = $("#nPushKind").value === "notice" ? "" : "none";
  };
  $("#nPush").onchange = showPush;
  $("#nPushKind").onchange = showPush;
  showPush();
  dlg.showModal();
  $("#nCancel").onclick = () => dlg.close();
  $("#nOk").onclick = async () => {
    const title = $("#nTitle").value.trim(), body = $("#nBody").value.trim();
    if (!title || !body) { $("#nErr").textContent = "제목과 내용을 모두 적어 주세요"; return; }
    const at = (v) => (v ? new Date(v).toISOString() : null);
    const withPush = $("#nPush").checked, pushKind = $("#nPushKind").value;
    if (withPush && !confirm(`공지와 함께 푸시를 보냅니다.\n${pushKindLine(pushKind)}\n누르면 열리는 화면: 우편함\n\n"${title}"\n\n보낸 뒤에는 취소할 수 없습니다. 계속할까요?`)) return;
    $("#nOk").disabled = true;   // 두 번 눌러 두 번 나가는 일을 막는다
    try {
      const noticeId = await rpc("admin_create_notice_v2", {
        p_title: title, p_body: body,
        p_starts_at: at($("#nStart").value), p_expires_at: at($("#nEnd").value),
        p_popup: $("#nPopup").checked,
      });
      if (withPush) {
        // 공지는 이미 올라갔다. 푸시가 실패해도 공지를 다시 올리지 않게 창은 닫고 알리기만 한다.
        try { await rpc("admin_send_notice_push", { p_notice_id: noticeId, p_kind: pushKind }); }
        catch (e) { alert("공지는 올렸지만 푸시는 보내지 못했습니다.\n\n" + plainError(e.message)); }
      }
      dlg.close();
      refresh();
    } catch (e) { $("#nErr").textContent = e.message; }
    finally { $("#nOk").disabled = false; }
  };
}

// ------------------------------------------------------------------ 푸시 대상 조건
// 서버 push_condition_ok(086)와 짝이다. 종류(t)와 칸 이름을 바꾸면 거기도 바꾼다.
const OPS_NUM = [["gte", "이상"], ["lte", "이하"]];
const OPS_DAYS = [["within", "일 안에"], ["over", "일 넘게 지남"]];
const COND_TYPES = {
  rank: { label: "그날 오늘 점수 순위", fields: [
    { k: "date", type: "date", def: () => kstDate(-1), pre: "" },
    { k: "from", type: "number", def: 1, pre: "" },
    { k: "to", type: "number", def: 10, pre: "~", post: "위" }] },
  score: { label: "점수", fields: [
    { k: "field", type: "select", opts: [["today", "오늘 점수"], ["total", "누적 점수"]], def: "today" },
    { k: "v", type: "number", def: 0 },
    { k: "op", type: "select", opts: OPS_NUM, def: "lte" }] },
  seen: { label: "마지막으로 앱을 켠 날", fields: [
    { k: "days", type: "number", def: 7 },
    { k: "op", type: "select", opts: OPS_DAYS, def: "over" }] },
  joined: { label: "가입한 날", fields: [
    { k: "days", type: "number", def: 7 },
    { k: "op", type: "select", opts: OPS_DAYS, def: "within" }] },
  purchased: { label: "결제한 상품", fields: [
    { k: "item", type: "select", def: "any", opts: [["any", "아무 상품"], ["remove_ads", "광고 제거"],
      ["support", "응원"], ["coins", "코인팩 아무거나"], ["coins:600", "코인 600"],
      ["coins:3300", "코인 3,300"], ["coins:7200", "코인 7,200"]] },
    { k: "has", type: "select", opts: [["true", "산 적 있음"], ["false", "산 적 없음"]], def: "true" }] },
  coins: { label: "코인 잔액", fields: [
    { k: "v", type: "number", def: 5000 },
    { k: "op", type: "select", opts: OPS_NUM, def: "gte" }] },
  versus: { label: "대전 · 최근 90일", fields: [
    { k: "field", type: "select", opts: [["played", "판 수"], ["wins", "1등 수"]], def: "played" },
    { k: "v", type: "number", def: 1 },
    { k: "op", type: "select", opts: OPS_NUM, def: "gte" }] },
  supporter: { label: "응원 상품을 산 회원", fields: [] },
  platform: { label: "휴대폰 종류", fields: [
    { k: "v", type: "select", opts: [["ios", "iPhone·iPad"], ["android", "Android"]], def: "ios" }] },
  lang: { label: "앱 언어", fields: [
    { k: "v", type: "select", opts: [["ko", "한국어"], ["en", "English"], ["ja", "日本語"], ["zh", "中文"]], def: "ko" }] },
  // 104 이벤트 조건 셋. id 칸의 목록은 LIVE_EVENTS에서 그때그때 만든다(opts가 함수). 붙으면 광고성으로만 나간다.
  event: { label: "이벤트 참여", fields: [
    { k: "id", type: "select", opts: () => eventCondOpts(), def: () => eventCondOpts()[0]?.[0] ?? "" },
    { k: "state", type: "select", opts: [["joined", "참여함"], ["not_joined", "참여 안 함 · 참여할 수 있는 레벨과 앱 버전인 사람만"]], def: "joined" }] },
  event_rank: { label: "이벤트 순위", fields: [
    { k: "id", type: "select", opts: () => eventCondOpts(), def: () => eventCondOpts()[0]?.[0] ?? "" },
    { k: "from", type: "number", def: 1, pre: "" },
    { k: "to", type: "number", def: 10, pre: "~", post: "위" }] },
  event_boards: { label: "산책길 이벤트에서 걸은 판 수", fields: [
    { k: "id", type: "select", opts: () => eventCondOpts("walk"), def: () => eventCondOpts("walk")[0]?.[0] ?? "" },
    { k: "v", type: "number", def: 10 },
    { k: "op", type: "select", opts: OPS_NUM, def: "gte" }] },
};
/** 이벤트 조건의 고를 거리. 서버 push_validate(104)가 취소된 이벤트와 시험 전용 이벤트를 거절하므로 뺀다. */
function eventCondOpts(kind = null) {
  return LIVE_EVENTS.filter((e) => !e.cancelled_at && !e.test_only && (!kind || e.kind === kind))
    .map((e) => [String(e.id), `#${e.id} ${e.name_ko}`]);
}
/** 이벤트 번호를 「#12 가을 산책길」로. 목록에 없으면 번호만. */
function eventTag(id) {
  const e = LIVE_EVENTS.find((x) => String(x.id) === String(id));
  return e ? `#${e.id} ${e.name_ko}` : `#${id}`;
}
// 자주 쓰는 조건. 고르면 조건 줄이 그대로 들어간다(이미 있는 줄에 더해진다).
const COND_PRESETS = [
  ["어제 랭킹 1~10위", () => [{ t: "rank", date: kstDate(-1), from: 1, to: 10 }]],
  ["오늘 0점, 오늘 한 판도 안 깬 사람", () => [{ t: "score", field: "today", op: "lte", v: 0 }]],
  ["7일 넘게 안 들어온 사람", () => [{ t: "seen", op: "over", days: 7 }]],
  ["가입 3일 안의 새 회원", () => [{ t: "joined", op: "within", days: 3 }]],
  ["결제한 적 없는 사람", () => [{ t: "purchased", item: "any", has: "false" }]],
  ["광고 제거 구매자", () => [{ t: "purchased", item: "remove_ads", has: "true" }]],
  ["코인 5,000 이상 쌓인 사람", () => [{ t: "coins", op: "gte", v: 5000 }]],
  ["대전을 한 번도 안 한 사람", () => [{ t: "versus", field: "played", op: "lte", v: 0 }]],
];
const LANG_NAMES = { ko: "한국어", en: "English", ja: "日本語", zh: "中文" };
// 기기 이름은 짧게 iOS·AOS로 쓴다(사용자 요청, 2026-10-08). 회원 목록 「앱」 칸, 푸시 조건, 기기별 집계, 기록 표가 같이 읽는다.
const PLATFORM_NAMES = { ios: "iOS", android: "AOS" };
// 결제 상품 이름. 모르는 상품은 상품 ID를 그대로 보인다. 앞에 붙는 패키지 이름(com.….)은 떼고 찾는다.
const PRODUCT_KINDS = { coins: "코인팩", remove_ads: "광고 제거", support: "응원" };
const PRODUCT_NAMES = { remove_ads: "광고 제거", support: "응원", support_developer: "응원",
  coins_small: "코인 600", coins_medium: "코인 3,300", coins_large: "코인 7,200" };
function productName(id) {
  const name = PRODUCT_NAMES[String(id ?? "").split(".").pop()];
  return name ? `${esc(name)} <span class="muted" style="font-size:11px">${esc(id)}</span>` : esc(id);
}

/** 한국시간 오늘에서 d일 옮긴 날짜(YYYY-MM-DD). 관리자 브라우저의 시간대와 상관없다. */
function kstDate(d = 0) {
  const t = new Date(Date.now() + 9 * 3600e3 + d * 86400e3);
  return t.toISOString().slice(0, 10);
}
/** datetime-local 값을 **한국시간으로** 읽는다. 브라우저 시간대가 달라도 같은 순간이 된다. */
const kstInput = (v) => (v ? new Date(`${v}:00+09:00`) : null);
/** 순간을 datetime-local 칸에 넣을 한국시간 문자열로. */
const toKstInput = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 16);
// 「주의」 보내지 않는 시간. 서버 push_send_window_open(088)과 같아야 한다. 판정과 화면 문구가 모두 이것을 읽는다.
// 법의 선은 21시인데 20시 50분에 마감한다. 기기 수천 대에 나가는 동안 21시를 넘기지 않게 둔 여유다.
const PUSH_QUIET = { fromMin: 20 * 60 + 50, toMin: 8 * 60 };
const hm = (min) => `${Math.floor(min / 60)}시${min % 60 ? ` ${min % 60}분` : ""}`;
const QUIET_TEXT = `${hm(PUSH_QUIET.fromMin)}부터 ${hm(PUSH_QUIET.toMin)}`;
const QUIET_END = hm(PUSH_QUIET.toMin);

// 「눌렀을 때 열 곳」. 화면에는 이름을 보이고 실제로는 링크를 보낸다(사용자 지시, 2026-10-05).
// 「주의」 두 앱의 PushManager.open(링크 해석)과 짝이다. 하나를 더하면 두 앱도 같이 고친다.
// 빈 링크는 서버가 /settings로 바꾼다. 수신거부로 바로 가는 길이라 기본값으로 둔다.
const PUSH_LINKS = [
  { link: "", label: "설정 화면 · 광고성 알림을 끌 수 있는 곳 · 기본" },
  { link: "/home", label: "홈 화면 · 앱만 열립니다" },
  { link: "/shop", label: "상점" },
  { link: "/ranking", label: "랭킹" },
  { link: "/missions", label: "미션" },
  { link: "/mailbox", label: "우편함 · 1.5.0 이상, 그 전 앱은 앱만 열립니다" },
  { link: "/vs/", label: "대전 초대 · 방 코드를 넣으면 그 방으로 바로 들어갑니다", code: true },
  // 103·104: 서버는 /event/<번호> 꼴만 받고 광고성으로만 보낸다. 옛 앱은 모르는 링크라 앱만 열린다.
  { link: "/event/", label: "이벤트 · 고른 이벤트가 바로 열립니다 · 1.5.0 이상, 그 전 앱은 앱만 열립니다", event: true },
];
/** 링크를 사람이 읽는 이름으로. 모르는 링크는 링크를 그대로 보인다.
 *  서비스 안내(notice)는 링크가 비면 서버가 설정 대신 홈을 연다(095). */
/** 발송 확인 창의 종류 줄. 푸시 발송 창과 공지 창(110)이 같이 읽는다. */
const pushKindLine = (kind) => (kind === "notice" ? "알림 종류: 서비스 안내 · 「(광고)」 없이 나갑니다" : "알림 종류: 광고성 정보 · 제목에 「(광고)」를 붙입니다");

function linkLabel(link, kind = "ad") {
  if (!link && kind === "notice") return "홈 화면 · 앱만 열립니다 · 기본";
  if (!link || link === "/settings") return PUSH_LINKS[0].label;
  if (/^\/vs\/\d{6}$/.test(link)) return `대전 초대 · 방 ${link.slice(4)}`;
  if (/^\/event\/\d+$/.test(link)) return `이벤트 · ${eventTag(link.slice(7))}`;
  return PUSH_LINKS.find((x) => x.link === link)?.label ?? link;
}
// 085 이전에 만든 대상. 새 화면의 조건으로 옮기면 판정이 조금 달라져서(086 seen은 접속 기준) 그대로 둔다.
const LEGACY_TARGETS = { inactive_7d: "예전 방식: 7일 넘게 안 들어온 사람", top100: "예전 방식: 오늘 점수 상위 100명" };
// 열려 있는 발송 창의 번호. 닫거나 새로 열면 오른다 — 앞 창의 늦은 미리보기 응답을 버리는 데 쓴다.
let PUSH_DLG = 0;
const inQuiet = (d) => {
  const t = new Date(d.getTime() + 9 * 3600e3);
  const m = t.getUTCHours() * 60 + t.getUTCMinutes();
  return m >= PUSH_QUIET.fromMin || m < PUSH_QUIET.toMin;
};

/** 저장된 조건을 사람이 읽는 말로. 발송 목록의 「대상」 칸에 쓴다. */
function describeConds(arg) {
  let list = [];
  try { list = JSON.parse(arg || "{}").all || []; } catch { return esc(arg || ""); }
  const optsOf = (f) => (typeof f?.opts === "function" ? f.opts() : f?.opts) || [];
  const name = (type, k, v) => optsOf(COND_TYPES[type]?.fields.find((f) => f.k === k))
    .find(([x]) => String(x) === String(v))?.[1] ?? v;
  return list.map((c) => {
    switch (c.t) {
      case "rank": return `${c.date === "today" ? "나가는 날" : c.date} 오늘 점수 ${c.from}~${c.to}위`;
      case "score": return `${name("score", "field", c.field)} ${fmt(c.v)} ${name("score", "op", c.op)}`;
      case "seen": return `마지막 접속 ${c.days}${name("seen", "op", c.op)}`;
      case "joined": return `가입 ${c.days}${name("joined", "op", c.op)}`;
      case "purchased": return `${name("purchased", "item", c.item)} ${name("purchased", "has", String(c.has))}`;
      case "coins": return `코인 ${fmt(c.v)} ${name("coins", "op", c.op)}`;
      case "versus": return `대전 ${name("versus", "field", c.field)} ${fmt(c.v)} ${name("versus", "op", c.op)}`;
      case "supporter": return "응원 상품을 산 회원";
      case "platform": return PLATFORM_NAMES[c.v] || c.v;
      case "lang": return LANG_NAMES[c.v] || c.v;
      case "event": return `${eventTag(c.id)} ${name("event", "state", c.state)}`;
      case "event_rank": return `${eventTag(c.id)} 순위 ${c.from}~${c.to}위`;
      case "event_boards": return `${eventTag(c.id)} 걸은 판 수 ${fmt(c.v)} ${name("event_boards", "op", c.op)}`;
      default: return String(c.t);
    }
  }).map(esc).join(" · ");
}

/** 조건 줄 → 서버로 보낼 JSON. 숫자 칸은 숫자로, 결제의 has는 참거짓으로 바꾼다. */
function condsToArg(conds) {
  return JSON.stringify({ all: conds.map((c) => {
    const out = { t: c.t };
    for (const f of COND_TYPES[c.t].fields) {
      const v = c[f.k];
      out[f.k] = f.type === "number" || f.k === "id" ? Number(v) : f.k === "has" ? String(v) === "true" : v;
    }
    return out;
  }) });
}

/** 회원 ID 칸을 읽는다. 쉼표·줄바꿈·띄어쓰기로 나눈다. */
function parseUserIds(text) {
  const all = [...new Set(String(text || "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean))];
  const ok = all.filter((x) => /^[0-9a-fA-F-]{36}$/.test(x));
  return { ok, bad: all.filter((x) => !ok.includes(x)) };
}

/**
 * 발송 창. 되돌릴 수 없으니 **보내기 전에 누구에게, 몇 명에게, 어느 언어로 가는지** 보여 준다.
 *
 * - `prefill` 대상·문구를 채워 연다. 회원 목록의 「선택 회원에게 푸시」와 발송 목록의 「복제」가 쓴다
 * - `editId` 아직 안 나간 예약을 고친다(087 admin_update_push)
 */
function openPush(prefill = null, editId = null) {
  const dlg = $("#pushDlg");
  const pf = prefill || {};
  $("#pTitle").value = pf.title || "";
  $("#pBody").value = pf.body || "";
  // 종류(095). 복제·고치기는 원래 종류를 따른다. 새로 열면 광고성 — 모르면 「(광고)」를 붙이는 쪽이 안전하다.
  $("#pKind").value = pf.kind === "notice" ? "notice" : "ad";
  const showKind = () => { $("#pKindNote").style.display = $("#pKind").value === "notice" ? "" : "none"; };
  $("#pKind").onchange = showKind;
  showKind();
  // 열 곳: 아는 링크면 그 이름을 고르고, 대전 초대면 방 코드를 채운다. 모르는 링크는 그대로 둔다.
  $("#pLinkSel").innerHTML = PUSH_LINKS.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join("");
  const link0 = pf.link && pf.link !== "/settings" ? pf.link : "";
  let li = PUSH_LINKS.findIndex((x) => !x.code && !x.event && x.link === link0);
  $("#pLinkCode").value = "";
  if (li < 0 && /^\/vs\/\d{6}$/.test(link0)) { li = PUSH_LINKS.findIndex((x) => x.code); $("#pLinkCode").value = link0.slice(4); }
  // 이벤트 링크는 이벤트 고르기 칸. 취소된 이벤트는 열어 봐야 「진행 중이 아님」이라 뺀다. 목록에 없는 번호도 고른 채로 둔다.
  const linkEvents = LIVE_EVENTS.filter((e) => !e.cancelled_at);
  const eventId0 = /^\/event\/\d+$/.test(link0) ? link0.slice(7) : "";
  $("#pLinkEvent").innerHTML = (eventId0 && !linkEvents.some((e) => String(e.id) === eventId0)
    ? `<option value="${esc(eventId0)}">#${esc(eventId0)}</option>` : "") +
    (linkEvents.length || eventId0 ? "" : '<option value="">고를 이벤트가 없습니다</option>') +
    linkEvents.map((e) => `<option value="${e.id}">${esc(`#${e.id} ${e.name_ko} · ${LE_STATE[e.state]?.[0] ?? e.state}${e.test_only ? " · 시험" : ""}`)}</option>`).join("");
  if (li < 0 && eventId0) { li = PUSH_LINKS.findIndex((x) => x.event); $("#pLinkEvent").value = eventId0; }
  if (li < 0) {
    $("#pLinkSel").insertAdjacentHTML("beforeend", `<option value="raw">원래 주소 그대로 · ${esc(link0)}</option>`);
    $("#pLinkSel").value = "raw";
  } else $("#pLinkSel").value = String(li);
  const showLinkCode = () => {
    const x = PUSH_LINKS[Number($("#pLinkSel").value)];
    $("#pLinkCodeRow").style.display = x && x.code ? "" : "none";
    $("#pLinkEventRow").style.display = x && x.event ? "" : "none";
  };
  $("#pLinkSel").onchange = () => { showLinkCode(); syncKind(); };
  $("#pLinkEvent").onchange = () => syncKind();
  showLinkCode();
  const currentLink = () => {
    if ($("#pLinkSel").value === "raw") return link0;
    const x = PUSH_LINKS[Number($("#pLinkSel").value)];
    if (x.code) return `/vs/${$("#pLinkCode").value.trim()}`;
    if (x.event) return `/event/${$("#pLinkEvent").value}`;
    return x.link || null;
  };
  // 이미 지난 예약 시각(밤이라 8시를 기다리는 줄)은 비워서 연다. 그대로 두면 「지난 시각」으로 막힌다.
  const pastAt = pf.scheduled_at && new Date(pf.scheduled_at) < new Date(Date.now() - 10 * 60e3);
  // 고치기와 이벤트 「시작 알림 예약」이 채운다. 복제는 scheduled_at을 비워서 넘긴다.
  $("#pWhen").value = pf.scheduled_at && !pastAt ? toKstInput(pf.scheduled_at) : "";
  // user(한 명)는 users(여러 명)와 뜻이 같아 옮긴다. 나머지 옛 대상은 뜻이 달라지므로 그대로 둔다.
  let target = pf.target || "all", conds = [];
  if (target === "user") target = "users";
  // 고른 회원. id → 이름. 이름을 모르면(목록 밖) ID 앞부분을 보인다.
  const picked = new Map();
  if (target === "users") {
    for (const id of (pf.target_arg || "").split(",").map((x) => x.trim()).filter(Boolean)) {
      picked.set(id, pf.names?.[id] || findPlayer(id)?.username || null);
    }
  }
  $("#pTarget").querySelectorAll("[data-legacy]").forEach((o) => o.remove());
  if (LEGACY_TARGETS[target]) {
    $("#pTarget").insertAdjacentHTML("beforeend",
      `<option value="${target}" data-legacy>${esc(LEGACY_TARGETS[target])}</option>`);
  }
  if (target === "filter" && pf.target_arg) {
    try {
      conds = (JSON.parse(pf.target_arg).all || []).map((c) => ({ ...c, has: c.has === undefined ? undefined : String(c.has) }));
    } catch { conds = []; }
  }
  $("#pTarget").value = target;
  $("#pFind").value = "";
  $("#pFound").innerHTML = "";
  $("#pErr").textContent = "";
  dlg.querySelector("h3").textContent = editId ? "예약한 푸시 고치기" : "푸시 보내기";
  $("#pOk").textContent = editId ? "고치기" : "보내기";

  const renderConds = () => {
    $("#pConds").innerHTML = conds.map((c, i) => {
      const type = COND_TYPES[c.t];
      const fields = type.fields.map((f) => {
        const v = c[f.k] ?? (typeof f.def === "function" ? f.def() : f.def);
        c[f.k] = v;
        // 이벤트 목록처럼 그때그때 만드는 목록은 함수다. 목록에 없는 옛 값(복제한 발송의 지난 이벤트)도 고른 채로 보인다.
        let opts = typeof f.opts === "function" ? f.opts() : f.opts;
        if (f.type === "select" && v !== "" && v != null && !opts.some(([x]) => String(x) === String(v))) {
          opts = [[String(v), f.k === "id" ? eventTag(v) : String(v)], ...opts];
        }
        const input = f.type === "select"
          ? `<select data-ci="${i}" data-ck="${f.k}">${opts.map(([x, l]) =>
              `<option value="${esc(x)}" ${String(x) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
          : f.type === "date"
            ? `<input type="date" data-ci="${i}" data-ck="${f.k}" value="${v === "today" ? kstDate() : esc(v)}" style="width:auto">`
            : `<input type="number" data-ci="${i}" data-ck="${f.k}" value="${esc(v)}" style="width:90px">`;
        return `${f.pre ? `<span class="muted">${f.pre}</span>` : ""}${input}${f.post ? `<span class="muted">${f.post}</span>` : ""}`;
      }).join(" ");
      return `<div class="cond" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0">
        <select data-ci="${i}" data-ck="t">${Object.entries(COND_TYPES).map(([k, t]) =>
          `<option value="${k}" ${k === c.t ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
        ${fields}
        <button class="ghost sm" type="button" data-cdel="${i}">이 조건 빼기</button>
      </div>`;
    }).join("") + `<div style="margin:6px 0"><select id="pPreset"><option value="">자주 쓰는 조건 골라 넣기…</option>${
      COND_PRESETS.map(([l], i) => `<option value="${i}">${esc(l)}</option>`).join("")}</select></div>`;
    $("#pConds").querySelectorAll("[data-ck]").forEach((el) => {
      el.onchange = () => {
        const c = conds[Number(el.dataset.ci)];
        if (el.dataset.ck === "t") {
          // 종류가 바뀌면 칸이 다르다. 새 종류의 기본값으로 다시 채운다.
          conds[Number(el.dataset.ci)] = { t: el.value };
          renderConds();
        } else c[el.dataset.ck] = el.value;
        recount();
      };
    });
    $("#pConds").querySelectorAll("[data-cdel]").forEach((b) => {
      b.onclick = () => { conds.splice(Number(b.dataset.cdel), 1); renderConds(); recount(); };
    });
    $("#pPreset").onchange = (e) => {
      if (e.target.value === "") return;
      conds.push(...COND_PRESETS[Number(e.target.value)][1]());
      renderConds(); recount();
    };
  };

  const currentArg = () => {
    const t = $("#pTarget").value;
    if (t === "users") return [...picked.keys()].join(",") || null;
    if (t === "filter") return conds.length ? condsToArg(conds) : null;
    return null;   // 동의한 전체와 옛 대상은 조건 값이 없다
  };

  const dlgId = ++PUSH_DLG;
  const whenNote = () => {
    const v = $("#pWhen").value;
    const at = kstInput(v);
    const now = new Date();
    let msg;
    if ($("#pWhen").validity.badInput) {
      msg = "예약 날짜와 시각을 끝까지 넣으세요.";
    } else if (!at) {
      msg = inQuiet(now) ? `지금은 보내지 않는 시간이라 한국시간 ${QUIET_END}에 나갑니다.` : "등록하면 1분 안에 나갑니다.";
    } else if (at < new Date(now.getTime() - 10 * 60e3)) {
      msg = "이미 지난 시각입니다.";
    } else {
      const s = at.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });
      msg = `한국시간 ${s}에 나갑니다.` + (inQuiet(at) ? ` ${QUIET_TEXT} 사이라 실제로는 그다음 ${QUIET_END}에 나갑니다.` : "");
    }
    $("#pWhenNote").textContent = msg + " 받을 사람은 나가는 순간에 다시 셉니다.";
  };

  let seq = 0, timer = null, summary = "받을 사람: —";
  // 지금 조건으로 바로 센다. 확인창 첫 줄에 쓸 한 줄을 돌려준다.
  const countNow = async () => {
    const my = ++seq;
    const live = () => my === seq && dlgId === PUSH_DLG;
    const t = $("#pTarget").value;
    $("#pErr").textContent = "";
    if (t === "users" && !picked.size) {
      summary = "받을 사람: 아직 없음. 회원을 찾아 넣으세요";
      $("#pCount").textContent = summary;
      $("#pPreview").textContent = "";
      return summary;
    }
    if (t === "filter" && !conds.length) {
      summary = "받을 사람: 아직 없음. 조건을 하나 이상 넣으세요";
      $("#pCount").textContent = summary;
      $("#pPreview").textContent = "";
      return summary;
    }
    $("#pCount").textContent = "받을 사람: 세는 중…";
    try {
      const r = await rpc("admin_push_preview", { p_target: t, p_target_arg: currentArg(), p_limit: 30 });
      // 더 늦게 보낸 요청이 있거나, 이 창이 닫혔거나 새 창이 열렸으면 버린다
      if (!live()) return null;
      const langs = Object.entries(r.by_lang || {}).map(([k, n]) => `${LANG_NAMES[k] || k} ${fmt(n)}`).join(" · ");
      const plats = Object.entries(r.by_platform || {}).map(([k, n]) => `${PLATFORM_NAMES[k] || k} ${fmt(n)}`).join(" · ");
      summary = `받을 사람: ${fmt(r.people)}명, 휴대폰 ${fmt(r.devices)}대`;
      $("#pCount").innerHTML = `받을 사람: <b>${fmt(r.people)}명</b> · 휴대폰 ${fmt(r.devices)}대` +
        (r.devices ? `<br>${esc(langs)}<br>${esc(plats)}` : "");
      // 이름을 모르던 고른 회원(복제·고치기로 연 창)은 미리보기가 준 이름으로 채운다. 요청이 더 들지 않는다.
      let filled = false;
      for (const x of r.names || []) {
        const id = String(x.id);
        if (picked.has(id) && !picked.get(id) && x.name) { picked.set(id, x.name); filled = true; }
      }
      if (filled) renderPicked();
      const names = (r.names || []).map((x) => esc(x.name || "(이름 없음)")).join(", ");
      $("#pPreview").innerHTML = names ? `${names}${r.people > r.names.length ? ` 외 ${fmt(r.people - r.names.length)}명` : ""}` : "";
      // 한국어가 아닌 사람이 섞여 있으면 문구가 한 벌이라는 것을 한 번 더 알린다.
      const foreign = Object.entries(r.by_lang || {}).filter(([k]) => k !== "ko").reduce((a, [, n]) => a + n, 0);
      if (foreign) $("#pPreview").innerHTML += `<div style="margin-top:4px">「주의」 앱 언어가 한국어가 아닌 휴대폰 ${fmt(foreign)}대에도 이 문구 그대로 갑니다. 언어별로 보내려면 「앱 언어」 조건을 넣어 따로 보내세요.</div>`;
      return summary;
    } catch (e) {
      if (!live()) return null;
      summary = "받을 사람: 세지 못했습니다";
      $("#pCount").textContent = summary;
      $("#pPreview").textContent = e.message;
      return summary;
    }
  };
  // 이벤트 링크나 이벤트 조건이 붙으면 광고성으로 잠근다(15절 10번). 서버 push_event_kind_check(104)가 같은 규칙으로 막는다.
  const syncKind = () => {
    const lnk = currentLink() || "";
    const ev = lnk.startsWith("/event/") ||
      ($("#pTarget").value === "filter" && conds.some((c) => String(c.t).startsWith("event")));
    if (ev) $("#pKind").value = "ad";
    $("#pKind").disabled = ev;
    $("#pKindLock").style.display = ev ? "" : "none";
    showKind();
  };
  // 입력 중에는 300ms 모았다가 센다.
  const recount = () => {
    syncKind();
    clearTimeout(timer);
    timer = setTimeout(countNow, 300);
  };

  // ---- 회원 찾기
  const renderPicked = () => {
    $("#pPicked").innerHTML = picked.size
      ? `<div class="muted" style="font-size:12px;margin-bottom:4px">고른 회원 ${fmt(picked.size)}명</div>` +
        [...picked].map(([id, name]) => `<span class="pill" style="display:inline-flex;gap:6px;align-items:center;margin:2px">
          ${esc(name || id.slice(0, 8))}<button class="ghost sm" type="button" data-unpick="${esc(id)}" title="빼기">빼기</button></span>`).join("")
      : "";
    $("#pPicked").querySelectorAll("[data-unpick]").forEach((b) => {
      b.onclick = () => { picked.delete(b.dataset.unpick); renderPicked(); renderFound(); recount(); };
    });
  };
  let found = [], findSeq = 0, findTimer = null;
  const renderFound = () => {
    $("#pFound").innerHTML = found.map((u) => `<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line, #eee)">
        <div style="flex:1;min-width:0">${esc(u.username || "(이름 없음)")}
          <span class="muted" style="font-size:11px">${esc(String(u.id).slice(0, 8))} · 누적 ${fmt(u.total_score)} · 오늘 ${fmt(u.today_score)}</span></div>
        ${u.reachable ? '<span class="pill today">받을 수 있음</span>' : '<span class="muted" style="font-size:11px" title="광고성 알림을 켜지 않았거나, 알림 받을 휴대폰이 서버에 등록되어 있지 않습니다">못 받음</span>'}
        <button class="sm" type="button" data-pick-user="${esc(u.id)}" ${picked.has(u.id) ? "disabled" : ""}>${picked.has(u.id) ? "넣음" : "넣기"}</button>
      </div>`).join("") || ($("#pFind").value.trim() ? '<div class="muted" style="font-size:12px">찾은 회원이 없습니다</div>' : "");
    $("#pFound").querySelectorAll("[data-pick-user]").forEach((b) => {
      b.onclick = () => {
        const u = found.find((x) => String(x.id) === b.dataset.pickUser);
        if (u) { picked.set(String(u.id), u.username || null); renderPicked(); renderFound(); recount(); }
      };
    });
  };
  const doFind = async () => {
    const q = $("#pFind").value.trim();
    // 회원 ID를 붙여 넣었으면 찾지 않고 바로 넣는다. 여러 개를 한꺼번에 붙여도 된다.
    const { ok } = parseUserIds(q);
    if (ok.length && q.replace(/[0-9a-fA-F-]{36}/g, "").replace(/[\s,]/g, "") === "") {
      ok.forEach((id) => { if (!picked.has(id)) picked.set(id, findPlayer(id)?.username || null); });
      $("#pFind").value = "";
      found = [];
      renderPicked(); renderFound(); recount();
      return;
    }
    const my = ++findSeq;
    try {
      const rows = await rpc("admin_push_find_users", { p_query: q, p_limit: 20 }) || [];
      if (my !== findSeq || dlgId !== PUSH_DLG) return;
      found = rows;
      renderFound();
    } catch (e) {
      if (my === findSeq) $("#pFound").innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  };
  $("#pFind").oninput = () => { clearTimeout(findTimer); findTimer = setTimeout(doFind, 300); };
  // Enter는 맨 위 회원을 넣는다.
  $("#pFind").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const u = found.find((x) => !picked.has(String(x.id)));
    if (u) { picked.set(String(u.id), u.username || null); renderPicked(); renderFound(); recount(); }
  };
  renderPicked();

  const showTarget = () => {
    const t = $("#pTarget").value;
    $("#pUsersRow").style.display = t === "users" ? "" : "none";
    $("#pFilterRow").style.display = t === "filter" ? "" : "none";
  };
  $("#pTarget").onchange = () => {
    showTarget(); recount();
    // 회원 지정을 처음 고르면 받을 수 있는 회원부터 보여 준다(빈 검색).
    if ($("#pTarget").value === "users" && !found.length) doFind();
  };
  $("#pWhen").oninput = whenNote;
  $("#pAddCond").onclick = () => { conds.push({ t: "score" }); renderConds(); recount(); };
  renderConds();
  showTarget();
  whenNote();
  recount();

  dlg.showModal();
  // 닫히면(취소·Esc·발송 뒤) 기다리던 세기를 멈추고, 늦게 오는 응답은 PUSH_DLG로 버린다.
  dlg.onclose = () => { clearTimeout(timer); clearTimeout(findTimer); PUSH_DLG++; };
  $("#pCancel").onclick = () => dlg.close();
  $("#pOk").onclick = async () => {
    const title = $("#pTitle").value.trim(), body = $("#pBody").value.trim();
    if (!title || !body) { $("#pErr").textContent = "제목과 본문을 모두 적어 주세요"; return; }
    const t = $("#pTarget").value, arg = currentArg();
    if (t === "users" && !picked.size) { $("#pErr").textContent = "보낼 회원을 찾아 넣으세요"; return; }
    const linkNow = currentLink();
    if (linkNow && linkNow.startsWith("/vs/") && !/^\/vs\/\d{6}$/.test(linkNow)) {
      $("#pErr").textContent = "방 코드는 숫자 6자리입니다"; return;
    }
    if (linkNow && linkNow.startsWith("/event/") && !/^\/event\/\d{1,9}$/.test(linkNow)) {
      $("#pErr").textContent = "열 이벤트를 고르세요"; return;
    }
    if (t === "filter" && !conds.length) { $("#pErr").textContent = "조건을 하나 이상 넣으세요"; return; }
    if ($("#pWhen").validity.badInput) { $("#pErr").textContent = "예약 날짜와 시각을 끝까지 넣으세요"; return; }
    const at = kstInput($("#pWhen").value);
    if (at && at < new Date(Date.now() - 10 * 60e3)) { $("#pErr").textContent = "예약 시각이 이미 지났습니다"; return; }
    // 되돌릴 수 없으니 한 번 더 묻는다. 몇 명에게, 언제 가는지 같이 보여준다.
    // **누르는 순간의 조건으로 다시 센다.** 칸을 고치고 300ms 안에 누르면 화면 숫자는 옛 조건의 것이다.
    clearTimeout(timer);
    $("#pOk").disabled = true;
    const counted = await countNow();
    $("#pOk").disabled = false;
    if (counted === null) return;   // 그 사이에 창이 닫혔다
    whenNote();
    const when = $("#pWhenNote").textContent.split(" 받을 사람은")[0];
    const verb = at ? (editId ? "이 예약을 고칠까요?" : "예약할까요?")
                    : `${editId ? "고친 내용은" : "보내면"} 곧 나가고 취소할 수 없습니다. ${editId ? "고칠까요?" : "발송할까요?"}`;
    const kind = $("#pKind").value;
    const kindLine = pushKindLine(kind);
    if (!confirm(`${counted}\n${when}\n${kindLine}\n누르면 열리는 화면: ${linkLabel(linkNow, kind)}\n\n"${title}"\n\n${verb}`)) return;
    $("#pOk").disabled = true;   // 두 번 눌러 두 번 나가는 일을 막는다
    try {
      const common = {
        p_title: title, p_body: body, p_target: t, p_target_arg: arg,
        p_scheduled_at: at ? at.toISOString() : null,
        p_link: linkNow,
        p_kind: kind,
      };
      if (editId) await rpc("admin_update_push", { p_id: editId, ...common });
      else await rpc("admin_send_push", common);
      dlg.close();
      // 회원 목록에서 열었어도 결과를 볼 수 있게 발송 탭으로 옮긴다.
      TAB = "push";
      refresh();
    } catch (e) { $("#pErr").textContent = e.message; }
    finally { $("#pOk").disabled = false; }
  };
}

/** 체크한 회원에게 보낸다. 받을 수 없는 회원이 섞여 있으면 몇 명인지 먼저 알린다. */
async function pushSelected() {
  const ids = [...SELECTED];
  if (!ids.length) { alert("먼저 회원을 체크하세요"); return; }
  // 받을 수 있는지 모르면 막지 않는다. 창의 미리보기가 실제 수를 센다.
  const off = REACH === null ? 0 : ids.filter((id) => !REACH[id]).length;
  if (off && off === ids.length) {
    alert(`체크한 ${ids.length}명 모두 지금은 푸시를 받을 수 없습니다.\n회원 목록의 「푸시」 칸이 「받음」인 회원만 받습니다.`);
    return;
  }
  if (off && !confirm(`체크한 ${ids.length}명 중 ${off}명은 푸시를 받을 수 없습니다. 광고성 알림을 켜지 않았거나 알림 받을 휴대폰이 등록되어 있지 않습니다.\n나머지 ${ids.length - off}명에게 보내는 창을 열까요?`)) return;
  // 회원 목록에서 열면 이벤트 목록을 아직 안 받았다. 이벤트 조건의 고를 거리가 비지 않게 열기 전에 받는다.
  if (!LIVE_EVENTS.length) await loadLiveEvents();
  openPush({ target: "users", target_arg: ids.join(","),
             names: Object.fromEntries(ids.map((id) => [id, findPlayer(id)?.username || null])) });
}

async function cancelPush(id) {
  if (!confirm("아직 안 나간 이 푸시를 보내지 않기로 합니다.")) return;
  await act(() => rpc("admin_cancel_push", { p_id: id }), refresh);
}

async function deleteNotice(id) {
  if (!confirm("이 공지를 지웁니다. 아직 못 본 사람은 앞으로도 볼 수 없습니다.")) return;
  const reason = askReason("공지 지우기");
  if (reason === null) return;
  await act(() => rpc("admin_delete_notice", { p_id: id, p_reason: reason }), refresh);
}

async function toggleMember(id) {
  if (OPEN_MEMBER === id) { OPEN_MEMBER = null; MEMBER_EVENTS = []; MEMBER_PAYS = []; render(); return; }
  OPEN_MEMBER = id;
  try { MEMBER_EVENTS = await rpc("admin_member_events", { p_target: id, p_limit: 200 }) || []; }
  catch (e) { MEMBER_EVENTS = []; alert("이 회원의 기록을 불러오지 못했습니다.\n\n" + plainError(e.message)); }
  // 구매 기능을 아직 안 깐 프로젝트에서도 이력은 열려야 한다.
  try { MEMBER_PAYS = await rpc("admin_member_purchases", { p_target: id, p_limit: 100 }) || []; }
  catch { MEMBER_PAYS = []; }
  render();
}

async function toggleBatch(id) {
  if (OPEN_BATCH === id) { OPEN_BATCH = null; BATCH_MEMBERS = []; render(); return; }
  OPEN_BATCH = id;
  try { BATCH_MEMBERS = await rpc("admin_batch_members", { p_batch: id }) || []; }
  catch (e) { BATCH_MEMBERS = []; alert("받는 사람 명단을 불러오지 못했습니다.\n\n" + plainError(e.message)); }
  render();
}

async function revokeBatch(id) {
  const b = BATCHES.find((x) => x.id === id);
  // 등록−수령으로 계산하면 안 된다 — 회수로 지워진 건 등록 숫자에 남아 있어서,
  // 회수를 반복해도 "17건 회수합니다 → 0건 회수했습니다"만 돌았다(실측).
  const left = Number(b?.pending_count || 0);
  if (!confirm(`아직 안 받아 간 ${left}건을 거둬들입니다.\n\n` +
    `이미 받아 간 사람의 코인은 그 사람 휴대폰에 들어가 있어서 되돌릴 수 없습니다.`)) return;
  const reason = askReason("모든 회원에게 준 보상 거둬들이기");
  if (reason === null) return;
  await act(async () => {
    const n = await rpc("admin_revoke_batch", { p_batch: id, p_reason: reason });
    alert(`${n}건을 거둬들였습니다`);
  }, refresh);
}

// ------------------------------------------------------------------ 표
async function loadVersus() {
  try {
    VS_DAILY = await rpc("admin_versus_daily", { p_days: 30 }) || [];
    VS_PLAYERS = await rpc("admin_versus_players", { p_limit: 200 }) || [];
    VS_BOARDS = await rpc("admin_versus_boards") || [];
    // 051 — 모드별. 예전 서버(051 미적용)에서는 함수가 없으므로 조용히 빈 배열로 둔다.
    VS_MODES = await rpc("admin_versus_modes", { p_days: 30 }).catch(() => []) || [];
    VS_ROOMS = await rpc("admin_versus_rooms").catch(() => []) || [];
    MATCH = (await rpc("admin_matching_stats").catch(() => []))[0] || null;
    REPORTS = await rpc("admin_reports", { p_limit: 100 }).catch(() => []) || [];
    // 061 — 이벤트 목록. 아직 안 올린 서버에서는 표가 통째로 빠질 뿐 나머지는 그대로 돈다.
    VS_EVENTS = (await sb.from("versus_events").select("*").order("category").order("code")
      .then((r) => r.data).catch(() => null)) || [];
    await loadConfig();
    return null;
  } catch (e) { return e; }
}

async function loadConfig() {
  const { data, error } = await sb.from("app_config").select("*");
  if (error) throw new Error(error.message);
  CONFIG = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  // **스위치 값은 여기서 만든다.** 예전에는 loadVersus 안에 있었는데, boot()는 그 함수를
  // `TAB === "versus"`일 때만 부른다. 그래서 **설정 탭에서는 서버 값을 한 번도 안 읽고**
  // 파일 맨 위의 초기값(VS_ON=false, EV_ON=true)을 그대로 그렸다 — 서버가 무엇이든
  // 늘 "같이하기 꺼짐 / 장난 켜짐"으로 보였다(2026-08-17 제보).
  // loadConfig는 탭과 무관하게 boot()가 항상 부르므로 여기 두면 어느 탭에서도 맞는다.
  VS_ON = CONFIG.versus_enabled === true;
  EV_ON = CONFIG.versus_events_on !== false;
}

/**
 * 랭킹 보상 표를 고친다(076).
 *
 * `to`는 **그 등수까지**다. 1·2·3·5·10이면 4등은 「5까지」 줄에 걸린다.
 * **마지막 줄의 `to`가 곧 몇 등까지 줄지**다 — 범위를 따로 두지 않는다.
 *
 * ⚠️ **앱 안내 문구도 이 표에서 만들어진다.** 여기를 고치면 앱의
 * 「1등 1,000 · 2등 700 …」이 따라 바뀐다. 숫자가 사는 곳은 여기 하나뿐이다.
 *
 * ⚠️ **랭킹 목록은 100명까지만 내려간다.** 100등 넘게 주면 지급은 되지만
 * 앱 목록에서는 그 줄이 안 보인다.
 */
/** 접힌 보상표 머리 옆에 붙는 짧은 요약. 「10등까지 · 1등 코인 1,000」. */
function rewardNote(key) {
  const cfg = CONFIG?.[key] && typeof CONFIG[key] === "object" ? CONFIG[key] : {};
  const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
  if (cfg.enabled === false) return "보상 꺼짐";
  if (!tiers.length) return "기본 보상표";
  return `${fmt(tiers[tiers.length - 1].to)}등까지 · 1등 코인 ${fmt(tiers[0].coins)}`;
}

function rankRewardEditor(key = "rank_rewards", label = "오늘 점수") {
  const cfg = CONFIG?.[key] && typeof CONFIG[key] === "object" ? CONFIG[key] : {};
  const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
  const n = (v) => Number(v ?? 0) || 0;
  const row = (t, i) => `
    <tr data-tier="${i}">
      <td class="num"><input type="number" min="1" class="t-to"    value="${n(t.to)}"    style="width:80px"></td>
      <td class="num"><input type="number" min="0" class="t-coins" value="${n(t.coins)}" style="width:100px"></td>
      <td class="num"><input type="number" min="0" class="t-hints" value="${n(t.hints)}" style="width:80px"></td>
      <td class="num"><input type="number" min="0" class="t-autos" value="${n(t.autos)}" style="width:80px"></td>
      <td><button class="sm" data-tier-del="${i}">이 줄 지우기</button></td>
    </tr>`;
  const body = tiers.length
    ? tiers.map(row).join("")
    : `<tr><td colspan="5" class="muted">표가 비어 있습니다. 비어 있으면 기본 보상표로 나눠 줍니다.</td></tr>`;
  // 오늘 점수(rank_rewards)는 늘 켜져 있다. 기록전·숫자는 끌 수 있고, 끄면 그 기간은 정산만 하고 보상을 주지 않는다(105).
  const toggle = key === "rank_rewards" ? "" : `<label class="switch" style="margin-bottom:var(--gap)">
      <input type="checkbox" class="t-enabled" ${cfg.enabled === false ? "" : "checked"}><span>${esc(label)} 랭킹 보상 켜기</span></label>`;
  return `
    <div class="notice">
      <b>등수는 「몇 등까지」로 적습니다.</b> 줄이 1, 2, 3, 5, 10이면 4등과 5등은 「5등까지」 줄의 보상을 받습니다.
      <b>마지막 줄의 등수까지만 보상을 줍니다.</b> 마지막 줄이 10이면 11등부터는 없습니다.
      ${key === "rank_rewards" ? "<br>여기를 고치면 <b>앱의 보상 안내 문구도 같이 바뀝니다.</b> 앱을 새로 올릴 필요가 없습니다." : "<br>저장하면 다음에 보상을 나눠 줄 때부터 이 표를 씁니다."}
      ${infoTip(`랭킹이 마감되면 서버가 등수를 매겨 보상을 우편함으로 보내고, 보낸 날부터 ${RANK_CLAIM_DAYS}일 안에 받아야 합니다. 앱 랭킹 목록은 100명까지만 보여 줍니다. 그보다 아래까지 주면 보상은 가지만 목록에는 안 보입니다.`)}
    </div>
    <div class="tier-editor" data-tierkey="${esc(key)}" data-tierlabel="${esc(label)}">
    ${toggle}
    <div class="table-scroll"><table style="min-width:520px">
      <thead><tr>
        <th class="num">몇 등까지</th><th class="num">코인</th>
        <th class="num">힌트</th><th class="num">자동배치</th><th></th>
      </tr></thead>
      <tbody class="tier-body">${body}</tbody>
    </table></div>
    <div class="toolbar save-bar">
      <button class="sm tier-add">줄 추가</button>
      <div style="flex:1"></div>
      <button class="sm tier-save">저장</button>
    </div></div>`;
}

/** 편집기 안의 줄을 읽는다. 저장하지 않은 입력이 줄 추가·삭제로 날아가지 않게 그리기 전에도 읽는다. */
function readTierRows(box) {
  return [...box.querySelectorAll(".tier-body tr[data-tier]")].map((tr) => ({
    to:    Math.max(1, Number(tr.querySelector(".t-to").value) || 0),
    coins: Math.max(0, Number(tr.querySelector(".t-coins").value) || 0),
    hints: Math.max(0, Number(tr.querySelector(".t-hints").value) || 0),
    autos: Math.max(0, Number(tr.querySelector(".t-autos").value) || 0),
  }));
}

/** 화면의 보상 편집기마다 줄 추가·삭제·저장을 건다. 랭킹 메뉴 세 탭이 같이 쓴다. */
function bindTierEditors() {
  document.querySelectorAll(".tier-editor").forEach((box) => {
    const key = box.dataset.tierkey;
    const keep = (tiers) => {
      const en = box.querySelector(".t-enabled");
      CONFIG = { ...CONFIG, [key]: { ...(CONFIG?.[key] || {}), tiers, ...(en ? { enabled: en.checked } : {}) } };
      render();
    };
    box.querySelector(".tier-add").onclick = () => {
      const tiers = readTierRows(box);
      const last = tiers.length ? tiers[tiers.length - 1].to : 0;
      keep([...tiers, { to: last + 1, coins: 0, hints: 0, autos: 0 }]);
    };
    box.querySelectorAll("[data-tier-del]").forEach((b) => {
      b.onclick = () => keep(readTierRows(box).filter((_, k) => k !== Number(b.dataset.tierDel)));
    });
    box.querySelector(".tier-save").onclick = () => saveRankRewards(box);
  });
}

/**
 * 표를 읽어 서버에 올린다.
 *
 * **`to` 오름차순으로 세워서 보낸다.** 서버는 「등수를 덮는 첫 줄」을 고르는데,
 * 순서가 뒤섞여 있으면 사람이 의도한 줄과 다른 줄이 걸린다.
 */
async function saveRankRewards(box) {
  const key = box.dataset.tierkey, label = box.dataset.tierlabel;
  const tiers = readTierRows(box).sort((a, b) => a.to - b.to);

  // 같은 등수가 두 줄이면 뒤의 줄은 영영 안 걸린다 — 조용히 죽는 설정은 만들지 않는다.
  const dup = tiers.find((t, i) => i > 0 && t.to === tiers[i - 1].to);
  if (dup) return alert(`「${dup.to}등까지」 줄이 두 개입니다. 한 줄로 합쳐 주세요.`);

  const last = tiers.length ? tiers[tiers.length - 1].to : 0;
  if (last > 100 && !confirm(`${last}등까지 줍니다. 앱 랭킹 목록은 100명까지라 101등부터는 보상은 받아도 목록에는 안 보입니다. 그래도 저장할까요?`)) return;
  const en = box.querySelector(".t-enabled");
  if (!confirm(`${label} 랭킹: ${en && !en.checked ? "보상을 끕니다.\n\n" : ""}${last}등까지 보상을 줍니다.\n\n` +
               tiers.map((t) => `  ~${t.to}등: 코인 ${t.coins}` +
                 (t.hints || t.autos ? ` · 힌트 ${t.hints} · 자동배치 ${t.autos}` : "")).join("\n") +
               `\n\n${key === "rank_rewards" ? "앱의 보상 안내 문구도 이대로 바뀝니다. " : ""}저장할까요?`)) return;

  const value = { ...(CONFIG?.[key] && typeof CONFIG[key] === "object" ? CONFIG[key] : {}), tiers };
  if (en) value.enabled = en.checked;
  await act(() => rpc("admin_set_config", { p_key: key, p_value: value }), refresh);
}

/**
 * 업데이트 관문. 숫자는 Android versionCode / iOS 빌드 번호다.
 *
 * 사람이 읽는 1.1.2가 아니라 정수로 비교한다 — 문자열 버전 비교는 "1.10 < 1.9"가 되는
 * 함정이 있어 반드시 틀린다. 0은 "검사 안 함"이다.
 */
function updateTab(err) {
  if (err) {
    return loadFail("설정을 불러오지 못했습니다.", err, "sql/migrations/013_app_config.sql");
  }
  const g = (k, p) => Number(CONFIG?.[k]?.[p] ?? 0);
  const url = (p) => String(CONFIG?.store_url?.[p] ?? "");
  const row = (p, label) => `
    <tr>
      <td><b>${label}</b></td>
      <td class="num"><input type="number" id="min_${p}" value="${g("min_version", p)}" style="width:90px"></td>
      <td class="num"><input type="number" id="latest_${p}" value="${g("latest_version", p)}" style="width:90px"></td>
      <td><input type="text" id="url_${p}" value="${esc(url(p))}" placeholder="앱 스토어 페이지 주소" style="width:100%"></td>
    </tr>`;
  // 칸이 길어 하위 탭으로 나눴다(2026-10-08). 여섯 칸을 다 그려 두고 고른 칸만 보인다.
  // 저장 버튼과 입력칸이 늘 문서에 있어서 저장 함수(saveVersions 등)와 배선은 예전 그대로다.
  // 칸을 옮겨도 아직 저장하지 않은 입력이 사라지지 않는다.
  const pane = (id, html) => `<div class="upd-pane" data-upd="${id}"${UPD_VIEW === id ? "" : " hidden"}>${html}</div>`;
  const tabs = `<div class="subtabs stick">${UPD_VIEWS.map(([k, label]) =>
    `<button type="button" class="${UPD_VIEW === k ? "on" : ""}" data-updview="${k}">${label}</button>`).join("")}</div>`;
  return tabs + pane("ver", `
    <h2>앱 업데이트 요구</h2>
    <div class="notice">
      <b>업데이트 강제는 되돌리기 어렵습니다.</b>
      「꼭 있어야 하는 최소 빌드」를 지금 스토어에 나간 앱보다 높게 넣으면 <b>모든 사람이 앱을 못 씁니다.</b>
      새 버전이 스토어 심사를 통과해 내려받을 수 있게 된 뒤에 올리세요. 0이면 검사하지 않습니다.
    </div>
    <div>
    <div class="table-scroll"><table style="min-width:640px">
      <thead><tr>
        <th>기기</th><th class="num">꼭 있어야 하는 최소 빌드${infoTip("이 번호보다 낮은 앱은 업데이트하기 전까지 쓸 수 없습니다. 0이면 검사하지 않습니다.")}</th>
        <th class="num">권하는 최신 빌드${infoTip("이 번호보다 낮은 앱에는 업데이트를 권하는 안내가 뜹니다. 앱은 계속 쓸 수 있습니다.")}</th><th>스토어 주소${infoTip("업데이트 안내에서 「업데이트」를 누르면 열리는 스토어 페이지입니다.")}</th>
      </tr></thead>
      <tbody>${row("android", "AOS")}${row("ios", "iOS")}</tbody>
    </table></div>
    <div class="muted" style="font-size:12.5px;margin-top:6px">숫자는 빌드 번호입니다. 예: 1.5.1은 52${infoTip("빌드 번호는 앱을 스토어에 올릴 때마다 하나씩 붙는 숫자입니다. 사람이 읽는 1.5.1 같은 버전과 따로 셉니다.")}</div>
    <div class="toolbar save-bar"><button class="sm" id="saveVersions">저장</button></div>
    </div>
    <div class="muted" style="font-size:12.5px;margin-bottom:var(--gap)">1.5.0을 낼 때 할 일: 새 앱이 충분히 퍼지면 최소 빌드를 올려 1.4.4에 남은 오늘의 퍼즐 도구 사용 길을 닫습니다.
      이벤트 번호가 여섯 자리가 되기 전에도 올립니다.</div>

    <h2>점검 모드</h2>
    ${maintenanceBanner()}
    <div class="notice">
      켜면 앱이 안내 문구를 띄우고 <b>랭킹과 같이하기만</b> 잠급니다.
      인터넷 없이 하는 레벨 진행은 막지 않습니다. 서버에 닿지 못하는 앱도 막히지 않습니다.
      <br>앱이 <b>1분 안에</b> 스스로 알아챕니다. 사용자가 앱을 껐다 켤 필요는 없습니다.
    </div>
    <div class="toolbar">
      <label class="switch">
        <input type="checkbox" id="maintOn" ${CONFIG?.maintenance?.on ? "checked" : ""}>
        <span>지금 점검 중으로 바꾸기</span>
      </label>
      <!-- input[type=text]은 줄바꿈을 담지 못해 엔터를 쳐도 한 줄로 붙었다
           (사용자 제보). 앱은 두 줄 이상도 그대로 그리므로 textarea로 바꾼다. -->
      <textarea id="maintMsg" rows="2" placeholder="앱에 띄울 안내 문구. 비우면 기본 문구, 줄을 바꿔 써도 됩니다"
                style="flex:1;resize:vertical;font:inherit">${esc(CONFIG?.maintenance?.message || "")}</textarea>
      <button class="sm" id="saveMaint">저장</button>
    </div>
    <div class="toolbar">
      <span class="muted">점검 예약 · 한국시간, 비우면 예약 없음</span>
      <input type="datetime-local" id="maintFrom" value="${esc(CONFIG?.maintenance?.starts_at || "")}">
      <span class="muted">~</span>
      <input type="datetime-local" id="maintTo" value="${esc(CONFIG?.maintenance?.ends_at || "")}">
      <!-- 저장은 원래 윗줄에만 있었다. 같은 함수가 예약까지 함께 저장하는데도,
           **예약을 입력하는 줄에 버튼이 없으니** 시간을 넣고 그냥 넘어가게 된다
           (사용자 제보: 시간을 넣었는데 서버에 안 들어가 있었다).
           두 버튼 다 이 화면의 점검 설정을 통째로 저장한다. -->
      <button class="sm" id="saveMaintSched">저장</button>
    </div>
    <div class="muted" style="margin-top:-6px;font-size:12px">
      예약을 넣으면 그 시간 동안 앱이 알아서 점검 상태가 됩니다. 위 스위치를 켤 필요는 없습니다.
      <b>시각을 넣은 뒤 저장을 눌러야</b> 반영됩니다.
    </div>`)
    + pane("daily", cfgEditor("daily_record"))
    + pane("number", cfgEditor("number_mode"))
    + pane("level", cfgEditor("level_mode"))
    + pane("notify", cfgEditor("mailbox_rank_push"))
    + pane("etc", `
    <h2>서버 주소 옮기기</h2>
    <div class="notice">
      <b>평소에는 비워 두세요.</b> 서버를 다른 곳으로 옮길 때만 씁니다. 값을 넣으면 앱이 <b>다음에 켤 때부터</b> 그 주소로 접속합니다.
      옛 주소를 닫기 전까지는 두 주소가 <b>모두 살아 있어야</b> 합니다.
      잘못 넣어도 앱은 세 번 실패하면 원래 주소로 스스로 돌아옵니다.
    </div>
    <div class="toolbar">
      <input type="text" id="apiUrl" placeholder="예: https://api.내도메인.com · 비우면 기본 주소"
             value="${esc(String(CONFIG?.api_url ?? ""))}" style="flex:1">
      <button class="danger sm" id="saveApiUrl">저장</button>
    </div>

    <h2>코인 급증 기준</h2>
    <div class="toolbar">
      <span class="muted">한 사람이 오늘 번 코인이 이 값 이상이면 「이상 징후」에 올립니다. 예: 3000이면 하루 3,000코인 이상 번 사람</span>
      <input type="number" id="anomalyTh" value="${Number(CONFIG?.anomaly_threshold ?? 3000)}" style="width:110px">
      <button class="sm" id="saveAnomaly">저장</button>
    </div>`);
}

/** 업데이트·게임 설정의 하위 탭. 고른 칸은 기기에 적어 두고 다음에 열 때 그 칸부터 보인다. */
const UPD_VIEWS = [["ver", "버전·점검"], ["daily", "기록전"], ["number", "숫자 퍼즐"], ["level", "레벨 판·코인"],
                   ["notify", "알림"], ["etc", "기타"]];
const UPD_STORE = "dogadm.updateView";
let UPD_VIEW = (() => { const v = loadStore(UPD_STORE, "ver"); return UPD_VIEWS.some(([k]) => k === v) ? v : "ver"; })();

/** 지금 점검이 걸려 있는지 한눈에. 스위치 하나만 보고는 "켠 건지 껐는지"를
 *  매번 다시 읽어야 했다(사용자 지적: "풀렸는지 안 풀렸는지 알 수가 없어").
 *  예약이 걸려 있으면 스위치가 꺼져 있어도 그 시간에는 점검이라, 그것도 같이 적는다. */
/**
 * 상단 메뉴.
 *
 * 예전에는 탭 9개가 한 줄에 늘어서 있었다. 좁은 화면에서는 가로로 밀려 나 뒤쪽 탭이
 * 안 보였고, "지금 어디를 보는지"보다 "무엇이 있는지" 찾는 데 시간이 더 들었다.
 *
 * 순서는 자주 쓰는 것부터다(사용자 지시): 차트 → 같이하기 → 회원.
 * 나머지는 **결로 묶었다.**
 *   기록 — 지나간 걸 훑어보는 자리(읽기 전용): 행동 로그·구매·관리 기록
 *   운영 — 앱에 지시를 내리는 자리(설정을 바꿈): 업데이트·공지·서버 상태
 * 이 구분이 있으면 "위험한 버튼이 어디 있나"를 메뉴 이름만 보고 안다.
 */
const NAV = [
  { id: "charts", label: "차트" },
  { id: "ranking", label: "랭킹" },
  { id: "liveevents", label: "이벤트" },
  { label: "같이하기", items: [["versus", "현황"], ["versusset", "설정"]] },
  { label: "회원", items: [["players", "회원 목록"], ["rewards", "보상"]] },
  { label: "기록", items: [["events", "앱 사용 기록"], ["purchases", "결제"], ["audit", "관리 기록"]] },
  { label: "운영", items: [["anomaly", "이상 징후"], ["update", "업데이트·게임 설정"],
                          ["notices", "공지"], ["push", "푸시"], ["server", "서버 상태"]] },
];

let SRV = null, WINNERS = [], TRANSFERS = [], COIN_AUDIT = [];
/** 최근 랭킹 보상 지급(107 admin_rank_grants). 못 읽었으면 null. */
let GRANTS = null;
/** 지급 줄의 랭킹 이름. */
const GRANT_KIND = { today: "오늘 점수", daily_time: "기록전", number: "숫자 퍼즐", event: "이벤트" };

/** 최근 랭킹 보상 표. 수령은 받음 · 우편함 대기(기한) · 기한 지남. */
function grantsTable() {
  if (!GRANTS.length) return '<div class="empty">이 기간에 나간 랭킹 보상이 없습니다</div>';
  const now = Date.now();
  const rec = (g) => g.record_value == null ? "—"
    : g.kind === "daily_time" ? fmtDur(g.record_value) : g.kind === "event" ? `${fmt(g.record_value)}판` : fmt(g.record_value);
  return `<div class="table-scroll"><table>
    <thead><tr><th>보상 보낸 날</th><th>랭킹</th><th>기간</th><th class="c fit">등수</th><th>닉네임</th><th class="num">기록</th><th>보상</th><th class="c">받았나</th></tr></thead>
    <tbody>${moreRows("grants", GRANTS.map((g) => `<tr>
      <td class="muted">${esc(fmtDate(g.created_at))}</td>
      <td>${esc(GRANT_KIND[g.kind] || g.kind)}</td>
      <td>${esc(g.kind === "event" ? `#${g.period_key} ${g.event_name || ""}` : g.kind === "number" ? numberPeriodLabel(g.period_key) : g.period_key)}</td>
      <td class="c fit">${g.rank}등</td>
      <td>${g.profile_id ? `<button class="plink" data-member="${esc(g.profile_id)}">${esc(g.username || String(g.profile_id).slice(0, 8))}</button>` : '<span class="muted">탈퇴</span>'}</td>
      <td class="num">${rec(g)}</td>
      <td>${rewardText(g)}</td>
      <td class="c">${g.claimed_at ? `<span class="muted">받음 ${esc(fmtDate(g.claimed_at))}</span>`
        : g.claim_until && new Date(g.claim_until).getTime() <= now ? '<span class="pill heart" style="margin-left:0">기한 지남</span>'
        : `<span class="pill warn" style="margin-left:0">우편함에 있음</span>${g.claim_until ? `<div class="muted" style="font-size:11px">${esc(fmtDateTime(g.claim_until))}까지</div>` : ""}`}</td>
    </tr>`))}</tbody></table></div>${moreBar("grants", GRANTS.length)}`;
}
/** 오늘 랭킹 화면. 077이 있어야 채워진다. */
let RANKING = [], RANK_STATS = [], RANK_TOTAL = 0;
/** 빈 문자열이면 **한국시간 오늘**이다(서버가 정한다). */
let RANK_DATE = "", RANK_PAGE = 0;
const RANK_SIZE = 50;
/** 날짜별 기록이 **언제부터** 있나(080). 빈 문자열이면 아직 모른다 —
 *  서버가 080 전이거나 조회가 실패한 경우다. */
let RANK_SINCE = "";
/** 수상자 표를 며칠치 볼지. 예전에는 14일 고정이었다. */
let WINNER_DAYS = 14;
/** 062 — 「장난」 전체 스위치. 키가 없는 서버에서는 켜진 것으로 본다(서버와 같은 규칙). */
let EV_ON = true;
/** 「장난」(061) — 14종. 기간과 on/off를 여기서 만진다. */
let VS_EVENTS = [];

/**
 * 랭킹 화면 — **앱이 보는 것과 같은 모집단**이다(077).
 *
 * ⚠️ **회원 목록과 다르다.** 회원 목록은 점수가 0인 사람도 들어 있고, 정렬도
 * profiles의 값을 그대로 쓴다. 여기는 「그 날짜 + 점수 1 이상」만 세고 등수도
 * `get_rank`와 같은 방식으로 매긴다 — 사용자가 앱에서 보는 등수와 일치한다.
 */
function rankingTab(err) {
  if (err) {
    return loadFail("랭킹을 불러오지 못했습니다.", err, "sql/migrations/077_admin_daily_ranking.sql");
  }
  const today = kstToday();
  const day = RANK_DATE || today;
  const stat = RANK_STATS.find((r) => String(r.day).slice(0, 10) === day);
  // 집계 줄은 점수를 낸 사람이 있는 날에만 있다(080). 없는 날의 최고·평균을 0으로 적으면 0점을 낸 것처럼 읽힌다.
  const score = (k) => (stat && Number(stat.players) > 0 && stat[k] != null ? fmt(stat[k]) : "—");

  const cards = `
    <div class="cards">
      <div class="card"><div class="label">점수를 낸 사람</div><div class="value">${fmt(RANK_TOTAL)}</div></div>
      <div class="card"><div class="label">최고 점수</div><div class="value">${score("top_score")}</div></div>
      <div class="card"><div class="label">평균 점수</div><div class="value">${score("avg_score")}</div></div>
      <div class="card"><div class="label">가운데 사람 점수</div><div class="value">${score("median_score")}</div></div>
    </div>`;

  const days = RANK_STATS.map((r) => String(r.day).slice(5, 10));
  const charts = RANK_STATS.length ? `
    <h3 class="sub" style="margin-top:4px">날마다 점수를 낸 사람</h3>
    ${lineChart(days, [
      { name: "점수를 낸 사람", color: "#7aa2f7", values: RANK_STATS.map((r) => Number(r.players)) },
    ])}
    <h3 class="sub">날마다 최고 · 평균 · 가운데 사람 점수</h3>
    ${lineChart(days, [
      { name: "최고", color: "#d9a441", values: RANK_STATS.map((r) => Number(r.top_score)) },
      { name: "평균", color: "#17b3a8", values: RANK_STATS.map((r) => Number(r.avg_score)) },
      { name: "가운데 사람", color: "#9a8cff", values: RANK_STATS.map((r) => Number(r.median_score)) },
    ])}`
    : `<div class="empty">모은 숫자가 없습니다</div>`;

  const rows = RANKING.length ? `<div class="table-scroll"><table style="min-width:720px">
      <thead><tr>
        <th class="num fit">등수</th><th>닉네임</th><th class="num">오늘 점수</th>
        <th class="num">누적 점수</th><th class="num">코인</th>
        <th>보상</th><th class="c fit">받았나</th>
      </tr></thead>
      <tbody>${moreRows(`rank.today|${RANK_DATE}|${RANK_PAGE}`, RANKING.map((r) => `<tr>
        <td class="num fit">${r.rank}</td>
        <td>${esc(r.username || "— (탈퇴)")}
          ${r.supporter ? '<span class="pill heart">응원</span>' : ""}</td>
        <td class="num">${fmt(r.daily_score)}</td>
        <td class="num muted">${fmt(r.total_score)}</td>
        <td class="num muted">${r.coins == null ? "—" : fmt(r.coins)}</td>
        <td class="muted">${r.reward_coins == null ? "—"
          : `코인 ${fmt(r.reward_coins)}` +
            ((r.reward_hints || r.reward_autos)
              ? ` · 힌트 ${r.reward_hints} · 자동배치 ${r.reward_autos}` : "")}</td>
        <td class="c fit">${r.reward_coins == null ? '<span class="muted">—</span>'
            : r.claimed ? '<span class="muted">받아 감</span>'
                        : '<span class="pill heart" title="아직 안 받았거나, 받을 기한이 지나 사라졌습니다">안 받음</span>'}</td>
      </tr>`))}</tbody></table></div>${moreBar(`rank.today|${RANK_DATE}|${RANK_PAGE}`, RANKING.length)}`
    : (RANK_SINCE && day < RANK_SINCE)
      ? `<div class="empty">${day}은 <b>기록을 남기기 전</b>입니다.
         날짜별 기록은 ${RANK_SINCE}부터 있습니다</div>`
      : `<div class="empty">그날 점수를 낸 사람이 없습니다</div>`;

  // 50명씩 끊어 받는다. 전체 수를 알고 있으므로 몇 쪽인지 바로 쓸 수 있다.
  const pages = Math.max(1, Math.ceil(RANK_TOTAL / RANK_SIZE));
  const paging = pages > 1 ? `
    <div class="toolbar">
      <button class="sm" id="rankPrev" ${RANK_PAGE === 0 ? "disabled" : ""}>이전</button>
      <span class="muted">${RANK_PAGE + 1} / ${pages}쪽 · ${fmt(RANK_TOTAL)}명</span>
      <button class="sm" id="rankNext" ${RANK_PAGE + 1 >= pages ? "disabled" : ""}>다음</button>
    </div>` : "";

  return `
    <div class="notice">
      <b>앱 랭킹 화면과 같은 목록입니다.</b> 그 날짜에 점수를 1점 이상 낸 사람만 셉니다.
      점수가 0인 사람까지 들어 있는 회원 목록과는 인원이 다릅니다.
      <br>앱은 이 중 <b>100명까지</b> 보여 줍니다. 그보다 아래인 사람은 앱에서
      「내 순위 N위」 줄로만 자기 등수를 봅니다.
      <br><b>지난 날짜도 정확합니다.</b> 날짜마다 점수를 따로 남기므로, 그 사람이 다음 날 다시 들어와도
      지난 날짜의 점수는 그대로 있습니다.
      ${RANK_SINCE
        ? `기록은 <b>${RANK_SINCE}</b>부터 있습니다. 그 전 날짜는 1~10등만
           「운영 → 서버 상태」의 최근에 나간 랭킹 보상 표에 남아 있습니다.`
        : `<b>서버가 아직 날짜마다 점수를 남기지 않습니다.</b> 지금 보이는 지난 날짜는
           그 뒤로 다시 들어오지 않은 사람만 남은 숫자라 참고만 하세요. 개발 담당에게 전할 단서: 080`}
    </div>
    <div class="toolbar">
      <input type="date" id="rankDate" value="${day}" max="${today}"
             ${RANK_SINCE ? `min="${RANK_SINCE}"` : ""}>
      <button class="sm" id="rankToday">오늘</button>
      <div style="flex:1"></div>
      <span class="muted">보는 날짜 ${day} · 한국시간</span>
    </div>
    ${cards}
    ${sec("rank.today.charts", "날마다 점수를 낸 사람 · 최고 · 평균 · 최근 14일", charts)}
    ${sec("rank.today.list", `점수를 낸 사람 · ${fmt(RANK_TOTAL)}명`, `${paging}${rows}${paging}`, { open: true })}`;
}

/**
 * 오늘(또는 고른 날) 랭킹 참가자.
 *
 * ⚠️ **회원 목록과 모집단이 다르다.** 여기는 앱과 같은 조건으로 센다 —
 * 「그 날짜에 점수 1 이상」인 사람만. 회원 목록은 점수가 0인 사람도 들어 있다.
 *
 * ⚠️ **500명이 상한이 아니다.** 50명씩 끊어 받는다(`p_offset`).
 * 한 번에 다 내려받으면 브라우저가 먼저 죽는다.
 */
async function loadRanking() {
  try {
    RANKING = await rpc("admin_daily_ranking", {
      p_date: RANK_DATE || null,
      p_limit: RANK_SIZE,
      p_offset: RANK_PAGE * RANK_SIZE,
    }) || [];
    RANK_TOTAL = RANKING.length ? Number(RANKING[0].total_count) || 0 : 0;
    RANK_STATS = await rpc("admin_daily_ranking_stats", { p_days: 14 }) || [];
    // 080 전 서버에는 이 함수가 없다. 화면이 죽지 않게 조용히 빈 값으로 둔다 —
    // 관리자 페이지는 서버보다 먼저 배포될 수 있다(loadServer와 같은 태도).
    const since = await rpc("admin_daily_ranking_since").catch(() => null);
    RANK_SINCE = since ? String(since).slice(0, 10) : "";
    return null;
  } catch (e) {
    RANKING = []; RANK_STATS = []; RANK_TOTAL = 0; RANK_SINCE = "";
    return e;
  }
}

/** 052·054가 있어야 채워진다. 없는 서버에서는 조용히 빈 값으로 두고 안내만 띄운다 —
 *  관리자 페이지는 서버보다 먼저 배포될 수 있다. */
async function loadServer() {
  try {
    SRV = (await rpc("admin_server_status").catch(() => []))[0] || null;
    WINNERS = await rpc("admin_daily_winners", { p_days: WINNER_DAYS }).catch(() => []) || [];
    // 107: 오늘 점수 · 기록전 · 숫자 · 이벤트 지급을 한 표로. 없는 서버면 null이고 옛 표를 그린다.
    GRANTS = await rpc("admin_rank_grants", { p_days: WINNER_DAYS }).catch(() => null);
    TRANSFERS = await rpc("admin_transfers", { p_limit: 50 }).catch(() => []) || [];
    COIN_AUDIT = await rpc("admin_coin_audit", { p_min_gap: 2000, p_limit: 100 })
                   .catch(() => []) || [];
    return null;
  } catch (e) { return e; }
}

/**
 * 서버 상태 — 지금까지 어디서도 볼 수 없던 것들을 모았다.
 *
 * 마이그레이션 현황을 맨 위에 두는 이유: "051 적용했나요?"를 사람에게 물어봐야 했던
 * 자리다. 관리자 화면이 답해야 하는 질문이라 제일 먼저 답한다.
 */
function serverTab(err) {
  if (err) return loadFail("서버 상태를 불러오지 못했습니다.", err);
  const mig = SRV ? `
    <div class="cards">
      <div class="card"><div class="label">서버에 적용된 업데이트 파일</div>
        <div class="value">${fmt(SRV.applied)} / ${fmt(SRV.total)}</div></div>
    </div>
    ${(SRV.missing || []).length
      ? `<div class="notice" style="border-color:var(--danger);color:var(--danger)">
           <b>아직 서버에 적용 안 된 파일이 있습니다.</b> 개발 담당에게 알려 주세요: ${(SRV.missing || []).map(esc).join(", ")}
         </div>`
      : `<div class="notice">빠진 파일이 없습니다. 서버가 최신입니다.</div>`}`
    : `<div class="empty">서버가 이 정보를 아직 주지 않습니다. 개발 담당에게 전할 단서: 052</div>`;

  const audit = COIN_AUDIT.length ? `<div class="table-scroll"><table style="min-width:720px" data-z="cols">
      <thead><tr><th>닉네임</th><th class="num">앱이 알린 잔액</th><th class="num">기록으로 계산한 잔액</th>
        <th class="num">차이</th><th class="num">번 코인</th><th class="num">쓴 코인</th>
        <th class="num">받은 보상</th><th>가입한 날</th></tr></thead>
      <tbody>${moreRows("srv.audit", COIN_AUDIT.map((r) => `<tr>
        <td>${esc(r.username || "—")}</td>
        <td class="num">${fmt(r.actual)}</td>
        <td class="num">${fmt(r.expected)}</td>
        <td class="num" style="color:var(--danger);font-weight:800">+${fmt(r.gap)}</td>
        <td class="num">${fmt(r.earned)}</td>
        <td class="num">${fmt(r.spent)}</td>
        <td class="num">${fmt(r.granted)}</td>
        <td class="muted">${fmtDate(r.created_at)}</td>
      </tr>`))}</tbody></table></div>${moreBar("srv.audit", COIN_AUDIT.length)}`
    : `<div class="empty">잔액 차이가 큰 계정이 없습니다</div>`;

  // 065: 10등까지, 코인·아이템·수령 여부. 107 admin_rank_grants가 없는 서버에서만 쓰는 옛 표다.
  // 18절부터 랭킹 보상은 우편함으로 받고 기한은 정산된 날부터 7일이다.
  const winners = WINNERS.length ? `<div class="table-scroll"><table style="min-width:560px">
      <thead><tr><th>날짜</th><th class="c fit">등수</th><th>닉네임</th><th class="num">코인</th><th>아이템</th><th class="c fit">받았나</th></tr></thead>
      <tbody>${WINNERS.map((w) => `<tr>
        <td class="muted">${fmtDate(w.award_date)}</td>
        <td class="c fit">${w.rank}등</td>
        <td>${esc(w.username || "— (탈퇴)")}</td>
        <td class="num">${(w.coins ?? "").toLocaleString ? (w.coins).toLocaleString() : w.coins ?? ""}</td>
        <td class="muted">${(w.hints || w.autos) ? `힌트 ${w.hints} · 자동 ${w.autos}` : "—"}</td>
        <td class="c fit">${w.claimed ? '<span class="muted">받아 감</span>'
                        : '<span class="pill heart" title="아직 안 받았거나, 받을 기한이 지나 사라졌습니다">안 받음</span>'}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">아직 없습니다</div>`;

  const transfers = TRANSFERS.length ? `<div class="table-scroll"><table style="min-width:560px">
      <thead><tr><th>코드</th><th>닉네임</th><th>만든 날</th><th class="c fit">상태</th></tr></thead>
      <tbody>${TRANSFERS.map((t) => `<tr>
        <td><b>${esc(t.code)}</b></td>
        <td>${esc(t.username || "—")}</td>
        <td class="muted">${fmtDate(t.created_at)}</td>
        <td class="c fit">${t.used_at ? `<span class="muted">사용됨 ${fmtDate(t.used_at)}</span>`
              : t.expired ? '<span class="pill heart">기한 지남</span>'
              : '<span class="pill today">아직 안 씀</span>'}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">만든 코드가 없습니다</div>`;

  // 덩어리마다 접는 칸(2026-10-08). 맨 위 서버 업데이트 상태만 처음에 펴 둔다.
  return `
    ${sec("server.migrations", "서버 업데이트 상태", `
    <div class="muted" style="margin-bottom:6px">서버 구조를 바꾸는 파일이 몇 개 적용됐는지 봅니다. 빠진 파일이 있으면 개발 담당에게 알려 주세요.</div>
    ${mig}`, { open: true, note: SRV ? `${fmt(SRV.applied)} / ${fmt(SRV.total)}` : "" })}

    ${sec("server.coinAudit", "코인 잔액 맞춰 보기", `
    <div class="muted" style="margin-bottom:6px">
      운영 → <b>이상 징후</b>에 같은 표가 다른 항목과 함께 있습니다.</div>
    <div class="notice">
      앱이 알려 온 잔액과, <b>앱이 보낸 코인 기록으로 계산한 잔액</b>을 나란히 봅니다. 차이가 크게 플러스면
      기록 없이 코인이 생긴 것입니다. <b>막지는 않고 보여 주기만 합니다.</b> 인터넷 없이 쓰고 늦게
      올라오거나 기기를 옮긴 직후에도 차이가 날 수 있어서 판단은 사람이 합니다.
      코인 기록은 30일만 남기므로 <b>가입한 지 오래된 계정일수록 차이가 크게 나옵니다.</b>
    </div>
    ${audit}`, { note: `${fmt(COIN_AUDIT.length)}건` })}

    ${sec("server.grants", "최근에 나간 랭킹 보상", `
    <div class="muted" style="font-size:12.5px;margin-bottom:6px">랭킹 보상 설정은 랭킹 메뉴로 옮겼습니다. 오늘 점수, 오늘의 퍼즐 기록, 숫자 퍼즐 탭 아래에 각각 있습니다.</div>
    <div class="toolbar">
      <select id="winnerDays">
        ${[7, 14, 30, 90].map((d) =>
          `<option value="${d}" ${d === WINNER_DAYS ? "selected" : ""}>최근 ${d}일</option>`).join("")}
      </select>
    </div>
    ${GRANTS ? grantsTable() : winners}`)}

    ${sec("server.transfers", "기기 옮기기 코드 · 최근 50건", transfers, { note: `${fmt(TRANSFERS.length)}건` })}

    ${sec("server.cleanup", "정리", `
    <div class="toolbar">
      <span class="muted">회원 정보가 만들어지지 않은 채 24시간 넘게 남은 빈 계정을 지웁니다. 남겨 두면 한 달 이용자 수가 부풀려집니다</span>
      <button class="danger sm" id="cleanupOrphans">빈 계정 정리</button>
    </div>`)}`;
}

/** 지금 봐야 할 것들. 054의 admin_alerts가 개수만 세어 준다. */
let ALERTS = null;

async function loadAlerts() {
  // 054 이전 서버에서는 함수가 없다. 그때는 종을 아예 안 그린다.
  ALERTS = (await rpc("admin_alerts", { p_coin_gap: 2000 }).catch(() => []))[0] || null;
}

/** 확인 표시. 서버에 알림 표가 따로 없어서(개수를 세어 만든 값이라) **그때의 개수**를
 *  기기에 적어 둔다. 개수가 그대로면 감추고, 늘거나 줄면 다시 보인다 — "확인했다"가
 *  영영 감추기가 되면 새로 생긴 일까지 놓친다. */
const SEEN_KEY = "dogadm.alertsSeen";

function seenMap() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); }
  catch { return {}; }
}

function markSeen(key, count) {
  const m = seenMap();
  m[key] = count;
  localStorage.setItem(SEEN_KEY, JSON.stringify(m));
}

const ALERT_ROWS = [
  ["coin_gap_players", "잔액이 안 맞는 계정", "anomaly"],
  ["open_reports", "처리 안 한 신고", "versus"],
  ["unclaimed_rewards", "아직 안 받아 간 보상", "rewards"],
  ["stale_rooms", "버려진 대전 방", "versus"],
];

/** 종 메뉴가 열려 있는지. 다시 그려도(확인을 눌러도) 열린 채로 둔다. */
let BELL_OPEN = false;

/** 아직 확인 안 한 것만. 개수가 0인 항목은 애초에 알릴 게 없다. */
function pendingAlerts() {
  if (!ALERTS) return [];
  const seen = seenMap();
  return ALERT_ROWS
    .map(([k, label, tabId]) => [k, label, tabId, Number(ALERTS[k] || 0)])
    .filter(([k, , , n]) => n > 0 && seen[k] !== n);
}

/**
 * 관리자 이메일 옆 알림 종.
 *
 * 왜 필요한가 — 신고·미수령 보상·잔액 이상은 각각 다른 탭에 흩어져 있어서, 무슨 일이
 * 생겼는지 알려면 탭을 하나씩 눌러 봐야 했다. 봐야 할 게 있다는 사실 자체를 한 곳에서
 * 알려 준다.
 *
 * 종에는 **숫자만** 붙이고, 목록은 마우스를 올리거나 눌렀을 때만 펼친다(사용자 지시).
 * 줄마다 "확인"이 있어서 눌러 두면 그 개수인 동안은 다시 안 뜬다.
 */
function alertBell() {
  if (!ALERTS) return "";
  const rows = pendingAlerts();
  const total = rows.reduce((a, r) => a + r[3], 0);
  const list = rows.length
    ? rows.map(([k, label, tabId, n]) => `<div class="line">
        <button class="go" data-tab="${tabId}">${label} <b>${fmt(n)}</b></button>
        <button class="seen" data-seen="${k}" data-seen-n="${n}">확인</button>
      </div>`).join("")
    : `<div class="empty">지금은 확인할 것이 없습니다</div>`;
  // 종은 "무엇이 몇 건"까지만 말한다. 자세히 보려면 한 페이지에 모아 둔 곳으로 보낸다.
  const more = `<div class="line" style="border-top:1px solid var(--line);margin-top:4px">
      <button class="go" data-tab="anomaly">이상 징후 모두 보기</button></div>`;
  return `<div class="bell${BELL_OPEN ? " open" : ""}">
    <button class="top" title="확인할 것">확인할 것${total
      ? `<span class="pill heart" style="margin-left:4px">${fmt(total)}</span>` : ""}</button>
    <div class="menu">${list}${more}</div>
  </div>`;
}

/**
 * 종 묶기. 「확인」은 **종만 그 자리에서** 다시 그리고 메뉴를 연 채로 둔다. 화면 전체를 다시 그리면
 * 메뉴가 사라지는 순간 휴대폰이 손가락 아래 새 버튼(뒤의 카드·탭)에 누름을 한 번 더 보냈다.
 */
function bindBell() {
  const bell = document.querySelector(".bell");
  if (!bell) return;
  bell.querySelector(".top").onclick = (e) => {
    e.stopPropagation();
    BELL_OPEN = !BELL_OPEN;
    bell.classList.toggle("open", BELL_OPEN);
  };
  bell.querySelectorAll("[data-seen]").forEach((b) => {
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      markSeen(b.dataset.seen, Number(b.dataset.seenN));
      BELL_OPEN = true;
      bell.outerHTML = alertBell();
      bindBell();
    };
  });
  bell.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); BELL_OPEN = false; TAB = b.dataset.tab; refresh(); };
  });
}

// 메뉴 묶음 바깥을 누르면 닫는다. 한 번만 단다.
document.addEventListener("click", (e) => {
  if (e.target.closest(".nav > .item > .top:not([data-tab])")) return;
  document.querySelectorAll(".nav > .item.open").forEach((x) => x.classList.remove("open"));
});

// 종 바깥을 누르면 닫는다. 한 번만 단다.
document.addEventListener("click", (e) => {
  if (!BELL_OPEN || e.target.closest(".bell")) return;
  BELL_OPEN = false;
  document.querySelector(".bell")?.classList.remove("open");
});

function navBar() {
  return `<nav class="nav">${NAV.map((g) => {
    if (!g.items) {
      return `<div class="item"><button class="top ${TAB === g.id ? "on" : ""}"
                data-tab="${g.id}">${g.label}</button></div>`;
    }
    const active = g.items.some(([id]) => id === TAB);
    return `<div class="item">
      <button class="top ${active ? "on" : ""}">${g.label}<span class="caret">▾</span></button>
      <div class="menu">${g.items.map(([id, label]) =>
        `<button class="${TAB === id ? "on" : ""}" data-tab="${id}">${label}</button>`).join("")}</div>
    </div>`;
  }).join("")}</nav>`;
}

function maintenanceBanner() {
  const m = CONFIG?.maintenance || {};
  const on = m.on === true;
  const sched = m.starts_at && m.ends_at ? `${m.starts_at} ~ ${m.ends_at}` : "";
  return `<div class="notice" style="${on
      ? "border-color:var(--danger);color:var(--danger);font-weight:800"
      : ""}">
    지금 상태: <b>${on ? "점검 중. 앱의 랭킹과 같이하기가 잠겨 있습니다" : "정상. 잠긴 것 없음"}</b>
    ${sched ? `<br><span class="muted">예약: ${esc(sched)} · 한국시간</span>` : ""}
  </div>`;
}

async function saveMaintenance() {
  const on = $("#maintOn").checked;
  const message = $("#maintMsg").value.trim();
  const starts_at = $("#maintFrom").value || "";
  const ends_at = $("#maintTo").value || "";
  if (starts_at && ends_at && starts_at >= ends_at) { alert("점검 예약의 끝이 시작보다 빠릅니다"); return; }
  // 켤 때만 묻고 끌 때는 안 물었다 — 푼 줄 알았는데 안 풀렸는지, 실수로 풀었는지
  // 알 길이 없었다(사용자 지적). 양쪽 다 묻고, 지금 상태는 위 배너로 늘 보인다.
  const was = CONFIG?.maintenance?.on === true;
  if (on && !was && !confirm("점검 모드를 켭니다.\n\n모든 앱에서 랭킹과 같이하기가 잠기고 안내 문구가 뜹니다.\n앱은 1분 안에 따라옵니다.")) return;
  if (!on && was && !confirm("점검 모드를 풉니다.\n\n랭킹과 같이하기가 다시 열립니다.")) return;
  await act(() => rpc("admin_set_config", {
    p_key: "maintenance", p_value: { on, message, starts_at, ends_at },
  }), refresh);
}

async function saveApiUrl() {
  const v = $("#apiUrl").value.trim();
  if (v && !/^https:\/\/[a-z0-9.-]+$/i.test(v)) {
    alert("https://api.내도메인.com 처럼 주소 이름까지만 넣어 주세요. 뒤에 / 나 경로를 붙이면 안 됩니다");
    return;
  }
  if (v && !confirm(
    `앱이 다음에 켤 때부터 ${v} 로 접속합니다.\n\n` +
    `이 주소가 지금 살아 있는지 확인하셨나요?\n` +
    `옛 주소도 당분간 함께 살려 두어야 합니다.`)) return;
  await act(() => rpc("admin_set_config", { p_key: "api_url", p_value: v }), refresh);
}

async function saveAnomalyThreshold() {
  const th = Math.max(1, Number($("#anomalyTh").value) || 3000);
  await act(() => rpc("admin_set_config", { p_key: "anomaly_threshold", p_value: th }), refresh);
}

async function saveVersions() {
  const num = (id) => Math.max(0, Number($("#" + id).value) || 0);
  const min = { android: num("min_android"), ios: num("min_ios") };
  const latest = { android: num("latest_android"), ios: num("latest_ios") };
  const store = { android: $("#url_android").value.trim(), ios: $("#url_ios").value.trim() };

  const on = Math.max(min.android, min.ios) > 0;
  if (on && !confirm(
    `꼭 있어야 하는 최소 빌드를 AOS ${min.android}, iOS ${min.ios}로 정합니다.\n\n` +
    `이 번호보다 낮은 앱은 바로 쓸 수 없게 됩니다.\n` +
    `새 버전이 스토어에서 내려받을 수 있는 상태인지 확인하셨나요?`)) return;

  await act(async () => {
    await rpc("admin_set_config", { p_key: "min_version", p_value: min });
    await rpc("admin_set_config", { p_key: "latest_version", p_value: latest });
    await rpc("admin_set_config", { p_key: "store_url", p_value: store });
  }, refresh);
}

/**
 * 대전 기능을 켜고 끈다. 끄면 앱 대기화면에서 버튼이 사라진다.
 *
 * **성패를 돌려준다** — 부르는 쪽(토글)이 취소·실패일 때만 눌린 것을 물려야 하는데,
 * act()가 오류를 alert으로 삼켜서 그냥은 알 길이 없다.
 */
async function toggleVersus() {
  const next = !VS_ON;
  if (!confirm(next
    ? "같이하기를 켭니다.\n\n앱 대기화면에 버튼이 나타납니다."
    : "같이하기를 끕니다.\n\n앱에서 버튼이 사라집니다. 이미 진행 중인 방은 그대로 끝납니다.")) return false;
  let ok = false;
  await act(async () => {
    await rpc("admin_set_config", { p_key: "versus_enabled", p_value: next });
    ok = true;   // refresh가 실패해도 저장은 된 것이다 — 물리면 오히려 거짓말이 된다
  }, refresh);
  return ok;
}

/**
 * 062 — 「장난」 전체를 한 번에. 개별 on/off와 기간은 건드리지 않아 되켜면 그대로 돌아온다.
 *
 * ⚠️ **DB와 코드는 events다**(versus_events·pick_round_events·versus_events_on).
 * **화면에서만 「장난」**이라 부른다 — "사건"은 사고·범죄처럼 들리는데 열넷 중 다섯은
 * 선물·연장 같은 좋은 것이라 담기지 않는다. 앱도 같은 말을 쓴다(versus_pranks).
 *
 * ⚠️ **이건 전체 스위치다.** 068부터는 방장도 방마다 끌 수 있고, **둘 다 켜져야** 나온다.
 */
async function toggleVersusEvents() {
  const next = !EV_ON;
  if (!confirm(next
    ? "「장난」을 켭니다.\n\n다음 판부터 판마다 5개가 다시 뽑힙니다.\n판 시작 전 기다리는 시간도 6초에서 8초로 늘어 장난을 읽을 틈이 생깁니다.\n\n방장이 방마다 따로 끌 수도 있고, 그렇게 끈 방은 그대로 꺼진 채입니다."
    : "「장난」을 끕니다.\n\n다음 판부터 선물·안개 같은 것이 하나도 안 나옵니다.\n판 시작 전 기다리는 시간은 8초에서 6초로 줄어듭니다.\n개별 설정과 기간은 그대로 남아, 다시 켜면 지금 상태로 돌아옵니다.")) return false;
  let ok = false;
  await act(async () => {
    await rpc("admin_set_config", { p_key: "versus_events_on", p_value: next });
    ok = true;
  }, refresh);
  return ok;
}

/**
 * 같이하기 **설정** — 스위치만 모아 둔 자리.
 *
 * 왜 나눴나 (사용자 지시: "사용량을 보는 곳과 관리를 하는건 분리 해야지")
 *   예전에는 현황·신고·방 목록·집계와 스위치가 한 페이지에 다 있어서 화면이 길었고,
 *   무엇보다 **구경하러 들어간 자리에 위험한 버튼이 섞여 있었다.** 여기는 앱 동작을
 *   바꾸는 곳, 현황은 보는 곳이다.
 */
function versusSetupTab() {
  // 상태 글자와 동작 버튼을 나란히 두면 어느 쪽이 지금 상태인지 매번 다시 읽어야
  // 한다(사용자 지적). 토글은 손잡이 위치가 곧 상태다 — 옆 글자는 확인용이다.
  const sw = (label, on, id, note) => `
    <div class="toolbar">
      <span style="min-width:120px"><b>${label}</b></span>
      <label class="tgl">
        <input type="checkbox" id="${id}" ${on ? "checked" : ""}>
        <span class="tgl-track"><span class="tgl-thumb"></span></span>
        <b class="tgl-state" style="color:${on ? "var(--accent)" : "var(--dim)"}">${on ? "켜짐" : "꺼짐"}</b>
      </label>
      <span class="muted" style="font-size:12.5px">${note}</span>
    </div>`;
  return `
    <h2>켜고 끄기</h2>
    ${sw("같이하기", VS_ON, "toggleVersus",
         "끄면 앱에서 같이하기 버튼이 사라집니다. 앱은 켤 때 이 값을 읽어서, 이미 켜져 있는 앱은 다시 켜야 바뀝니다.")}
    ${sw("장난", EV_ON, "toggleVsEvents",
         "대전 중에 끼어드는 선물·안개 같은 깜짝 효과입니다. 다음 판부터 바뀌고, 진행 중인 판은 그대로 끝납니다. 방장이 방마다 따로 끌 수도 있습니다.")}
    ${EV_ON ? "" : `<div class="notice">장난 전체가 꺼져 있어서 아래 하나하나의 설정은 지금 아무 효과가 없습니다.
        다시 켜면 아래 상태 그대로 돌아옵니다.</div>`}
    ${versusEventsTable()}`;
}

/** 이상 징후 탭의 나머지 셋. 잔액 대조는 서버 상태 탭, 신고·방치된 방은 같이하기 탭에서만 받아 와서
 *  그 탭을 먼저 안 열면 카드가 0이었다. 종은 서버 개수(admin_alerts)를 보니 둘이 어긋났다(2026-10-05 제보). */
async function loadAnomalyExtras() {
  COIN_AUDIT = await rpc("admin_coin_audit", { p_min_gap: 2000, p_limit: 100 }).catch(() => []) || [];
  MATCH = (await rpc("admin_matching_stats").catch(() => []))[0] || null;
  REPORTS = await rpc("admin_reports", { p_limit: 100 }).catch(() => []) || [];
}

/**
 * 이상 징후 — 봐야 할 것만 한 페이지에.
 *
 * 왜 필요한가 (사용자 요청)
 *   코인 급증은 상단 배너, 잔액 대조는 서버 상태 탭, 신고와 방치된 방은 같이하기 탭에
 *   흩어져 있었다. "지금 이상한 게 있나?"를 알려면 세 곳을 돌아야 했다.
 *
 * 여기서는 **고치지 않는다.** 처리 버튼은 각자의 관리 자리에 그대로 두고, 여기서는
 * 무엇이 몇 건인지만 보여 준 뒤 그 자리로 보낸다.
 */
function anomalyTab() {
  const th = Number(CONFIG?.anomaly_threshold ?? 3000) || 3000;
  const openReports = REPORTS.filter((r) => !r.handled_at).length;
  const stale = Number(MATCH?.stale_rooms || 0);
  const card = (label, n, tab) => `
    <div class="card"><div class="label">${label}</div>
      <div class="value" style="${n > 0 ? "color:var(--danger)" : ""}">${fmt(n)}</div>
      ${n > 0 && tab ? `<button class="ghost sm" data-tab="${tab}">보러 가기</button>` : ""}</div>`;

  const anomalies = ANOMALIES.length ? `<div class="table-scroll"><table style="min-width:420px">
      <thead><tr><th>닉네임</th><th class="num">오늘 번 코인</th><th>가입한 날</th></tr></thead>
      <tbody>${ANOMALIES.map((a) => `<tr>
        <td>${esc(a.username || "—")}</td>
        <td class="num" style="color:var(--danger);font-weight:800">${fmt(a.earned_today)}</td>
        <td class="muted">${fmtDate(a.created_at)}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">오늘 ${fmt(th)}코인 넘게 번 계정이 없습니다</div>`;

  const audit = COIN_AUDIT.length ? `<div class="table-scroll"><table style="min-width:640px" data-z="cols">
      <thead><tr><th>닉네임</th><th class="num">앱이 알린 잔액</th><th class="num">기록으로 계산한 잔액</th>
        <th class="num">차이</th><th class="num">번 코인</th><th class="num">쓴 코인</th></tr></thead>
      <tbody>${moreRows("anom.audit", COIN_AUDIT.map((r) => `<tr>
        <td>${esc(r.username || "—")}</td>
        <td class="num">${fmt(r.actual)}</td>
        <td class="num">${fmt(r.expected)}</td>
        <td class="num" style="color:var(--danger);font-weight:800">+${fmt(r.gap)}</td>
        <td class="num">${fmt(r.earned)}</td>
        <td class="num">${fmt(r.spent)}</td>
      </tr>`))}</tbody></table></div>${moreBar("anom.audit", COIN_AUDIT.length)}`
    : `<div class="empty">잔액이 어긋난 계정이 없습니다</div>`;

  return `
    <div class="cards">
      ${card("코인을 갑자기 많이 번 계정", ANOMALIES.length, null)}
      ${card("잔액이 안 맞는 계정", COIN_AUDIT.length, null)}
      ${card("처리 안 한 신고", openReports, "versus")}
      ${card("버려진 대전 방", stale, "versus")}
    </div>
    ${sec("anomaly.coins", `오늘 코인을 ${fmt(th)}개 이상 번 계정`, `
    <div class="muted" style="margin-bottom:6px">기준 숫자는 운영 → 업데이트·게임 설정의 「기타」 칸 「코인 급증 기준」에서 바꿉니다.</div>
    ${anomalies}`, { open: true, note: `${fmt(ANOMALIES.length)}건` })}
    ${sec("anomaly.audit", "잔액이 안 맞는 계정 · 막지 않고 보여 주기만", `
    <div class="muted" style="margin-bottom:6px">
      앱이 알린 잔액이 기록으로 계산한 잔액보다 2,000 넘게 많은 계정입니다. 휴대폰 시계를 돌렸거나 결제를 취소한 경우가 섞였을 수 있습니다.</div>
    ${audit}`, { note: `${fmt(COIN_AUDIT.length)}건` })}`;
}

/**
 * 「장난」(061) 표.
 *
 * 여기서 끄면 **다음 판부터** 안 뽑힌다. 이미 시작된 판은 서버가 뽑아 둔 목록으로
 * 끝까지 간다 — 판 도중에 규칙이 바뀌면 그게 더 이상하다.
 *
 * 각 갈래(이로움·해로움·중립)에 **최소 두 개는 남겨 둬야 한다.** 뽑기가 2·2·1이라
 * 한 갈래가 두 개 미만이면 그 판은 사건이 다섯 개가 안 된다.
 */
/**
 * 사건 14종의 **앱에 보이는 모습** — 아이콘·이름·설명.
 *
 * 왜 여기에 또 적나
 *   DB에는 `code`와 `title_key`(ev_lock)만 있다. 사람이 읽는 이름은 앱의 Localization
 *   안에 있어서, 관리자 페이지는 보여 줄 한글 이름을 애초에 가진 적이 없었다.
 *   그래서 표에 `autodog` 같은 코드만 떴고, 어느 사건을 끄는 건지 알 수 없었다
 *   (2026-08-17 지적). 아이콘도 앱과 같은 것을 써야 "화면에서 본 그것"과 이어진다.
 *
 * **앱 문구가 원본이다.** 여기를 고칠 일이 생기면 Localization.kt / Localization.swift의
 * ev_* 값을 함께 고쳐야 한다. 어긋나면 관리자에서 끈 사건과 사용자가 본 사건이
 * 서로 다른 이름으로 불린다.
 */
//
// **이모지를 쓰지 않는다**(사용자 지시, 2026-09-13). 앱은 이미 손그림 PNG를
// 쓰는데 관리자 화면만 이모지면, 「안개」가 앱에서는 파스텔 구름이고 여기서는
// 🌫️라서 같은 것을 말하는지 눈으로 확인할 수가 없다.
//
// ⚠️ **여기 이름은 앱의 drawable 이름 그대로다**(ev_fog ↔ R.drawable.ev_fog ↔
// iOS의 evFog). 사건을 새로 만들면 `admin/img/`에도 같은 이름으로 넣어야 한다 —
// `admin/sync_img.py`가 앱 그림에서 줄여 만든다.
const EV_INFO = {
  gift:     ["ev_gift",     "선물",     "모두 뼈다귀를 하나 더 받았어요"],
  extend:   ["ev_extend",   "연장",     "제한 시간이 10초 늘었어요"],
  reveal:   ["ev_reveal",   "살짝 귀띔", "정답 칸 하나가 잠깐 보여요"],
  autodog:  ["ev_autodog",  "저절로",   "댕댕이 한 마리가 알아서 앉았어요"],
  lens:     ["ev_lens",     "돋보기",   "구역 경계가 또렷해졌어요"],
  fog:      ["ev_fog",      "안개",     "잠시 판이 뿌옇게 가려져요"],
  eraser:   ["ev_eraser",   "지우개",   "찍어 둔 X 표시가 절반 지워졌어요"],
  lock:     ["ev_lock",     "구역 잠금", "한 구역이 잠시 잠겼어요"],
  thief:    ["ev_thief",    "뼈 도둑",  "모두 뼈다귀를 하나 잃었어요"],
  thin_ice: ["ev_thin_ice", "살얼음",   "잠시 실수하면 뼈다귀를 두 개 잃어요"],
  gray:     ["ev_gray",     "암전",     "잠시 색이 사라져요"],
  shake:    ["ev_shake",    "흔들흔들", "판이 잠시 흔들려요"],
  flip:     ["ev_flip",     "거꾸로",   "판이 잠시 좌우로 뒤집혀 보여요"],
  flash:    ["ev_flash",    "번쩍",     "완성된 판이 아주 잠깐 스쳐 가요"],
};

/** 앱 그림 한 장. 이름은 앱의 drawable 이름과 같다. */
function appIcon(name, px = 22, alt = "") {
  return `<img src="img/${name}.png" alt="${esc(alt)}" width="${px}" height="${px}"
               style="object-fit:contain;vertical-align:middle" loading="lazy">`;
}

function versusEventsTable() {
  if (!VS_EVENTS.length) return "";
  const KIND = { buff: "이로움", debuff: "해로움", neutral: "중립" };
  // 「설정」 칸의 항목 이름(061 versus_events.config). 모르는 항목은 그대로 보인다.
  const CONF = { bones: ["뼈다귀", "개"], seconds: ["시간", "초"], cells: ["칸", "개"], ratio: ["비율", "%"] };
  const confText = (c) => Object.entries(c || {}).map(([k, v]) => k === "duration_ms" ? `지속 ${msText(v)}`
    : CONF[k] ? `${CONF[k][0]} ${v}${CONF[k][1]}` : `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
  const CLS = { buff: "today", debuff: "heart", neutral: "" };
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");
  const now = Date.now();

  // 갈래마다 몇 개가 살아 있는지 — 두 개 미만이면 경고한다.
  const alive = {};
  for (const e of VS_EVENTS) {
    const on = e.enabled
      && (!e.starts_at || new Date(e.starts_at).getTime() <= now)
      && (!e.ends_at || new Date(e.ends_at).getTime() > now);
    if (on) alive[e.category] = (alive[e.category] || 0) + 1;
  }
  const need = { buff: 2, debuff: 2, neutral: 1 };
  const short = Object.entries(need).filter(([k, v]) => (alive[k] || 0) < v);
  const warn = short.length
    ? `<div class="notice" style="border-color:var(--danger);color:var(--danger)">
         ${short.map(([k, v]) => `${KIND[k]}이 ${v}개 이상 켜져 있어야 합니다. 지금 ${alive[k] || 0}개`).join(" · ")}
         <br>부족하면 그 판은 장난이 다섯 개가 안 됩니다.</div>`
    : "";

  return `<h2>장난</h2>
  <div class="muted" style="font-size:12.5px;margin-bottom:8px">
    판마다 <b>이로움 2개, 해로움 2개, 중립 1개</b>를 뽑습니다. 하나를 끄면 다음 판부터 뽑지 않습니다.
  </div>${warn}
  <div class="table-scroll"><table>
    <thead><tr><th class="c fit">갈래</th><th>이름</th><th>세기</th><th>켜 둘 기간</th><th class="c fit">상태</th><th>관리</th></tr></thead>
    <tbody>${VS_EVENTS.map((e) => {
      const started = !e.starts_at || new Date(e.starts_at).getTime() <= now;
      const ended = e.ends_at && new Date(e.ends_at).getTime() <= now;
      const on = e.enabled && started && !ended;
      const state = !e.enabled ? "꺼짐" : ended ? "기간 끝" : !started ? "기간 전" : "켜짐";
      // 목록에 없는 코드는 **DB에만 있고 앱은 모르는 사건**이다. 물음표로 눈에 띄게 둔다 —
      // 조용히 코드만 보여 주면 왜 앱에서 아무 일도 안 일어나는지 알 수 없다.
      const info = EV_INFO[e.code] || ["ev_unknown", e.code, "앱이 모르는 장난입니다. 켜도 앱에서 아무 일이 없습니다"];
      return `<tr>
        <td class="c fit"><span class="pill ${CLS[e.category] || ""}">${KIND[e.category] || e.category}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            ${appIcon(info[0], 26, info[1])}
            <div>
              <b>${esc(info[1])}</b>
              <div class="muted" style="font-size:12px">${esc(info[2])}</div>
              <div class="muted" style="font-size:11px;opacity:.7">${esc(e.code)}</div>
            </div>
          </div>
        </td>
        <td class="muted">${esc(confText(e.config))}</td>
        <td class="muted">${when(e.starts_at)} ~ ${when(e.ends_at)}</td>
        <td class="c fit">${on ? '<b style="color:var(--accent)">켜짐</b>' : `<span class="muted">${state}</span>`}</td>
        <td><div class="actions">
          <button class="ghost sm" data-evtoggle="${e.id}">${e.enabled ? "끄기" : "켜기"}</button>
          <button class="ghost sm" data-evwhen="${e.id}">기간 정하기</button>
        </div></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

function versusTab(err) {
  if (err) {
    return loadFail("대전 기록을 불러오지 못했습니다.", err, "sql/migrations/014_versus.sql");
  }
  const totalMatches = VS_DAILY.reduce((a, r) => a + Number(r.matches || 0), 0);
  const matchPanel = MATCH ? `
    <h2>모르는 사람과 붙기 현황</h2>
    <div class="cards">
      <div class="card"><div class="label" title="누가 대전을 찾으면 알려 달라고 신청해 둔 사람">상대 오면 알림 신청한 사람</div><div class="value">${fmt(MATCH.waiting_people)}</div></div>
      <div class="card"><div class="label">누구나 들어올 수 있는 방</div><div class="value">${fmt(MATCH.public_rooms)}</div></div>
      <div class="card"><div class="label">버려진 방</div>
        <div class="value" style="${Number(MATCH.stale_rooms) > 0 ? "color:var(--danger)" : ""}">${fmt(MATCH.stale_rooms)}</div></div>
      <div class="card"><div class="label">빈 방</div>
        <div class="value" style="${Number(MATCH.empty_rooms) > 0 ? "color:var(--danger)" : ""}">${fmt(MATCH.empty_rooms)}</div></div>
      <div class="card"><div class="label">처리 안 한 신고</div>
        <div class="value" style="${Number(MATCH.open_reports) > 0 ? "color:var(--danger)" : ""}">${fmt(MATCH.open_reports)}</div></div>
    </div>
    <div class="toolbar">
      <button class="danger sm" id="purgeRooms">버려진 방 정리</button>
      <span class="muted">사람이 없는 방은 지우고, 30분 넘게 아무 움직임이 없는 방은 닫습니다</span>
    </div>` : "";

  const reportsTable = REPORTS.length ? `
    <h2>신고 · 처리 안 한 것 ${REPORTS.filter((r) => !r.handled_at).length}건</h2>
    <div class="table-scroll"><table style="min-width:640px">
      <thead><tr><th>날짜</th><th>신고당한 사람</th><th>신고한 사람</th><th>방</th><th class="c fit">상태</th><th>관리</th></tr></thead>
      <tbody>${REPORTS.map((r) => `<tr>
        <td class="muted">${fmtDate(r.created_at)}</td>
        <td><b>${esc(r.target_name || "(삭제됨)")}</b></td>
        <td class="muted">${esc(r.reporter_name || "-")}</td>
        <td class="muted">${esc(r.room_code || "-")}</td>
        <td class="c fit">${r.handled_at ? '<span class="muted">처리함</span>' : '<span class="pill heart">처리 전</span>'}</td>
        <td><div class="actions">
          ${r.handled_at ? "" : `
            <button class="ghost sm" data-report-ok="${r.id}" title="아무것도 바꾸지 않고 처리한 것으로만 표시합니다">문제없음으로 처리</button>
            <button class="danger sm" data-report-rename="${r.id}" title="신고당한 사람의 닉네임을 임의 이름으로 바꿉니다">닉네임 강제 변경</button>`}
        </div></td>
      </tr>`).join("")}</tbody>
    </table></div>` : "";

  const roomsTable = VS_ROOMS.length ? `
    <h2>지금 열려 있는 방 · ${VS_ROOMS.length}개</h2>
    <div class="table-scroll"><table style="min-width:560px">
      <thead><tr><th>방 코드</th><th class="c fit">상태</th><th class="num">지금 판 / 최대 판</th><th class="num">인원</th>
                 <th class="c fit">장난</th><th>참가자</th><th>만든 날</th><th>관리</th></tr></thead>
      <tbody>${VS_ROOMS.map((r) => `<tr>
        <td><b>${esc(r.code)}</b></td>
        <td class="c fit">${r.status === "playing" ? "대전 중" : "사람 기다리는 중"}</td>
        <td class="num">${r.round_no}/${r.win_target * 2 - 1}</td>
        <td class="num">${r.players}</td>
        <!-- 070. **꺼진 방만 눈에 띄게** 적는다 — 켜진 것이 기본이라 전부 칠하면
             무엇이 예외인지 안 보인다. 070 이전 서버는 값이 없으므로 켜진 것으로 본다. -->
        <td class="c fit">${r.events_on === false
              ? `<span style="color:var(--danger)">꺼짐</span>` : `<span class="muted">켜짐</span>`}</td>
        <td class="muted">${esc(r.usernames || "")}</td>
        <td class="muted">${fmtDate(r.created_at)}</td>
        <td><button class="danger sm" data-close-room="${esc(r.code)}">방 닫기</button></td>
      </tr>`).join("")}</tbody>
    </table></div>` : `<h2>지금 열려 있는 방</h2><div class="empty">없습니다</div>`;
  return `
    ${VS_ON ? "" : `<div class="notice" style="border-color:var(--danger);color:var(--danger)">
        같이하기가 <b>꺼져 있습니다.</b> 같이하기 → 설정에서 켤 수 있습니다.</div>`}
    ${matchPanel}
    ${roomsTable}
    ${reportsTable}
    <div class="cards">
      <div class="card" data-z><div class="label">30일 동안 한 판 수</div><div class="value">${fmt(totalMatches)}</div></div>
      <div class="card" data-z><div class="label">대전에 참여한 회원</div><div class="value">${fmt(VS_PLAYERS.length)}</div></div>
    </div>
    <h2>날마다 판 수 · 참여한 사람 · 비긴 판</h2>
    ${versusDailyChart()}
    <h2>대전 방식마다 · 30일</h2>
    ${versusModesSection()}
    <h2>판 크기마다</h2>
    ${VS_BOARDS.length
      ? barChart(sumBy(VS_BOARDS, (r) => `${r.board_n}×${r.board_n}`, (r) => Number(r.matches)))
      : `<div class="empty">아직 없습니다</div>`}
    <h2>회원마다 전적</h2>
    ${versusPlayersTable()}`;
}

/** 같은 이름끼리 더해서 barChart가 먹는 모양으로 만든다.
 *  051부터 서버가 모드까지 쪼개 주므로, 판 크기 그래프는 여기서 다시 합쳐야 한다. */
function sumBy(rows, keyOf, valOf) {
  const acc = new Map();
  for (const r of rows) acc.set(keyOf(r), (acc.get(keyOf(r)) || 0) + valOf(r));
  return [...acc].map(([bucket, players]) => ({ bucket, players }));
}

function modeLabel(mode) {
  return mode === "trio" ? "1:1:1"
       : mode === "team" ? "2:2"
       : mode === "coop" ? "2:2 협동"
       : mode === "duo"  ? "1:1"
       : mode || "—";
}

/** 051부터 일자별이 (날짜 × 모드)로 온다. 선 그래프는 날짜 단위라 다시 합친다.
 *  무승부 선을 같이 그리는 이유: 무승부가 갑자기 늘면 제한 시간이 짧다는 신호다. */
function versusDailyChart() {
  if (!VS_DAILY.length) return `<div class="empty">아직 한 판도 없습니다</div>`;
  const days = [...new Set(VS_DAILY.map((r) => r.day))].sort();
  const pick = (field) => days.map((d) =>
    VS_DAILY.filter((r) => r.day === d)
            .reduce((sum, r) => sum + Number(r[field] || 0), 0));
  return lineChart(days, [
    { name: "판 수", color: "#17b3a8", values: pick("matches") },
    { name: "참여한 사람", color: "#7aa2f7", values: pick("players") },
    { name: "비긴 판", color: "#e0af68", values: pick("draws") },
  ]);
}

/** 모드별 — "협동을 붙였는데 사람들이 하기는 하나"에 답하는 자리.
 *  이탈을 같이 보는 이유: 판수만 많고 중간에 다 나가는 모드는 재미가 아니라
 *  사람을 붙잡아 두는 시간만 쓰고 있는 것이다. */
function versusModesSection() {
  if (!VS_MODES.length) {
    return `<div class="empty">아직 모은 숫자가 없습니다. 개발 담당에게 전할 단서: 051</div>`;
  }
  const chart = barChart(VS_MODES.map((r) => ({
    bucket: modeLabel(r.mode), players: Number(r.matches),
  })));
  const table = `<div class="table-scroll"><table style="min-width:520px" data-z="rows cols">
    <thead><tr>
      <th>대전 방식</th><th class="num">판 수</th><th class="num">참여한 사람</th>
      <th class="num">비긴 판</th><th class="num">중간에 나간 판</th><th class="num">평균 시간</th>
    </tr></thead>
    <tbody>${VS_MODES.map((r) => `<tr>
      <td>${esc(modeLabel(r.mode))}</td>
      <td class="num">${fmt(r.matches)}</td>
      <td class="num">${fmt(r.players)}</td>
      <td class="num">${fmt(r.draws)}</td>
      <td class="num">${fmt(r.dnf)}</td>
      <td class="num">${r.avg_ms ? (r.avg_ms / 1000).toFixed(1) + "초" : "—"}</td>
    </tr>`).join("")}</tbody></table></div>`;
  return chart + table;
}

/** 승/패/무는 앱 랭킹과 **같은 셈법**이다(051) — 두 화면이 다른 숫자를 말하면
 *  문의가 들어왔을 때 어느 쪽이 맞는지부터 다퉈야 한다.
 *
 *  그래도 **평균 등수를 남겨 둔다.** 다인전에서는 인원이 늘수록 승률이 자동으로
 *  낮아져서, 승률만으로는 잘하는 사람과 못하는 사람이 구분되지 않는다.
 *
 *  `?? r.firsts` / `== null` 갈래는 051 이전 서버를 위한 것이다 — 관리자 페이지는
 *  앱과 달리 배포가 서버보다 먼저 나갈 수 있어서, 없는 칸에 undefined가 찍히면
 *  표 전체가 "undefined"로 덮인다. */
function versusPlayersTable() {
  if (!VS_PLAYERS.length) return `<div class="empty">기록이 아직 없습니다</div>`;
  return `<div class="table-scroll"><table style="min-width:820px" data-z="cols">
    <thead><tr>
      <th>닉네임</th><th class="num">판 수</th>
      <th class="num">이김</th><th class="num">짐</th><th class="num">비김</th>
      <th class="num">이긴 비율</th>
      <th class="num">2등</th><th class="num">3등</th>
      <th class="num">평균 등수</th><th class="num">끝까지 못 푼 판</th>
      <th class="num">가장 빠른 기록</th><th>마지막으로 한 날</th>
    </tr></thead>
    <tbody>${moreRows("vs.players", VS_PLAYERS.map((r) => `<tr>
      <td>${esc(r.username || "—")}</td>
      <td class="num">${fmt(r.played)}</td>
      <td class="num">${fmt(r.wins ?? r.firsts)}</td>
      <td class="num">${r.losses == null ? "—" : fmt(r.losses)}</td>
      <td class="num">${r.draws == null ? "—" : fmt(r.draws)}</td>
      <td class="num">${r.win_rate == null ? "—" : r.win_rate + "%"}</td>
      <td class="num">${fmt(r.seconds)}</td>
      <td class="num">${fmt(r.thirds)}</td>
      <td class="num">${r.avg_rank ?? "—"}</td>
      <td class="num">${fmt(r.dnf)}</td>
      <td class="num">${r.best_ms ? (r.best_ms / 1000).toFixed(1) + "초" : "—"}</td>
      <td>${fmtDate(r.last_played)}</td>
    </tr>`))}</tbody></table></div>${moreBar("vs.players", VS_PLAYERS.length)}`;
}

/**
 * 누를 수 있는 표 머리글 한 칸.
 *
 * 지금 세우는 기준에는 화살표를 붙인다 — 어느 칸으로 세웠는지 머리글만 보고 알아야
 * 선택 상자를 다시 확인하지 않는다. 결제 칸은 서버가 못 세우므로 이걸 안 쓴다.
 */
function th(col, label, cls) {
  const on = SORT_BY_COL[col] === SORT;
  const arrow = on ? (DESC ? " ↓" : " ↑") : "";
  // cls는 칸 정렬 class다(숫자 칸은 "num"). 값 칸과 같은 class를 줘야 머리글이 값 위에 선다.
  return `<th data-sort="${col}" class="sortable${on ? " on" : ""}${cls ? ` ${cls}` : ""}">`
       + `${label}${arrow}</th>`;
}

function playersTable() {
  const today = kstToday();
  const q = QUERY.trim().toLowerCase();
  // 닉네임뿐 아니라 프로필 id로도 찾는다 — 문의는 보통 id로 들어온다.
  const list = q ? PLAYERS.filter((p) =>
    (p.username || "").toLowerCase().includes(q) ||
    (p.id || "").toLowerCase().startsWith(q)) : PLAYERS;
  if (!list.length) return `<div class="empty">해당하는 회원이 없습니다</div>`;
  // 30줄씩 보이고(더 보기), 이 쪽에서 전부 0이거나 빈 숫자 칸은 숨긴다(2026-10-08).
  // 쪽·기준·찾기·조건이 바뀌면 다른 목록이라 다시 30줄부터 보인다.
  const key = `players|${PLAYER_PAGE}|${SORT}|${DESC}|${QUERY}|${PLAYER_FILTER ? PLAYER_FILTER.label : ""}`;
  return `<div class="table-scroll"><table class="members" data-z="cols">
    <thead><tr>
      <th class="nopin" style="width:34px"><input type="checkbox" id="pickAll" title="지금 보이는 줄만 고릅니다"></th>
      <th class="num fit">#</th>
      ${th("username", "닉네임", "pin")}
      ${th("level", "레벨", "num")}
      ${th("total", "누적 점수", "num")}
      ${th("daily", "오늘 점수", "num")}
      ${th("coins", "코인", "num")}
      ${th("vs", "대전 승-패-무", "num")}
      ${th("coop", "협동 이김 / 판", "num")}
      <th class="num">결제 합계</th>
      <th class="fit">앱 버전${infoTip("마지막으로 켠 앱의 기기와 버전입니다. 버전은 1.5.0부터 남고, 그 전 앱은 「1.4.4 이하」로 보입니다.")}</th>
      ${th("played", "마지막 플레이")}
      ${th("created", "가입한 때")}
      <th class="c fit">푸시${infoTip("「받음」은 광고성 정보 알림을 켠 지 2년이 안 됐고, 알림 받을 휴대폰이 서버에 등록된 회원입니다. 이런 회원에게만 푸시가 닿습니다.")}</th>
      <th>관리</th>
    </tr></thead><tbody>${moreRows(key, list.map((p, i) => {
      const played = p.daily_date === today && (p.daily_score || 0) > 0;
      return `<tr>
        <td class="nopin"><input type="checkbox" data-pick="${p.id}" ${SELECTED.has(p.id) ? "checked" : ""}></td>
        <td class="num muted fit">${i + 1}</td>
        <td class="pin">${esc(p.username || "(이름 없음)")}
          ${p.supporter ? '<span class="pill heart">응원</span>' : ""}
          ${played ? '<span class="pill today">오늘</span>' : ""}
          ${p.reset_requested_at ? '<span class="pill heart" title="다음에 앱을 켜면 게임이 처음부터 시작됩니다">게임 초기화 요청됨</span>' : ""}
          ${TEST_SET.has(String(p.id)) ? '<span class="pill dim">시험 계정</span>' : ""}</td>
        <td class="num">${p.max_level == null ? '<span class="muted">—</span>' : fmt(p.max_level)}</td>
        <td class="num">${fmt(p.total_score)}</td>
        <td class="num">${played ? fmt(p.daily_score) : '<span class="muted">—</span>'}</td>
        <td class="num">${p.coins == null ? '<span class="muted">—</span>' : fmt(p.coins)}</td>
        <td class="num">${p.vs_played == null ? '<span class="muted">—</span>'
          : Number(p.vs_played) === 0 ? '<span class="muted">0</span>'
          : `${fmt(p.vs_wins)}-${fmt(p.vs_losses)}-${fmt(p.vs_draws)}`}</td>
        <td class="num">${p.coop_played == null ? '<span class="muted">—</span>'
          : Number(p.coop_played) === 0 ? '<span class="muted">0</span>'
          : `${fmt(p.coop_wins)} / ${fmt(p.coop_played)}판`}</td>
        <td class="num wrap">${(() => {
          const t = PAY_TOTALS[p.id];
          return t ? `${money(t.revenue, t.currency)} <span class="muted" style="white-space:nowrap">· ${t.orders}건</span>`
                   : '<span class="muted">—</span>';
        })()}</td>
        <td class="fit">${appVersionCell(p.id)}</td>
        <td class="muted wrap">${fmtDate(p.daily_date)}
          ${p.coins_at ? `<div class="muted" style="font-size:11px">마지막 접속 ${
            // daily_date와 같은 날이면 시:분만, 다른 날이면 날짜까지 적는다.
            fmtDate(p.coins_at) === fmtDate(p.daily_date) ? fmtTime(p.coins_at)
                                                          : fmtDateTime(p.coins_at)}</div>` : ""}</td>
        <td class="muted wrap">${fmtDateTime(p.created_at)}</td>
        <td class="c fit">${REACH === null ? '<span class="muted" title="푸시를 받을 수 있는 회원 목록을 못 읽었습니다">?</span>'
          : REACH[p.id] ? `<span class="pill today" title="알림 켠 날 ${esc(fmtDate(REACH[p.id].consented_at))} · 휴대폰 ${REACH[p.id].devices}대">받음</span>`
                          : '<span class="muted" title="광고성 알림을 켜지 않았거나, 켠 지 2년이 지났거나, 알림 받을 휴대폰이 등록되어 있지 않습니다">—</span>'}</td>
        <td class="fit"><div class="actions" style="flex-wrap:nowrap">
          <button class="ghost sm" data-act="log" data-id="${p.id}">${OPEN_MEMBER === p.id ? "기록 접기" : "기록 보기"}</button>
          <button class="ghost sm" data-rowmenu="${p.id}" aria-haspopup="menu" aria-expanded="false"
                  title="닉네임, 점수, 보상, 초기화, 삭제 같은 관리 작업">관리<span class="caret">▾</span></button>
        </div></td>
      </tr>` + (OPEN_MEMBER === p.id ? memberEventsRow() : "");
    }))}</tbody></table></div>` + moreBar(key, list.length) + playersPaging();
}

/**
 * 회원 목록 쪽 넘기기. **전체 수를 모르면 안 그린다** — 옛 서버(079 이전)는
 * 그 값을 안 주는데, 그때 「1 / 1 쪽」이라고 적으면 거짓말이 된다.
 */
function playersPaging() {
  if (!PLAYER_TOTAL) return "";
  const pages = Math.max(1, Math.ceil(PLAYER_TOTAL / PLAYER_SIZE));
  if (pages <= 1) return `<div class="toolbar"><span class="muted">${fmt(PLAYER_TOTAL)}명</span></div>`;
  return `
    <div class="toolbar">
      <button class="sm" id="playerPrev" ${PLAYER_PAGE === 0 ? "disabled" : ""}>이전</button>
      <span class="muted">${PLAYER_PAGE + 1} / ${pages}쪽 · ${fmt(PLAYER_TOTAL)}명</span>
      <button class="sm" id="playerNext" ${PLAYER_PAGE + 1 >= pages ? "disabled" : ""}>다음</button>
    </div>`;
}

/** 회원 한 명의 최근 행동. 문의가 들어왔을 때 확인할 최소한의 창구다. */
function memberEventsRow() {
  const pays = MEMBER_PAYS.length
    ? `<div class="muted" style="font-size:12px;margin:2px 0 6px">결제한 것</div>
       <div class="table-scroll" style="margin-bottom:10px">
         <table style="min-width:380px"><tbody>${MEMBER_PAYS.map((p) => `<tr>
           <td class="muted">${new Date(p.created_at).toLocaleString("ko-KR")}</td>
           <td>${productName(p.product_id)}</td>
           <td class="num">${p.coins ? fmt(p.coins) : "—"}</td>
           <td class="num">${money(p.amount, p.currency)}</td>
           <td class="muted">${esc(PLATFORM_NAMES[p.store] || p.store)}</td>
         </tr>`).join("")}</tbody></table></div>`
    : "";
  const plays = `<div class="actions" style="margin:2px 0 8px">
      <span class="muted" style="font-size:12px;align-self:center">이 회원의 판 기록 보기</span>
      <button class="ghost sm" data-memplay="daily" data-id="${esc(OPEN_MEMBER)}">오늘의 퍼즐 기록</button>
      <button class="ghost sm" data-memplay="number" data-id="${esc(OPEN_MEMBER)}">숫자 퍼즐</button>
      <button class="ghost sm" data-memplay="event" data-id="${esc(OPEN_MEMBER)}">이벤트 산책길</button></div>`;
  const inner = plays + pays + (MEMBER_EVENTS.length
    ? `<div class="table-scroll" style="max-height:260px;overflow-y:auto">
         <table style="min-width:380px"><tbody>${MEMBER_EVENTS.map((e) => `<tr>
           <td class="muted">${new Date(e.created_at).toLocaleString("ko-KR")}</td>
           <td>${eventName(e.name)}</td>
           <td class="num">${e.value ?? ""}</td>
           <td class="muted">${esc(PLATFORM_NAMES[e.platform] || e.platform || "")}</td>
         </tr>`).join("")}</tbody></table></div>`
    : `<div class="muted" style="font-size:12.5px">앱이 보낸 사용 기록이 없습니다</div>`);
  return `<tr><td colspan="15" style="white-space:normal">${inner}</td></tr>`;
}

// 앱이 보내는 사용 기록 이름(SupabaseManager.logEvent). 모르는 이름은 그대로 보인다.
// 코인 쓴 곳 이름은 서버 admin_coin_sinks(100)와 같은 말이다.
const EVENT_NAMES = {
  app_open: "앱 켬", tutorial_start: "튜토리얼 시작", tutorial_done: "튜토리얼 끝냄", level_clear: "레벨 판 깸",
  purchase_remove_ads: "광고 제거 구매", coin_earned: "코인 얻음",
};
const EVENT_PARTS = {
  hints: "힌트", autos: "자동배치", revive: "부활", rename: "닉네임 변경", walk_bone: "산책 쉼터 뼈다귀",
  walk_continue: "산책 이어 걷기", hint: "힌트", auto: "자동배치", other: "기타", reset: "게임 초기화", import: "기기 옮김",
};
function eventName(name) {
  const n = String(name ?? "");
  const tail = (prefix) => EVENT_PARTS[n.slice(prefix.length)] ?? n.slice(prefix.length);
  const text = EVENT_NAMES[n]
    ?? (n.startsWith("coin_spent_") ? `코인 씀 · ${tail("coin_spent_")}`
      : n.startsWith("ad_watched_") ? `광고 봄 · ${tail("ad_watched_")}`
      : n.startsWith("coin_rebase_") ? `코인 다시 맞춤 · ${tail("coin_rebase_")}`
      : null);
  return text ? `${esc(text)} <span class="muted" style="font-size:11px">${esc(n)}</span>` : esc(n);
}

function eventsTable(err) {
  if (err) return loadFail("앱 사용 기록을 불러오지 못했습니다.", err, "supabase_admin_features.sql");
  if (!EVENTS.length) return `<div class="empty">아직 쌓인 앱 사용 기록이 없습니다. 앱이 기록을 보내기 시작하면 여기에 나타납니다.</div>`;
  const byDay = {};
  for (const e of EVENTS) (byDay[e.day] ??= []).push(e);
  // 14일치가 한 화면에 늘어서 길었다(2026-10-08). 날마다 접는 칸이고 가장 최근 날만 펴 둔다.
  // 칸 이름은 날짜가 아니라 위에서 몇 번째인지로 지어 기억이 날마다 쌓이지 않게 한다.
  return Object.entries(byDay).map(([day, list], i) => sec(`events.day${i}`, esc(day), `
    <div class="table-scroll"><table style="min-width:420px">
      <thead><tr><th>한 일</th><th class="num">횟수</th><th class="num">사람 수</th></tr></thead>
      <tbody>${list.map((e) => `<tr>
        <td>${eventName(e.name)}</td><td class="num">${fmt(e.count)}</td><td class="num">${fmt(e.users)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`, { open: i === 0, note: `${fmt(list.length)}가지` })).join("");
}

// 관리 기록의 작업 이름(admin_actions.action). 서버 admin_log를 부르는 곳의 이름과 짝이다. 모르는 이름은 그대로 보인다.
const AUDIT_NAMES = {
  set_scores: "점수 고침", set_username: "닉네임 바꿈", set_supporter: "응원 배지", delete_profile: "계정 삭제",
  reset_all_scores: "전체 점수 초기화", request_game_reset: "게임 초기화 요청", request_all_game_reset: "전체 게임 초기화 요청",
  cancel_game_reset: "게임 초기화 요청 거둠", grant_reward: "보상 줌", grant_reward_all: "모든 회원에게 보상 줌",
  revoke_batch: "보상 거둬들임", gift_push: "선물 도착 푸시", create_notice: "공지 올림", delete_notice: "공지 지움",
  set_notice_popup: "공지 창 띄우기 바꿈", notice_push: "공지 푸시", set_config: "설정 바꿈", force_rename: "닉네임 강제 변경",
  close_room: "대전 방 닫음", purge_rooms: "버려진 방 정리", cleanup_orphan_users: "빈 계정 정리",
  test_account_on: "시험 계정 지정", test_account_off: "시험 계정 풀기", rank_exclude: "랭킹에서 뺌",
  live_event_create: "이벤트 만듦", live_event_update: "이벤트 고침", live_event_end_now: "이벤트 지금 끝냄",
  live_event_cancel: "이벤트 취소", live_event_exclude: "이벤트 순위에서 뺌",
};
// 관리 기록 「내용」 칸의 항목 이름. 모르는 항목은 그대로 보인다.
const AUDIT_KEYS = {
  reason: "사유", note: "메모", value: "값", key: "설정", minutes: "분", affected: "대상 수", report: "신고 번호",
  id: "번호", coins: "코인", hints: "힌트", autos: "자동배치", memo: "메모", daily: "오늘 점수", total: "누적 점수",
  name: "이름", kind: "종류", event_id: "이벤트 번호", batch_id: "묶음 번호", notice_id: "공지 번호", code: "코드",
};
function auditDetail(d) {
  if (!d || typeof d !== "object") return esc(d ?? "");
  return Object.entries(d).map(([k, v]) =>
    `${esc(AUDIT_KEYS[k] || k)}: ${esc(v && typeof v === "object" ? JSON.stringify(v) : String(v))}`).join(" · ");
}

function auditTable(err) {
  // 조회 실패를 "기록 없음"으로 보여주면 원인을 영영 못 찾는다.
  if (err) return loadFail("관리 기록을 불러오지 못했습니다.", err, "supabase_admin_features.sql 끝까지, admin_actions 표와 읽기 정책");
  if (!AUDIT.length) return `<div class="empty">남은 관리 기록이 없습니다</div>`;
  // 작업 종류·대상으로 거른다. 100건 나열에서 원하는 한 건을 찾는 게 일이었다.
  const kinds = [...new Set(AUDIT.map((a) => a.action))].sort();
  const rows = AUDIT.filter((a) =>
    (!AUDIT_KIND || a.action === AUDIT_KIND) &&
    (!AUDIT_Q || (a.target_id || "").startsWith(AUDIT_Q) ||
      JSON.stringify(a.detail || {}).toLowerCase().includes(AUDIT_Q.toLowerCase())));
  return `<div class="toolbar">
    <select id="auditKind">
      <option value="">모든 작업</option>
      ${kinds.map((k) => `<option value="${esc(k)}" ${k === AUDIT_KIND ? "selected" : ""}>${esc(AUDIT_NAMES[k] || k)}</option>`).join("")}
    </select>
    <input type="search" id="auditQ" placeholder="회원 ID 앞부분이나 내용으로 찾기" value="${esc(AUDIT_Q)}">
    <span class="muted">${rows.length} / ${AUDIT.length}건</span>
  </div>
  <div class="table-scroll"><table>
    <thead><tr><th>시각</th><th>한 일</th><th>대상 회원 ID</th><th>내용</th></tr></thead>
    <tbody>${moreRows(`audit|${AUDIT_KIND}|${AUDIT_Q}`, rows.map((a) => `<tr>
      <td class="muted">${new Date(a.created_at).toLocaleString("ko-KR")}</td>
      <td>${esc(AUDIT_NAMES[a.action] || a.action)}</td>
      <td class="muted">${esc((a.target_id || "").slice(0, 8))}</td>
      <td class="muted long" style="max-width:520px">${auditDetail(a.detail)}</td>
    </tr>`))}</tbody></table></div>${moreBar(`audit|${AUDIT_KIND}|${AUDIT_Q}`, rows.length)}`;
}

/**
 * 묶음이 지금 어떤 상태인가.
 *
 * 회수는 **아직 안 받은 행만** 지운다(받아 간 코인은 기기에 들어가 있어 못 되돌린다).
 * 그래서 회수한 묶음은 "받아감 1 / 대상 19, 남은 건수 0"으로 남는다. 이걸 진행 중인
 * 것과 같은 목록에 두면 끝난 일이 계속 눈에 밟힌다(사용자 지적).
 */
function batchState(b, now) {
  const started = !b.starts_at || new Date(b.starts_at).getTime() <= now;
  const expired = b.expires_at && new Date(b.expires_at).getTime() <= now;
  const left = Number(b.pending_count || 0);
  // revoked_at은 059부터 채워진다. 그 전에 회수한 묶음은 null이라 숫자로 추측한다 —
  // 받아 간 사람이 대상보다 적은데 남은 건수가 0이면 회수됐거나 대상이 탈퇴한 것이다.
  const revoked = b.revoked_at || (left === 0 && Number(b.claimed_count || 0) < Number(b.target_count || 0));
  if (revoked) return { key: "revoked", label: "거둬들임", cls: "heart" };
  if (left === 0) return { key: "allDone", label: "모두 받아 감", cls: "" };
  if (expired) return { key: "expired", label: "기한 지남", cls: "heart" };
  if (!started) return { key: "notYet", label: "받기 시작 전", cls: "today" };
  return { key: "live", label: "받는 중", cls: "today" };
}

/** 아직 사람이 받아 갈 수 있는 묶음인가 — 이것만 "진행 중" 탭에 남는다. */
function isLiveBatch(st) { return st.key === "live" || st.key === "notYet"; }

/**
 * 보상 묶음 한 칸 — "코인 300 · 힌트 2".
 *
 * **이모지(🪙💡✨)를 쓰지 않는다**(사용자 지시, 2026-09-13). 앱의 보상 팝업은
 * 이미 같은 그림(coin_icon·hint·강아지)을 쓰고 있어서, 여기만 이모지면 보낸 것과
 * 받는 화면이 다른 물건처럼 보인다. ✨는 특히 무엇인지 알 수도 없었다 —
 * 앱에서 그 자리는 **강아지가 저절로 앉는 것**이다.
 *
 * 0이거나 없는 항목은 빼고 보여 준다.
 */
function rewardCells(b) {
  const parts = [
    b.coins && `${appIcon("coin_icon", 16, "코인")} ${fmt(b.coins)}`,
    b.hints && `${appIcon("hint", 16, "힌트")} ${fmt(b.hints)}`,
    b.autos && `${appIcon("dog_01", 16, "자동배치")} ${fmt(b.autos)}`,
  ].filter(Boolean);
  return parts.length
    ? `<span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap">${parts.join("")}</span>`
    : '<span class="muted">—</span>';
}

function batchesTable(shown) {
  if (!shown.length) return "";
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");
  return `<h2>모든 회원에게 준 보상</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>만든 때</th><th>보상</th><th>메모</th><th>받을 수 있는 기간</th>
      <th class="c fit">상태</th><th class="num">받아 간 사람 / 받을 사람</th><th>관리</th></tr></thead>
    <tbody>${shown.map(({ b, st }) => {
      const rows = `<tr>
        <td class="muted">${when(b.created_at)}</td>
        <td>${rewardCells(b)}</td>
        <td class="muted">${esc(b.memo || "")}</td>
        <td class="muted">${when(b.starts_at)} ~ ${when(b.expires_at)}</td>
        <td class="c fit"><span class="pill ${st.cls}">${st.label}</span>${
          st.key === "revoked" && b.revoked_at
            ? `<div class="muted" style="font-size:11px;margin-top:3px">${when(b.revoked_at)}${
                b.revoked_count != null ? ` · ${fmt(b.revoked_count)}건` : ""}</div>`
            : ""}</td>
        <td class="num">${fmt(b.claimed_count)} / ${fmt(b.target_count)}</td>
        <td><div class="actions">
          <button class="ghost sm" data-batch="${b.id}">${OPEN_BATCH === b.id ? "명단 접기" : "받는 사람 명단"}</button>
          ${Number(b.pending_count) > 0 ? `<button class="danger sm" data-revoke="${b.id}" title="아직 안 받아 간 사람의 보상을 거둬들입니다">안 받은 것 거두기</button>` : ""}
        </div></td>
      </tr>`;
      if (OPEN_BATCH !== b.id) return rows;
      const members = BATCH_MEMBERS.length
        ? BATCH_MEMBERS.map((m) => `<span class="mem ${m.claimed_at ? "got" : ""}">${esc(m.username || "—")}</span>`).join("")
        : '<span class="muted">명단이 없습니다</span>';
      return rows + `<tr><td colspan="7" style="white-space:normal">
        <div class="muted" style="font-size:12px;margin-bottom:6px">
          진하게 칠한 이름이 받아 간 사람입니다</div>${members}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

/**
 * 개별 지급 한 건의 상태. 묶음과 같은 말을 쓴다 — 같은 화면에서 다른 낱말을 쓰면
 * 두 표가 다른 것을 재는 것처럼 읽힌다.
 */
function rewardState(r, now) {
  if (r.claimed_at) return { key: "claimed", label: "받아 감", cls: "" };
  if (r.expires_at && new Date(r.expires_at).getTime() <= now) return { key: "expired", label: "기한 지남", cls: "heart" };
  if (r.starts_at && new Date(r.starts_at).getTime() > now) return { key: "notYet", label: "받기 시작 전", cls: "today" };
  return { key: "live", label: "아직 안 받아 감", cls: "today" };
}

function rewardsRows(shown) {
  if (!shown.length) return "";
  return `<h2>한 사람에게 준 보상</h2><div class="table-scroll"><table>
    <thead><tr><th>준 때</th><th>받는 사람</th><th class="num">코인</th>
      <th class="num">힌트</th><th class="num">자동배치</th>
      <th>메모</th><th class="c fit">상태</th></tr></thead>
    <tbody>${shown.map(({ r, st }) => {
      const who = PLAYERS.find((p) => p.id === r.profile_id);
      return `<tr>
        <td class="muted">${new Date(r.created_at).toLocaleString("ko-KR")}</td>
        <td>${esc(who?.username || (r.profile_id || "").slice(0, 8))}</td>
        <td class="num">${fmt(r.coins)}</td><td class="num">${fmt(r.hints)}</td><td class="num">${fmt(r.autos)}</td>
        <td class="muted">${esc(r.memo || "")}</td>
        <td class="c fit"><span class="pill ${st.cls}">${st.label}</span>${
          r.claimed_at ? `<div class="muted" style="font-size:11px;margin-top:3px">${
            new Date(r.claimed_at).toLocaleDateString("ko-KR")}</div>` : ""}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

function rewardsTable() {
  const now = Date.now();

  // **개별 지급 표에는 묶음에 딸린 행을 넣지 않는다.** pending_rewards를 통째로 읽어
  // 오다 보니 19명에게 묶음으로 주면 개별 지급에도 19줄이 그대로 따라 나왔다
  // (사용자 지적). 묶음은 위 표에서 한 줄로 이미 보여 준다.
  const singles = REWARDS.filter((r) => !r.batch_id).map((r) => ({ r, st: rewardState(r, now) }));
  const marked = BATCHES.map((b) => ({ b, st: batchState(b, now) }));

  const liveB = marked.filter((m) => isLiveBatch(m.st));
  const doneB = marked.filter((m) => !isLiveBatch(m.st));
  const liveS = singles.filter((m) => m.st.key === "live" || m.st.key === "notYet");
  const doneS = singles.filter((m) => !(m.st.key === "live" || m.st.key === "notYet"));

  if (!marked.length && !singles.length) return `<div class="empty">준 보상이 없습니다</div>`;

  const live = BATCH_VIEW === "live";
  // 탭 하나로 두 표를 같이 거른다 — 표마다 탭을 두면 어느 쪽을 보고 있는지 헷갈린다.
  const tabs = `<div class="subtabs">
    <button class="${live ? "on" : ""}" data-bview="live">아직 받는 중 <b>${fmt(liveB.length + liveS.length)}</b></button>
    <button class="${!live ? "on" : ""}" data-bview="done">끝난 것 <b>${fmt(doneB.length + doneS.length)}</b></button>
  </div>`;

  const body = batchesTable(live ? liveB : doneB) + rewardsRows(live ? liveS : doneS);
  return tabs + (body || `<div class="empty">${
    live ? "아직 받는 중인 보상이 없습니다" : "끝난 보상이 없습니다"}</div>`);
}

// ------------------------------------------------------------------ 화면
// ------------------------------------------------------------------ 이벤트 메뉴 (1.5.0, 103·104)
// 관리자가 기간을 정해 여는 이벤트. 첫 종류는 산책길(walk)이다. 기간은 [시작, 결과 공개 끝)이고 다른 이벤트와 겹칠 수 없다.
// 시험 전용 이벤트는 시험 전용끼리만 겹침을 본다(16절). 겹침은 서버 표 제약이 최종으로 막고, 창은 입력할 때마다 미리 알린다.

/** 상태 → [이름, 알약 class]. 서버 live_event_state(103)의 다섯 값이다. */
const LE_STATE = {
  scheduled: ["예정", "warn"],
  live: ["진행 중", "today"],
  results: ["결과 보여 주는 중", "dim"],
  closed: ["끝남", "dim"],
  cancelled: ["취소됨", "heart"],
};

async function loadLiveEvents() {
  try { LIVE_EVENTS = await rpc("admin_live_events", { p_limit: 100 }) || []; LE_ERR = null; }
  catch (e) { LIVE_EVENTS = []; LE_ERR = e; }
}

/** 시간 길이를 「3일 4시간」「4시간 12분」「12분」으로. 0 이하면 「바로」. */
function fmtSpan(ms) {
  if (!(ms > 0)) return "바로";
  const min = Math.floor(ms / 60000), d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d) return `${d}일${h ? ` ${h}시간` : ""}`;
  if (h) return `${h}시간${m ? ` ${m}분` : ""}`;
  return `${Math.max(1, m)}분`;
}

/** 서버 live_event_overlap_message(103)와 같은 꼴의 짧은 시각 「10/20 10:00」. 한국시간이다. */
const leShort = (iso) => fmtDateTime(iso).slice(5).replace("-", "/");

/**
 * 이 기간이 다른 이벤트와 겹치는지. 겹치면 서버와 같은 문구, 아니면 null.
 * 서버 live_events_no_overlap·live_events_test_no_overlap과 같은 규칙이다. 취소된 줄은 빼고, 시험 전용 여부가 같은 줄끼리만 본다.
 * 기간은 [시작, 결과 공개 끝)이라 앞 이벤트의 결과 공개 끝과 뒤 이벤트의 시작이 같으면 겹치지 않는다.
 */
function leOverlap(events, id, start, until, testOnly) {
  const s = start.getTime(), u = until.getTime();
  const hit = events
    .filter((e) => !e.cancelled_at && Boolean(e.test_only) === Boolean(testOnly) && String(e.id) !== String(id))
    .filter((e) => s < new Date(e.results_until).getTime() && new Date(e.starts_at).getTime() < u)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  return hit ? `#${hit.id} ${hit.name_ko} ${leShort(hit.starts_at)} ~ ${leShort(hit.results_until)}과 겹칩니다` : null;
}

/**
 * 만들기·고치기 창의 값 검사. 화면을 건드리지 않아 따로 돌려 볼 수 있다.
 * v = { kind, nameKo, nameEn, nameJa, nameZh, start, end, until(Date|null), level, buildIos, buildAnd, test, tiers[] }
 * ev는 고치는 이벤트(새로 만들면 null). 돌려주는 값 { errors[], warns[] }. errors가 있으면 저장을 막는다.
 * 서버 admin_live_event_save(103)가 다시 본다. 여기서는 서버가 거절할 것을 먼저 알리고, 서버가 안 막는 것은 경고만 한다.
 */
function checkLiveEvent(v, ev, now, events) {
  const errors = [], warns = [];
  const st = ev ? ev.state : null;
  if (ev && st !== "scheduled" && st !== "live") {
    errors.push("끝났거나 취소된 이벤트는 고칠 수 없습니다.");
    return { errors, warns };
  }
  const def = KIND_DEFAULTS[v.kind];
  if (!def) errors.push(`모르는 종류입니다: ${v.kind}`);
  if (!v.nameKo.trim()) errors.push("한국어 이름은 비울 수 없습니다.");
  if (!v.start || !v.end || !v.until) errors.push("시작, 끝, 결과 공개 끝을 모두 넣으세요.");
  else {
    if (!(v.start < v.end)) errors.push("끝은 시작보다 뒤여야 합니다.");
    if (!(v.end <= v.until)) errors.push("결과 공개 끝은 끝과 같거나 뒤여야 합니다.");
    if ((!ev || st === "scheduled") && v.start <= now) errors.push("시작 시각은 지금보다 뒤여야 합니다.");
    if (st === "live" && v.until < new Date(ev.results_until)) errors.push("진행 중에는 결과 공개 끝을 늘리기만 할 수 있습니다.");
    if (v.start < v.end && v.end <= v.until) {
      const hit = leOverlap(events, ev?.id, v.start, v.until, v.test);
      if (hit) errors.push(hit);
      if (v.until - v.end < 24 * 3600e3) {
        warns.push("결과 공개 기간이 24시간보다 짧습니다. 앱에서 순위 결과를 볼 수 있는 시간이 짧습니다.");
      }
    }
  }
  if (def && !(Number.isInteger(v.level) && v.level >= def.minLevel)) {
    errors.push(`${def.label} 이벤트는 참여 레벨을 ${def.minLevel} 이상으로 정해야 합니다.`);
  }
  for (const [name, b] of [["iOS", v.buildIos], ["Android", v.buildAnd]]) {
    if (!(Number.isInteger(b) && b >= 0)) errors.push(`${name} 앱 최소 빌드 번호는 0 이상의 정수여야 합니다.`);
  }
  let prev = 0;
  for (const t of v.tiers) {
    if (!(t.to >= 1 && t.to <= 100)) { errors.push("보상 표의 「몇 등까지」는 1~100이어야 합니다. 앱 순위 목록이 100명까지입니다."); break; }
    if (t.to <= prev) { errors.push(`보상 표의 「${t.to}등까지」가 앞 줄과 겹칩니다.`); break; }
    if (t.coins < 0 || t.hints < 0 || t.autos < 0) { errors.push("보상은 0 이상이어야 합니다."); break; }
    prev = t.to;
  }
  if (!v.tiers.some((t) => t.coins + t.hints + t.autos > 0)) warns.push("보상이 없는 이벤트입니다.");
  return { errors, warns };
}

/** 보상 표를 한 줄로. 「1등 700·힌트2·자동2 / 2등 …」 */
function tiersText(tiers) {
  let from = 1;
  return (tiers || []).map((t) => {
    const who = from === t.to ? `${t.to}등` : `${from}~${t.to}등`;
    from = t.to + 1;
    const parts = [t.coins ? `코인 ${fmt(t.coins)}` : "", t.hints ? `힌트 ${t.hints}` : "", t.autos ? `자동 ${t.autos}` : ""].filter(Boolean);
    return `${who} ${parts.join("·") || "없음"}`;
  }).join(" / ");
}

/** 이벤트 목록. 줄 사이에 실제 이벤트끼리의 빈 기간(「다음 이벤트까지 3일 4시간」)을 넣는다. */
function liveEventsTab() {
  if (LE_ERR) {
    return loadFail("이벤트를 불러오지 못했습니다.", LE_ERR, "sql/migrations/103_live_events.sql");
  }
  const now = Date.now();
  // 실제 이벤트(취소·시험 아님)끼리 시작 순으로 세워 앞 이벤트의 결과 공개 끝과의 간격을 센다.
  const real = LIVE_EVENTS.filter((e) => !e.cancelled_at && !e.test_only)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  // 이벤트 → 그 뒤 실제 이벤트까지의 간격. 시험 전용 줄이 사이에 끼어도 앞 이벤트 줄 바로 위에 붙인다.
  const gapAfter = new Map();
  real.forEach((e, i) => {
    if (i) gapAfter.set(real[i - 1].id, new Date(e.starts_at) - new Date(real[i - 1].results_until));
  });
  const COLS = 11;
  const row = (e) => {
    const [stName, stCls] = LE_STATE[e.state] || [e.state, "dim"];
    const left = e.state === "live" ? `<div class="muted" style="font-size:11.5px">끝까지 ${fmtSpan(new Date(e.effective_end) - now)}</div>`
      : e.state === "scheduled" ? `<div class="muted" style="font-size:11.5px">시작까지 ${fmtSpan(new Date(e.starts_at) - now)}</div>` : "";
    const why = e.cancelled_at ? `<div class="muted" style="font-size:11.5px">${esc(fmtDateTime(e.cancelled_at))} 취소 · ${esc(e.cancel_reason || "")}</div>` : "";
    const end = e.ended_early_at
      ? `<s class="muted">${esc(fmtDateTime(e.ends_at))}</s><br><span class="pill warn" style="margin-left:0" title="${esc(e.end_reason || "")}">지금 끝냄 ${esc(fmtDateTime(e.ended_early_at))}</span>`
      : esc(fmtDateTime(e.ends_at));
    const reward = e.cancelled_at ? '<span class="muted">없음</span>'
      : e.settled_at ? `보낸 보상 ${fmt(e.grants)} · 받아 감 ${fmt(e.claimed)}`
      : '<span class="muted">보상 보내기 전</span>';
    const mb = e.min_build || {};
    const btn = (attr, label, cls = "ghost") => `<button class="${cls} sm" ${attr}="${e.id}">${label}</button>`;
    const acts = [
      e.state === "scheduled" ? btn("data-le-edit", "고치기", "") : "",
      e.state === "live" ? btn("data-le-edit", "결과 공개 끝 늦추기") : "",
      ["results", "closed", "cancelled"].includes(e.state) ? btn("data-le-edit", "보기") : "",
      e.state !== "scheduled" && !e.cancelled_at ? btn("data-le-rank", String(LE_OPEN) === String(e.id) ? "순위 접기" : "순위 보기") : "",
      btn("data-le-stats", "차트"),
      // 시험 전용과 취소된 이벤트는 서버가 이벤트 조건을 거절한다(104 push_validate).
      !e.cancelled_at && !e.test_only && e.state === "scheduled" ? btn("data-le-startpush", "시작 알림 푸시 예약") : "",
      !e.cancelled_at && !e.test_only && e.state !== "scheduled" ? btn("data-le-push", "참여자에게 푸시") : "",
      e.state === "live" ? btn("data-le-end", "지금 끝내기", "danger") : "",
      e.state === "scheduled" || e.state === "live" ? btn("data-le-cancel", "취소", "danger") : "",
    ].join("");
    return `<tr>
      <td class="num fit">#${e.id}</td>
      <td>${esc(e.name_ko)}<div class="muted" style="font-size:11.5px">${esc(KIND_DEFAULTS[e.kind]?.label || e.kind)}${
        [e.name_en, e.name_ja, e.name_zh].filter(Boolean).length ? ` · ${esc([e.name_en, e.name_ja, e.name_zh].filter(Boolean).join(" / "))}` : ""}</div></td>
      <td class="c"><span class="pill ${stCls}">${stName}</span>${e.test_only ? '<span class="pill dim">시험</span>' : ""}${left}${why}</td>
      <td>${esc(fmtDateTime(e.starts_at))}</td>
      <td>${end}</td>
      <td>${esc(fmtDateTime(e.results_until))}</td>
      <td class="num">${fmt(e.min_level)}<div class="muted" style="font-size:11.5px">iOS ${fmt(mb.ios ?? 0)} · AOS ${fmt(mb.android ?? 0)}</div></td>
      <td class="num">${fmt(e.participants)}<div class="muted" style="font-size:11.5px">순위에 든 사람 ${fmt(e.ranked)}</div></td>
      <td class="num">${fmt(e.runs)}</td>
      <td title="${esc(tiersText(e.rewards?.tiers))}">${reward}<div class="muted" style="font-size:11.5px">${
        e.rewards?.tiers?.length ? `${e.rewards.tiers[e.rewards.tiers.length - 1].to}등까지 · 1등 코인 ${fmt(e.rewards.tiers[0].coins)}` : "보상 없음"}</div></td>
      <td><div class="actions">${acts}</div></td>
    </tr>`;
  };
  const rows = LIVE_EVENTS.map((e) => {
    const gap = gapAfter.get(e.id);
    // 목록은 시작 내림차순이라 다음 이벤트는 위에 있다. 「다음 이벤트까지」 줄은 이 이벤트 줄 바로 위에 온다.
    const gapRow = gap == null ? "" : `<tr class="gap"><td colspan="${COLS}">↑ ${gap > 0 ? `다음 이벤트까지 ${fmtSpan(gap)}` : "바로 이어짐"}</td></tr>`;
    return gapRow + row(e);
  }).join("");
  return `
    <div class="notice">이벤트 하나는 <b>시작부터 결과 공개 끝까지</b> 자리를 차지하고, 그동안 다른 이벤트를 열 수 없습니다.
      시험 전용 이벤트는 시험 전용끼리만 겹치는지 봅니다.
      이벤트가 끝나면 순위대로 보상이 <b>우편함</b>으로 가고, 보낸 날부터 ${RANK_CLAIM_DAYS}일 안에 받아야 합니다.
      결과 공개 끝은 이벤트가 끝난 뒤에도 앱에서 순위 결과를 보여 주는 마지막 때입니다.</div>
    <div class="toolbar">
      <button id="leNew">새 이벤트</button>
      <span class="muted" style="font-size:12.5px">시각은 모두 한국시간입니다. 시작 전인 이벤트만 고칠 수 있고, 진행 중에는 결과 공개 끝을 늦추는 것만 됩니다.</span>
    </div>
    ${LIVE_EVENTS.length ? `<div class="table-scroll"><table>
      <thead><tr><th class="num fit">번호</th><th>이름</th><th class="c">상태</th><th>시작</th><th>끝</th><th>결과 공개 끝</th>
        <th class="num">참여 레벨 · 최소 빌드</th><th class="num">참여한 사람</th><th class="num">산책 횟수</th><th>보상</th><th>관리</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
    : '<div class="empty">아직 만든 이벤트가 없습니다</div>'}
    ${LE_OPEN != null ? `<div id="leRankBox">${liveRankingBox()}</div>` : ""}`;
}

/** 만들기·고치기 창. id가 없으면 새 이벤트. 진행 중이면 결과 공개 끝만, 끝났거나 취소됐으면 읽기만 한다. */
function openLiveEvent(id = null) {
  const dlg = $("#liveEventDlg");
  const ev = id == null ? null : LIVE_EVENTS.find((e) => String(e.id) === String(id)) || null;
  const kind0 = ev?.kind || "walk";
  const def = KIND_DEFAULTS[kind0];
  const st = ev ? ev.state : null;
  const readOnly = ev && st !== "scheduled" && st !== "live";
  $("#leTitle").textContent = !ev ? "새 이벤트" : readOnly ? `#${ev.id} 보기` : st === "live" ? `#${ev.id} 결과 공개 끝 늦추기` : `#${ev.id} 고치기`;
  $("#leHow").textContent = !ev || st === "scheduled"
    ? "시작 전까지는 모두 고칠 수 있습니다. 시작하면 결과 공개 끝을 늦추는 것만 됩니다."
    : st === "live" ? "진행 중입니다. 결과 공개 끝을 늦추는 것만 됩니다."
    : "끝났거나 취소된 이벤트는 고칠 수 없습니다.";
  $("#leUntilHow").textContent = `끝난 뒤에도 결과 공개 끝까지는 앱에서 순위 결과를 보여 줍니다. 순위 보상은 이벤트가 끝나면 우편함으로 가고, 보낸 날부터 ${RANK_CLAIM_DAYS}일 안에 받아야 합니다. 참여할 수 있는 레벨에 못 미친 사람은 참여하지 못합니다.`;
  $("#leKind").innerHTML = Object.entries(KIND_DEFAULTS).map(([k, d]) => `<option value="${k}">${esc(d.label)}</option>`).join("");
  $("#leKind").value = kind0;
  $("#leNameKo").value = ev?.name_ko || "";
  $("#leNameEn").value = ev?.name_en || "";
  $("#leNameJa").value = ev?.name_ja || "";
  $("#leNameZh").value = ev?.name_zh || "";
  $("#leStart").value = ev ? toKstInput(ev.starts_at) : "";
  $("#leEnd").value = ev ? toKstInput(ev.ends_at) : "";
  $("#leUntil").value = ev ? toKstInput(ev.results_until) : "";
  $("#leLevel").value = String(ev?.min_level ?? def.minLevel);
  $("#leLevel").min = String(def.minLevel);
  $("#leBuildIos").value = String(ev?.min_build?.ios ?? def.minBuild.ios);
  $("#leBuildAnd").value = String(ev?.min_build?.android ?? def.minBuild.android);
  $("#leTest").checked = Boolean(ev?.test_only);
  let tiers = (ev ? ev.rewards?.tiers || [] : def.tiers).map((t) => ({ ...t }));

  const n = (x) => Number(x ?? 0) || 0;
  const drawTiers = () => {
    $("#leTierBody").innerHTML = tiers.length ? tiers.map((t, i) => `<tr data-le-tier="${i}">
        <td class="num"><input type="number" min="1" max="100" class="t-to" value="${n(t.to)}" style="width:72px"></td>
        <td class="num"><input type="number" min="0" class="t-coins" value="${n(t.coins)}" style="width:90px"></td>
        <td class="num"><input type="number" min="0" class="t-hints" value="${n(t.hints)}" style="width:64px"></td>
        <td class="num"><input type="number" min="0" class="t-autos" value="${n(t.autos)}" style="width:64px"></td>
        <td><button class="ghost sm" type="button" data-le-tierdel="${i}">이 줄 지우기</button></td></tr>`).join("")
      : '<tr><td colspan="5" class="muted">보상이 없습니다</td></tr>';
    $("#leTierBody").querySelectorAll("[data-le-tierdel]").forEach((b) => {
      b.onclick = () => { readTiers(); tiers.splice(Number(b.dataset.leTierdel), 1); drawTiers(); check(); };
    });
    $("#leTierBody").querySelectorAll("input").forEach((el) => { el.oninput = check; });
    lock();
  };
  const readTiers = () => {
    tiers = [...$("#leTierBody").querySelectorAll("tr[data-le-tier]")].map((tr) => ({
      to: n(tr.querySelector(".t-to").value), coins: n(tr.querySelector(".t-coins").value),
      hints: n(tr.querySelector(".t-hints").value), autos: n(tr.querySelector(".t-autos").value),
    }));
    return tiers;
  };
  // 진행 중이면 결과 공개 끝 말고 전부 잠그고, 끝났거나 취소됐으면 전부 잠근다.
  const lock = () => {
    dlg.querySelectorAll("input, select, #leTierAdd, [data-le-tierdel]").forEach((el) => {
      el.disabled = readOnly || (st === "live" && el.id !== "leUntil");
    });
    $("#leOk").style.display = readOnly ? "none" : "";
  };
  const values = () => ({
    kind: $("#leKind").value,
    nameKo: $("#leNameKo").value, nameEn: $("#leNameEn").value, nameJa: $("#leNameJa").value, nameZh: $("#leNameZh").value,
    start: kstInput($("#leStart").value), end: kstInput($("#leEnd").value), until: kstInput($("#leUntil").value),
    level: Number($("#leLevel").value), buildIos: Number($("#leBuildIos").value), buildAnd: Number($("#leBuildAnd").value),
    test: $("#leTest").checked,
    tiers: [...readTiers()].sort((a, b) => a.to - b.to),
  });
  let result = { errors: [], warns: [] };
  const check = () => {
    if (readOnly) { $("#leErr").textContent = ""; $("#leWarn").style.display = "none"; return; }
    result = checkLiveEvent(values(), ev, new Date(), LIVE_EVENTS);
    $("#leErr").innerHTML = result.errors.map(esc).join("<br>");
    $("#leWarn").innerHTML = result.warns.map(esc).join("<br>");
    $("#leWarn").style.display = result.warns.length ? "" : "none";
    $("#leOk").disabled = result.errors.length > 0;
  };
  dlg.querySelectorAll("input, select").forEach((el) => { el.oninput = check; el.onchange = check; });
  $("#leTierAdd").onclick = () => {
    readTiers();
    const last = tiers.length ? n(tiers[tiers.length - 1].to) : 0;
    tiers.push({ to: last + 1, coins: 0, hints: 0, autos: 0 });
    drawTiers(); check();
  };
  drawTiers();
  check();
  dlg.showModal();
  $("#leCancel").onclick = () => dlg.close();
  $("#leOk").onclick = async () => {
    check();
    if (result.errors.length) return;
    const v = values();
    const lines = [
      `${ev ? `#${ev.id} 고치기` : "새 이벤트"}: ${v.nameKo.trim()}${v.test ? " (시험 전용)" : ""}`,
      `시작 ${fmtDateTime(v.start.toISOString())}`,
      `끝 ${fmtDateTime(v.end.toISOString())}`,
      `결과 공개 끝 ${fmtDateTime(v.until.toISOString())}`,
      `참여 레벨 ${v.level} · 최소 빌드 번호 iOS ${v.buildIos} · AOS ${v.buildAnd}`,
      `보상 ${tiersText(v.tiers) || "없음"}`,
      `보상은 이벤트가 끝나면 우편함으로 가고, ${RANK_CLAIM_DAYS}일 안에 받아야 합니다.`,
      ...result.warns.map((w) => `주의: ${w}`),
    ];
    if (!confirm(`${lines.join("\n")}\n\n저장할까요?`)) return;
    $("#leOk").disabled = true;
    try {
      const r = await rpc("admin_live_event_save", {
        p_id: ev ? Number(ev.id) : null, p_kind: v.kind,
        p_name_ko: v.nameKo.trim(), p_name_en: v.nameEn.trim() || null,
        p_name_ja: v.nameJa.trim() || null, p_name_zh: v.nameZh.trim() || null,
        p_starts_at: v.start.toISOString(), p_ends_at: v.end.toISOString(), p_results_until: v.until.toISOString(),
        p_min_level: v.level, p_min_build: { ios: v.buildIos, android: v.buildAnd },
        p_rewards: { tiers: v.tiers }, p_test_only: v.test,
      });
      dlg.close();
      // 시작 시각을 바꾸면 이 이벤트를 가리키는 예약 발송(시작 알림 등)이 옛 시각에 그대로 나간다. 알린다.
      const pend = r?.pending_pushes || [];
      if (pend.length) {
        alert(`시작 시각이 바뀌었습니다. 이 이벤트를 가리키는 예약 발송 ${pend.length}건이 그대로 있습니다.\n\n` +
              pend.map((m) => `· ${fmtDateTime(m.scheduled_at)} ${m.title}`).join("\n") +
              "\n\n푸시 메뉴에서 예약 시각을 고치거나 취소하세요.");
      }
      await refresh();
    } catch (e) { $("#leErr").textContent = e.message; }
    finally { $("#leOk").disabled = false; }
  };
}

/** 지금 끝내기·취소가 돌려준 예약 발송을 같이 취소할지 묻는다. */
async function cancelEventPushes(pend) {
  if (!pend?.length) return;
  if (!confirm(`이 이벤트를 가리키는 아직 안 나간 발송이 ${pend.length}건 있습니다.\n\n` +
               pend.map((m) => `· ${fmtDateTime(m.scheduled_at)} ${m.title}`).join("\n") +
               "\n\n함께 취소할까요?")) return;
  const fails = [];
  for (const m of pend) {
    try { await rpc("admin_cancel_push", { p_id: m.id }); } catch (e) { fails.push(`${m.title}: ${e.message}`); }
  }
  if (fails.length) alert(`취소하지 못한 발송이 있습니다.\n\n${fails.join("\n")}`);
}

async function endLiveEventNow(id) {
  const e = LIVE_EVENTS.find((x) => String(x.id) === String(id));
  if (!e) return;
  if (!confirm(`#${e.id} ${e.name_ko}을(를) 지금 끝냅니다.\n\n` +
               "지금 시각으로 순위를 굳히고, 잠시 기다렸다가 순위대로 보상을 보냅니다. 결과 공개 끝은 그대로입니다.\n" +
               `보상은 우편함으로 가고, 보낸 날부터 ${RANK_CLAIM_DAYS}일 안에 받아야 합니다.\n\n되돌릴 수 없습니다. 계속할까요?`)) return;
  const reason = askReasonRequired("이벤트 지금 끝내기");
  if (reason === null) return;
  await act(async () => {
    const r = await rpc("admin_live_event_end_now", { p_id: Number(e.id), p_reason: reason });
    alert(`끝냈습니다. 보상은 ${fmtDateTime(r?.settle_after)}에 보냅니다.`);
    await cancelEventPushes(r?.pending_pushes);
  }, refresh);
}

async function cancelLiveEvent(id) {
  const e = LIVE_EVENTS.find((x) => String(x.id) === String(id));
  if (!e) return;
  if (!confirm(`#${e.id} ${e.name_ko}을(를) 취소합니다.\n\n` +
               "참여 기록과 순위 결과를 감추고 보상을 주지 않습니다. 되돌릴 수 없습니다. 계속할까요?")) return;
  const reason = askReasonRequired("이벤트 취소");
  if (reason === null) return;
  await act(async () => {
    const r = await rpc("admin_live_event_cancel", { p_id: Number(e.id), p_reason: reason });
    await cancelEventPushes(r?.pending_pushes);
  }, refresh);
}

/** 이벤트로 가는 푸시. 링크는 /event/<번호>, 대상은 그 이벤트 조건 하나다.
 *  start면 시작 알림 예약: 시작 시각에, 아직 참여 안 한(들어올 수 있는) 사람에게. 아니면 참여자에게. */
function pushToEvent(id, start = false) {
  const e = LIVE_EVENTS.find((x) => String(x.id) === String(id));
  if (!e) return;
  openPush({
    kind: "ad", link: `/event/${e.id}`, target: "filter",
    target_arg: JSON.stringify({ all: [{ t: "event", id: Number(e.id), state: start ? "not_joined" : "joined" }] }),
    scheduled_at: start ? e.starts_at : null,
  });
}

// ------------------------------------------------------------------ 차트 메뉴: 오늘의 퍼즐 · 숫자 · 이벤트 (107)
// 보고서의 막대는 모두 { key, label, n, filter }이다. 막대를 누르면 그 filter를 그대로 원본 표 함수에 넘겨
// 그 갈래의 원본 줄만 본다. 서버가 막대 n과 표 total_count가 같다고 약속한다(107 머리말).

const CHART_VIEWS = [["all", "전체"], ["daily", "오늘의 퍼즐 기록전"], ["number", "숫자 퍼즐"], ["event", "이벤트"]];
/** 날짜별 쌓은 막대와 참여자 선의 색. 모르는 갈래는 PLAY_PALETTE에서 차례로 고른다. */
const PLAY_COLORS = {
  participants: "#5b4fc4",
  cleared: "#17b3a8", ended_run: "#17b3a8",
  failed: "#d95757", abandoned: "#d9a441", excluded: "#8a96a3", unfinished: "#7aa2f7",
};
const PLAY_PALETTE = ["#17b3a8", "#d95757", "#d9a441", "#8a96a3", "#7aa2f7", "#b07cc6"];

/** 지금 보기의 바탕 조건. 서버 보고서의 range(rng)와 같은 꼴이다. 막대를 누르기 전 원본 표가 쓴다. */
function playBaseFilter() {
  if (CHART_VIEW === "event") return { event_id: Number(PLAY_EVENT), include_test: PLAY_TEST };
  return { from: kstDate(-(PLAY_DAYS - 1)), to: kstDate(0), include_test: PLAY_TEST };
}

/** 이벤트 보기의 기본 이벤트. 진행 중, 없으면 결과 공개, 없으면 가장 최근에 시작한 것. 목록은 시작 내림차순이다. */
function defaultPlayEvent() {
  const pick = LIVE_EVENTS.find((e) => e.state === "live") || LIVE_EVENTS.find((e) => e.state === "results")
    || LIVE_EVENTS.find((e) => e.state !== "scheduled" && !e.cancelled_at) || LIVE_EVENTS[0];
  return pick ? pick.id : null;
}

async function loadPlay() {
  const [repFn] = PLAY_RPC[CHART_VIEW];
  if (CHART_VIEW === "event" && !LIVE_EVENTS.some((e) => String(e.id) === String(PLAY_EVENT))) {
    PLAY_EVENT = defaultPlayEvent();
    PLAY_FILTER = null;
  }
  if (CHART_VIEW === "event" && PLAY_EVENT == null) {
    PLAY_REPORT = null; PLAY_ERR = null; PLAY_ROWS = []; PLAY_TOTAL = 0; PLAY_ROWS_ERR = null;
    return;
  }
  // 회원 이력에서 넘어왔으면 이 보기의 바탕 조건에 회원을 더한다. 시험 계정이어도 보이게 include_test를 켠다.
  if (PLAY_PENDING_MEMBER) {
    const m = PLAY_PENDING_MEMBER;
    PLAY_PENDING_MEMBER = null;
    PLAY_FILTER = { label: `${m.label} 회원의 기록`, arg: { ...playBaseFilter(), include_test: true, profile_id: m.id } };
  }
  const args = CHART_VIEW === "event"
    ? { p_event_id: Number(PLAY_EVENT), p_include_test: PLAY_TEST }
    : { p_from: kstDate(-(PLAY_DAYS - 1)), p_to: kstDate(0), p_include_test: PLAY_TEST };
  const [rep] = await Promise.all([
    rpc(repFn, args).then((r) => ({ r }), (e) => ({ e })),
    loadPlayRows(),
  ]);
  PLAY_REPORT = rep.e ? null : rep.r;
  PLAY_ERR = rep.e || null;
}

async function loadPlayRows() {
  const [, rowsFn] = PLAY_RPC[CHART_VIEW];
  try {
    PLAY_ROWS = await rpc(rowsFn, {
      p_filter: PLAY_FILTER ? PLAY_FILTER.arg : playBaseFilter(), p_limit: PLAY_SIZE, p_offset: PLAY_PAGE * PLAY_SIZE,
    }) || [];
    PLAY_TOTAL = PLAY_ROWS.length ? Number(PLAY_ROWS[0].total_count) || 0 : 0;
    PLAY_ROWS_ERR = null;
  } catch (e) { PLAY_ROWS = []; PLAY_TOTAL = 0; PLAY_ROWS_ERR = e; }
}

/** 보고서에 막대로 안 나오는 상태·깃발 코드의 이름. 서버 admin_play_reason_label(107)과 같은 말이고,
 *  보고서에 같은 코드의 막대가 있으면 그쪽(서버 이름)이 이긴다. 산책 상태 ranked·started와 기록전 fast 깃발이 여기 걸린다.
 *  카드·일자별·시간대 막대는 key를 「시작」「0시」처럼 그 칸 이름으로 써서 이름표로 읽지 않는다. */
const PLAY_LABEL_FALLBACK = {
  started: "진행 중", cleared: "성공", failed: "실패", excluded: "제외", abandoned: "끝내지 않음", unfinished: "끝나지 않음",
  ranked: "순위에 듦", unranked: "순위 밖",
  fast: "빠름", offline_finish: "오프라인에서 끝남", offline_start: "오프라인 시작", late_stamp: "시작 늦게 도착",
  no_clock: "기기 시각 못 믿음", overlap: "판 겹침", reboot: "재부팅", clock: "시계 어긋남", trimmed: "판 수 깎임",
  offline_long: "오래된 오프라인", low_level: "레벨 낮음", test: "시험 계정", late: "늦게 도착",
};

/** 보고서 안의 모든 막대에서 코드 → 이름을 모은다. 이름표는 서버 admin_play_reason_label(107) 한 곳에 있어서
 *  원본 표의 상태·깃발 칸도 여기서 읽는다. 보고서에 안 나온 코드는 코드를 그대로 보인다. */
function playLabels(report) {
  const out = { ...PLAY_LABEL_FALLBACK };
  const walk = (x, top = false) => {
    if (Array.isArray(x)) { x.forEach((y) => walk(y)); return; }
    if (!x || typeof x !== "object") return;
    if (typeof x.key === "string" && typeof x.label === "string" && "n" in x && x.filter && !(x.key in seen)) {
      seen[x.key] = true;
      out[x.key] = x.label;
    }
    Object.entries(x).forEach(([k, y]) => { if (!(top && ["cards", "daily", "hours"].includes(k))) walk(y); });
  };
  const seen = {};
  walk(report, true);
  return out;
}

/** 누를 수 있는 숫자. n이 0이면 그냥 0이다(눌러도 빈 표라서). */
function playLink(bar, label) {
  if (!bar) return "—";
  const n = Number(bar.n) || 0;
  if (!n) return '<span class="muted">0</span>';
  return `<button class="plink" data-playfilter="${esc(JSON.stringify(bar.filter))}" data-playlabel="${esc(label)}">${fmt(n)}</button>`;
}

/** 막대를 누를 때 실을 속성. */
const playAttr = (bar, label) =>
  ` data-playfilter="${esc(JSON.stringify(bar.filter))}" data-playlabel="${esc(label)}"`;

/**
 * 날짜별 쌓은 막대 + 참여자 선. days = 보고서의 daily [{ day, participants, bars:[전체, 갈래...] }].
 *
 * 기둥 하나의 높이가 그날 전체(bars[0])이고, 안에 갈래(bars[1..])를 아래부터 쌓는다. 갈래 합이 전체보다 작으면
 * 위쪽 빈 칸은 아직 진행 중인 기록이다. 갈래 칸을 누르면 그 갈래만, 기둥의 빈 곳을 누르면 그날 전체를 원본 표에 거른다.
 * 축 눈금, 안내선, 날짜 칩, 말풍선은 선 그래프(lineChart)의 마크업과 lcShow를 그대로 쓴다. 기둥은 lineChart의 점과
 * 같은 자리(px)에 세워 lcShow가 고르는 날과 어긋나지 않는다. 참여자는 같은 사람을 한 번만 센 수라 누를 조건이 없다.
 */
function dayBars(days, height = 170) {
  const W = 720, H = height, PAD = { t: 10, b: 6 };
  const ih = H - PAD.t - PAD.b;
  const n = days.length;
  if (!n) return '<div class="empty">이 기간에 기록이 없습니다</div>';
  // 기간 내내 0이면 빈 축 대신 한 줄로 알린다(2026-10-08). 날짜 축은 줄이지 않는다. 빠진 날이 있으면 흐름이 틀려 보인다.
  if (days.every((d) => !(Number(d.participants) || 0) && (d.bars || []).every((b) => !(Number(b.n) || 0)))) return EMPTY_LINE;
  const first = days[0].bars || [];
  const total = (d) => Number(d.bars?.[0]?.n) || 0;
  const parts = (d) => (d.bars || []).slice(1);
  const ppl = (d) => Number(d.participants) || 0;
  const top = Math.max(0, ...days.map((d) => Math.max(total(d), ppl(d), parts(d).reduce((a, b) => a + (Number(b.n) || 0), 0))));
  const max = Math.max(2, top + (top % 2));
  const x = (i) => (n < 2 ? W / 2 : (i * W) / (n - 1));
  const y = (v) => PAD.t + ih - (v / max) * ih;
  const px = (i) => +((x(i) / W) * 100).toFixed(2);
  const py = (v) => +((y(v) / H) * 100).toFixed(2);
  const base = py(0);
  const color = (key, k) => PLAY_COLORS[key] || PLAY_PALETTE[k % PLAY_PALETTE.length];

  const yTicks = [0, 0.5, 1].map((f) => ({ top: py(max * f), text: fmt(Math.round(max * f)) }));
  const grid = yTicks.map((t) => `<i class="lc-gl" style="top:${t.top}%"></i>`).join("");
  const widest = yTicks.reduce((a, t) => (t.text.length > a.length ? t.text : a), "");
  const yAxis = `<b>${esc(widest)}</b>` + yTicks.map((t) => `<span style="top:${t.top}%">${esc(t.text)}</span>`).join("");

  // 기둥 폭은 날 사이 간격의 70%, 많아야 28px. 처음과 끝 기둥의 절반이 그림 좌우 여백(--lc-in 18px) 안에 들어간다.
  const colW = `min(calc(70% / ${Math.max(1, n - 1)}), 28px)`;
  const cols = days.map((d, i) => {
    const t = total(d), dl = lcShortDate(d.day);
    let cum = 0;
    const segs = parts(d).map((b, k) => {
      const v = Number(b.n) || 0;
      if (!v || !t) { cum += v; return ""; }
      const bottom = (cum / Math.max(t, 1)) * 100, h = (v / Math.max(t, 1)) * 100;
      cum += v;
      return `<i class="db-seg" style="bottom:${bottom.toFixed(2)}%;height:${Math.min(h, 100 - bottom).toFixed(2)}%;background:${color(b.key, k)}"${
        playAttr(b, `${dl} ${b.label}`)} title="${esc(`${dl} ${b.label} ${fmt(v)}`)}"></i>`;
    }).join("");
    return `<div class="db-col" style="left:${px(i)}%;width:${colW};top:${py(t)}%;bottom:${(100 - base).toFixed(2)}%"${
      d.bars?.[0] ? playAttr(d.bars[0], `${dl} ${d.bars[0].label}`) : ""} title="${esc(`${dl} ${d.bars?.[0]?.label ?? ""} ${fmt(t)}`)}">${segs}</div>`;
  }).join("");

  const pd = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(ppl(d)).toFixed(1)}`).join(" ");
  const line = `<path d="${pd}" fill="none" stroke="${PLAY_COLORS.participants}" stroke-width="2"
      vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`;

  const tickAt = lcTicks(n), lastJ = tickAt.length - 1;
  const ticks = tickAt.map((i, j) => {
    const minor = (j % 2 === 1 && j !== lastJ) || (lastJ % 2 === 1 && j === lastJ - 1);
    return `<span class="lc-tick${minor ? " lc-minor" : ""}" style="left:${px(i)}%">${esc(lcShortDate(days[i].day))}</span>`;
  }).join("");

  // 말풍선 줄: 참여자, 전체, 갈래. 짚는 점은 참여자 선 하나뿐이라 lc-pt도 하나다(lcShow는 점 k에 series[k]를 쓴다).
  // 갈래 중 기간 내내 0인 것은 범례와 말풍선에서 뺀다. 참여자(0번)는 짚는 점과 짝이라 남긴다.
  const series = [
    { name: "참여자", color: PLAY_COLORS.participants, values: days.map(ppl) },
    { name: first[0]?.label ?? "전체", color: "var(--line-strong)", values: days.map(total) },
    ...first.slice(1).map((b, k) => ({ name: b.label, color: color(b.key, k), values: days.map((d) => Number(d.bars?.[k + 1]?.n) || 0) }))
      .filter((s) => s.values.some((v) => v)),
  ];
  const rows = series.map((s) =>
    `<div class="lc-row"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><b></b></div>`).join("");
  const legend = series.map((s, k) =>
    `<span class="lg"><i style="background:${s.color}${k ? "" : ";height:3px;border-radius:2px"}"></i>${esc(s.name)}</span>`).join("");
  const data = {
    labels: days.map((d) => String(d.day)),
    xs: days.map((_, i) => px(i)),
    series: series.map((s, k) => ({ values: s.values, ys: k ? [] : s.values.map((v) => py(v)) })),
  };
  return `<div class="chart lc db" data-lc="${esc(JSON.stringify(data))}">
    <div class="lc-body">
      <div class="lc-y">${yAxis}</div>
      <div class="lc-plot">${grid}
        <div class="lc-area">${cols}
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${line}</svg>
          <i class="lc-guide"></i><i class="lc-pt" style="background:${PLAY_COLORS.participants}"></i>
        </div>
      </div>
      <div class="lc-x"><div class="lc-xin">${ticks}<span class="lc-chip"></span></div></div>
    </div>
    <div class="legend">${legend}</div>
    <div class="lc-tip"><div class="lc-date"></div>${rows}</div>
  </div>`;
}

/** 날짜별 표. 폰에서 막대가 좁을 때도 숫자를 눌러 거를 수 있게 그래프 아래에 같은 값을 적는다. 최근 날이 위다. */
function playDayTable(days) {
  if (!days.length) return "";
  const heads = (days[0].bars || []).map((b) => `<th class="num">${esc(b.label)}</th>`).join("");
  const body = [...days].reverse().map((d) => `<tr><td>${esc(d.day)}</td><td class="num">${fmt(d.participants)}</td>${
    (d.bars || []).map((b) => `<td class="num">${playLink(b, `${lcShortDate(d.day)} ${b.label}`)}</td>`).join("")}</tr>`).join("");
  return `<div class="table-scroll" style="margin-top:8px;max-height:320px;overflow-y:auto"><table data-z="rows cols">
    <thead><tr><th>날짜</th><th class="num">참여자</th>${heads}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** 가로 막대 묶음. 막대를 누르면 원본 표를 그 갈래로 거른다. */
function playBars(list, prefix = "") {
  // 0인 막대는 숨긴다(2026-10-08). 다 0이거나 없으면 한 줄로 알린다.
  list = (list || []).filter((b) => Number(b?.n) || 0);
  if (!list.length) return EMPTY_LINE;
  const max = Math.max(1, ...list.map((b) => Number(b.n) || 0));
  return `<div class="bars">${list.map((b) => {
    const v = Number(b.n) || 0, label = prefix ? `${prefix}: ${b.label}` : b.label;
    return `<div class="bar-row${v ? ' clickable"' + playAttr(b, label) + ' title="누르면 아래 판 기록을 이 조건으로 거릅니다' : ""}">
      <span class="bar-label">${esc(b.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(v / max) * 100}%"></span></span>
      <span class="bar-value">${fmt(v)}</span>
    </div>`;
  }).join("")}</div>`;
}

/** 시간대(한국시간 시작 시각) 24칸. 칸을 누르면 그 시간에 시작한 기록만 거른다. */
function playHours(list) {
  if (!list?.length) return "";
  // 24칸은 시각 축이라 0인 칸도 남긴다. 다 0일 때만 한 줄로 알린다.
  if (list.every((b) => !(Number(b.n) || 0))) return EMPTY_LINE;
  const max = Math.max(1, ...list.map((b) => Number(b.n) || 0));
  return `<div class="hour-bars">${list.map((b) => {
    const v = Number(b.n) || 0;
    return `<div style="height:${Math.max(2, Math.round((v / max) * 80))}px;opacity:${v ? 1 : 0.15}" title="${esc(`${b.label} · ${fmt(v)}`)}"${
      v ? playAttr(b, `시작 시각: ${b.label}`) : ""}></div>`;
  }).join("")}</div>
  <div class="hour-axis muted">${list.map((_, h) => `<div>${h}</div>`).join("")}</div>`;
}

/** 크기 × 실수 구간 표. rows = [{ size, buckets:[막대], boards?, avg_misses? }] */
function playMistakeTable(rows, sizeLabel = (s) => `${s}×${s}`) {
  if (!rows?.length) return "";
  const heads = (rows[0].buckets || []).map((b) => `<th class="num">실수 ${esc(b.label)}</th>`).join("");
  const extra = "boards" in rows[0];
  return `<div class="table-scroll"><table data-z="rows cols">
    <thead><tr><th>판 크기</th>${extra ? '<th class="num">판 수</th><th class="num">판마다 실수</th>' : ""}${heads}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(sizeLabel(r.size))}</td>${extra
      ? `<td class="num">${fmt(r.boards)}</td><td class="num">${r.avg_misses == null ? "—" : esc(String(r.avg_misses))}</td>` : ""}${
      (r.buckets || []).map((b) => `<td class="num">${playLink(b, `${sizeLabel(r.size)} 실수 ${b.label}`)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** 걸린 시간. 1시간이 안 되면 m:ss.d, 넘으면 h:mm:ss. */
function fmtDur(ms) {
  if (ms == null) return "—";
  const v = Math.max(0, Number(ms) || 0), h = Math.floor(v / 3600000), m = Math.floor((v % 3600000) / 60000);
  const s = Math.floor((v % 60000) / 1000), d = Math.floor((v % 1000) / 100);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}.${d}`;
}

/** 카드. 막대인 값은 눌러서 거른다. */
function playCards(cards, names = {}) {
  return `<div class="cards">${Object.entries(cards || {}).map(([k, c]) => {
    const bar = c && typeof c === "object" && "filter" in c;
    const label = names[k] || (bar ? c.label : k);
    const value = bar ? fmt(c.n) : c == null ? "—" : fmt(Number(c));
    // 0이거나 값이 없는 카드는 숨긴다(pruneZeros). 다 숨으면 「아직 기록이 없어요」 한 줄.
    return `<div class="card${bar && Number(c.n) ? " click" : ""}" data-z${bar && Number(c.n) ? playAttr(c, label) : ""}>
      <div class="label">${esc(label)}</div><div class="value">${value}</div></div>`;
  }).join("")}</div>`;
}

/** 원본 기록 표. 막대를 누르기 전에는 지금 보기의 바탕 조건(기간 또는 이벤트) 전체다. */
function playRowsTable(labels) {
  const L = (code) => (code == null || code === "" ? "" : labels[code] || code);
  const flags = (f) => (f || []).map((x) => `<span class="pill dim" style="margin:1px 2px">${esc(L(x))}</span>`).join("");
  const who = (r) => r.profile_id
    ? `<button class="plink" data-member="${esc(r.profile_id)}" title="회원 목록에서 이 회원을 엽니다">${esc(r.username || String(r.profile_id).slice(0, 8))}</button>${
        r.test_account ? '<span class="pill dim">시험 계정</span>' : ""}`
    : '<span class="muted">탈퇴</span>';
  const dev = (r) => `${esc(PLATFORM_NAMES[r.platform] || r.platform || "")} ${r.build ?? ""}`;
  const cols = {
    daily: {
      head: ["날짜", "닉네임", ["판 크기", "c"], ["결과", "c"], "까닭", ["걸린 시간", "num"], ["실수", "num"], ["놓은 강아지", "num"], "시작한 때", "기기 · 빌드", "주의 표시"],
      row: (r) => [esc(r.day), who(r), `<td class="c">${r.size}×${r.size}`, `<td class="c">${esc(L(r.derived_status))}`,
        esc(r.reason_label || ""), `<td class="num">${r.derived_status === "cleared" ? fmtDur(r.elapsed_ms) : "—"}`,
        `<td class="num">${r.mistakes ?? "—"}`, `<td class="num">${r.placed_dogs ?? '<span class="muted">모름</span>'}`,
        esc(fmtDateTime(r.started_at)), dev(r), flags(r.flags)],
    },
    number: {
      head: ["날짜", "닉네임", ["판 크기", "c"], ["판 번호", "num"], ["결과", "c"], "끝난 까닭", ["점수", "num"], ["걸린 시간", "num"],
        ["실수", "num"], ["놓은 강아지", "num"], "도구", ["랭킹 점수에", "c"], "기기 · 빌드", "주의 표시"],
      row: (r) => [esc(r.day), who(r), `<td class="c">${r.size}×${r.size}`, `<td class="num">${r.board_no ?? ""}`,
        `<td class="c">${esc(L(r.derived_status))}`, esc(r.reason_label || ""), `<td class="num">${r.score == null ? "—" : fmt(r.score)}`,
        `<td class="num">${fmtDur(r.elapsed_ms)}`, `<td class="num">${r.mistakes ?? "—"}`,
        `<td class="num">${r.placed_dogs ?? '<span class="muted">모름</span>'}`,
        esc([r.tool === "hint" ? "힌트" : r.tool === "auto" ? "자동배치" : "", r.tool_ad ? "광고 도구" : "",
             r.revive_ads ? `광고 부활 ${r.revive_ads}` : "", r.coins_spent ? `코인 ${fmt(r.coins_spent)}` : ""].filter(Boolean).join(" · ")),
        `<td class="c">${r.counted ? "넣음" : '<span class="muted">안 넣음</span>'}`, dev(r), flags(r.flags)],
    },
    event: {
      head: ["날짜", "닉네임", ["결과", "c"], "끝난 까닭", ["걸은 판 수", "num"], ["순위에 넣은 판", "num"], ["이어 걷기", "num"],
        ["산책 시간", "num"], "마지막 판", "도구", "시작한 때", "기기 · 빌드", "주의 표시"],
      row: (r) => [esc(r.day), who(r), `<td class="c">${esc(L(r.derived_status))}`, esc(r.reason_label || ""),
        `<td class="num">${fmt(r.boards)}`, `<td class="num">${fmt(r.counted_boards)}`, `<td class="num">${r.continues ?? 0}`,
        `<td class="num">${fmtDur(r.walk_ms)}`,
        r.last_size ? esc(`${r.last_size}×${r.last_size} · ${r.last_placed ?? "?"}마리 · 실수 ${r.last_misses ?? "?"}`) : '<span class="muted">—</span>',
        esc([r.hints ? `힌트 ${r.hints}` : "", r.autos ? `자동배치 ${r.autos}` : "", r.tool_ads ? `광고 ${r.tool_ads}` : "",
             r.rest_bones ? `쉼터 뼈 ${r.rest_bones}` : ""].filter(Boolean).join(" · ")),
        esc(fmtDateTime(r.started_at)), dev(r), flags(r.flags)],
    },
  }[CHART_VIEW];
  // 칸 값이 「<td class=…」로 시작하면 그 class를 쓴다(숫자 칸 오른쪽 정렬). 머리글과 값에 같은 class를 붙인다.
  const cell = (c) => (String(c).startsWith("<td") ? `${c}</td>` : `<td>${c}</td>`);
  const head = cols.head.map((h) => (Array.isArray(h) ? `<th class="${h[1]}">${h[0]}</th>` : `<th>${h}</th>`)).join("");
  const pages = Math.max(1, Math.ceil(PLAY_TOTAL / PLAY_SIZE));
  const playKey = `play|${CHART_VIEW}|${PLAY_EVENT}|${PLAY_DAYS}|${PLAY_PAGE}|${PLAY_FILTER ? JSON.stringify(PLAY_FILTER.arg) : ""}`;
  const chip = PLAY_FILTER
    ? `<span class="pill today" style="margin-left:0">${esc(PLAY_FILTER.label)}</span><button class="ghost sm" id="playClear">조건 풀기</button>`
    : '<span class="muted" style="font-size:12.5px">위의 막대나 숫자를 누르면 그에 해당하는 판만 여기에 거릅니다</span>';
  return `<h3 class="sub" id="playRows" style="scroll-margin-top:90px">판 하나하나의 기록</h3>
    <div class="toolbar">${chip}
      <span class="muted" style="font-size:12.5px">${fmt(PLAY_TOTAL)}건</span>
      <div style="flex:1"></div>
      ${PLAY_TOTAL ? '<button class="ghost sm" id="playToPlayers" title="이 조건에 걸린 회원을 회원 목록에서 봅니다">이 회원들을 회원 목록에서 보기</button>' : ""}
    </div>
    ${PLAY_ROWS_ERR ? loadFail("판 하나하나의 기록을 불러오지 못했습니다.", PLAY_ROWS_ERR, "sql/migrations/107_admin_records.sql")
      : PLAY_ROWS.length ? `<div class="table-scroll"><table><thead><tr>${head}</tr></thead>
        <tbody>${moreRows(playKey, PLAY_ROWS.map((r) => `<tr>${cols.row(r).map(cell).join("")}</tr>`))}</tbody></table></div>${moreBar(playKey, PLAY_ROWS.length)}
        ${pages > 1 ? `<div class="toolbar" style="margin-top:8px">
          <button class="ghost sm" id="playPrev" ${PLAY_PAGE ? "" : "disabled"}>이전</button>
          <span class="muted">${PLAY_PAGE + 1} / ${pages}쪽</span>
          <button class="ghost sm" id="playNext" ${PLAY_PAGE + 1 < pages ? "" : "disabled"}>다음</button></div>` : ""}`
      : '<div class="empty">조건에 맞는 판이 없습니다</div>'}`;
}

/** 오늘의 퍼즐 · 숫자 · 이벤트 보기 하나. */
function playTab() {
  const tools = CHART_VIEW === "event"
    ? `<select id="playEvent" style="max-width:100%">${LIVE_EVENTS.length ? LIVE_EVENTS.map((e) =>
        `<option value="${e.id}" ${String(e.id) === String(PLAY_EVENT) ? "selected" : ""}>${esc(
          `#${e.id} ${e.name_ko} · ${LE_STATE[e.state]?.[0] ?? e.state}${e.test_only ? " · 시험" : ""}`)}</option>`).join("")
        : '<option value="">이벤트가 없습니다</option>'}</select>
       <button class="ghost sm" data-tab="liveevents" title="일정, 지금 끝내기, 취소, 푸시는 이벤트 메뉴에 있습니다">이벤트 메뉴로</button>`
    : `<select id="playDays">${[...new Set([14, 30, 90, PLAY_MEMBER_DAYS])].map((d) => `<option value="${d}" ${d === PLAY_DAYS ? "selected" : ""}>최근 ${d}일</option>`).join("")}</select>`;
  const head = `<div class="toolbar">${tools}
      <label class="tgl" title="켜면 시험 계정의 판도 같이 셉니다"><input type="checkbox" id="playTest" ${PLAY_TEST ? "checked" : ""}>
        <span class="tgl-track"><span class="tgl-thumb"></span></span><span>시험 계정도 세기</span></label>
      <span class="muted" style="font-size:12.5px">날짜와 시각은 한국시간입니다</span></div>`;
  if (PLAY_ERR) {
    return head + loadFail("차트를 불러오지 못했습니다.", PLAY_ERR, "sql/migrations/107_admin_records.sql");
  }
  if (CHART_VIEW === "event" && LE_ERR) {
    return head + loadFail("이벤트를 불러오지 못했습니다.", LE_ERR, "sql/migrations/103_live_events.sql");
  }
  const R = PLAY_REPORT;
  if (!R) return head + `<div class="empty">${CHART_VIEW === "event" ? "아직 만든 이벤트가 없습니다" : "받아 온 내용이 비어 있습니다. 관리자로 등록된 계정인지 확인하세요."}</div>`;
  const labels = playLabels(R);
  let body = "";
  if (CHART_VIEW === "daily") {
    body = `
      ${playCards(R.cards, { participants: "참여자" })}
      <h3 class="sub">날마다 시작 · 성공 · 실패 · 끝내지 않음 · 제외</h3>
      <div class="muted" style="font-size:12px;margin-bottom:6px">「끝내지 않음」은 풀다가 그만둔 판, 「제외」는 랭킹에서 빠진 판입니다.</div>
      ${dayBars(R.daily || [])}${playDayTable(R.daily || [])}
      <h3 class="sub">어디까지 갔나 · 실패하거나 끝내지 않은 판에서 놓은 강아지 수</h3>
      ${playBars([...(R.placed?.bars || []).map((b) => ({ ...b, label: `${b.label}마리` })), R.placed?.unknown].filter(Boolean), "놓은 강아지")}
      <h3 class="sub">끝난 까닭</h3>${playBars(R.end_reasons, "끝난 까닭")}
      <h3 class="sub">걸린 시간 · 성공한 기록만</h3>${playBars(R.time?.buckets, "걸린 시간")}
      ${(R.time?.by_weekday || []).length ? `<div class="table-scroll" style="margin-top:8px"><table data-z="rows">
        <thead><tr><th>요일</th><th class="num">성공</th><th class="num">빠른 쪽 25%${infoTip("성공한 사람 중 빠른 쪽 4분의 1이 이 시간 안에 들어옵니다.")}</th><th class="num">가운데${infoTip("성공한 사람을 시간 순으로 세웠을 때 가운데 사람의 시간입니다.")}</th><th class="num">느린 쪽 25%${infoTip("성공한 사람의 4분의 3이 이 시간 안에 들어옵니다. 이보다 느린 사람이 4분의 1입니다.")}</th></tr></thead>
        <tbody>${R.time.by_weekday.map((w) => `<tr><td>${LC_WEEK[w.weekday]}</td><td class="num">${playLink(w.bar, `${LC_WEEK[w.weekday]}요일 성공`)}</td>
          <td class="num">${w.p25 == null ? "—" : fmtDur(w.p25)}</td><td class="num">${w.p50 == null ? "—" : fmtDur(w.p50)}</td>
          <td class="num">${w.p75 == null ? "—" : fmtDur(w.p75)}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <h3 class="sub">판 크기마다 실수</h3>${playMistakeTable(R.mistakes)}
      <h3 class="sub">랭킹에서 빠진 까닭</h3>${R.exclusions?.length ? playBars(R.exclusions, "빠진 까닭") : '<div class="empty">랭킹에서 빠진 기록이 없습니다</div>'}
      <h3 class="sub">인터넷 없이 한 판</h3>${playBars(R.offline, "인터넷 없이")}
      <h3 class="sub">몇 시에 시작했나</h3>${playHours(R.hours)}
      <div class="muted" style="font-size:12px;margin-top:8px">기록전에는 도구와 부활이 없습니다. 날짜마다 순위는 랭킹 메뉴에서 봅니다.</div>`;
  } else if (CHART_VIEW === "number") {
    body = `
      ${playCards(R.cards, { participants: "참여자" })}
      <h3 class="sub">날마다 시작 · 성공 · 실패 · 끝내지 않음 · 끝나지 않음</h3>
      ${dayBars(R.daily || [])}${playDayTable(R.daily || [])}
      <div class="muted" style="font-size:12px;margin-top:6px">「끝나지 않음」은 시작했다는 알림만 온 판입니다. 숫자 퍼즐은 날이 지나도 이어 풀 수 있어서 그만둔 것으로 보지 않습니다.</div>
      <h3 class="sub">판 크기마다 성공한 비율</h3>
      ${(R.sizes || []).length ? `<div class="table-scroll"><table data-z="rows">
        <thead><tr><th>판 크기</th><th class="num">전체</th><th class="num">성공</th><th class="num">성공 비율</th></tr></thead>
        <tbody>${R.sizes.map((z) => `<tr><td>${esc(z.all?.label ?? z.size)}</td><td class="num">${playLink(z.all, `${z.all?.label} 전체`)}</td>
          <td class="num">${playLink(z.cleared, `${z.cleared?.label} 성공`)}</td><td class="num">${pct(Number(z.cleared?.n) || 0, Number(z.all?.n) || 0)}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <h3 class="sub">어디까지 갔나 · 실패하거나 끝내지 않은 판에서 놓은 강아지 수</h3>
      ${playBars([...(R.placed?.bars || []).map((b) => ({ ...b, label: `${b.label}마리` })), R.placed?.unknown].filter(Boolean), "놓은 강아지")}
      <h3 class="sub">끝난 까닭</h3>${playBars(R.end_reasons, "끝난 까닭")}
      <h3 class="sub">걸린 시간 · 성공한 판만</h3>${playBars(R.time?.buckets, "걸린 시간")}
      <h3 class="sub">판 크기마다 실수</h3>${playMistakeTable(R.mistakes)}
      <h3 class="sub">도구 · 부활 · 코인 쓴 것</h3>${playBars(R.tools, "도구")}
      <h3 class="sub">랭킹에서 빠짐 · 인터넷 없이 한 판</h3>${playBars(R.exclusions, "빠짐")}
      <h3 class="sub">몇 시에 시작했나</h3>${playHours(R.hours)}`;
  } else {
    const ev = LIVE_EVENTS.find((e) => String(e.id) === String(PLAY_EVENT));
    body = `
      ${ev ? `<div class="muted" style="font-size:12.5px;margin-bottom:8px">${esc(fmtDateTime(ev.starts_at))} ~ ${esc(fmtDateTime(ev.effective_end))}
        · 결과 공개 끝 ${esc(fmtDateTime(ev.results_until))} · ${LE_STATE[ev.state]?.[0] ?? esc(ev.state)}. 이 화면은 저절로 새로 받지 않습니다. 맨 위 새로고침을 누르세요.</div>` : ""}
      ${playCards(R.cards, { participants: "참여한 사람", avg_boards: "끝난 산책의 평균 판 수", max_boards: "가장 많이 걸은 판 수" })}
      <h3 class="sub">날마다 참여한 사람 · 산책 시작 · 산책 끝</h3>
      ${dayBars(R.daily || [])}${playDayTable(R.daily || [])}
      <h3 class="sub">어디까지 갔나 · 끝난 산책에서 걸은 판 수</h3>${playBars(R.boards, "걸은 판 수")}
      <h3 class="sub">끝난 산책의 마지막 판에서 놓은 강아지 수</h3>
      ${playBars([...(R.placed?.bars || []).map((b) => ({ ...b, label: `${b.label}마리` })), R.placed?.unknown].filter(Boolean), "마지막 판 놓은 강아지")}
      <h3 class="sub">끝난 까닭</h3>${playBars(R.end_reasons, "끝난 까닭")}
      <h3 class="sub">산책 길이 · 끝난 산책만</h3>${playBars(R.time?.buckets, "산책 길이")}
      <h3 class="sub">이어 걷기 · 쉼터</h3>${playBars(R.continues, "이어 걷기")}
      <h3 class="sub">도구</h3>${playBars(R.tools, "도구")}
      <h3 class="sub">판 크기마다 실수</h3>
      <div class="muted" style="font-size:12px;margin-bottom:6px">「판 수」와 「판마다 실수」는 판을 셉니다. 구간 칸의 숫자는 그 크기 판에서 실수가 그만큼 나온 산책의 수입니다.</div>
      ${playMistakeTable(R.mistakes)}
      <h3 class="sub">받지 않은 까닭 · 인터넷 없이 · 주의 표시</h3>${playBars(R.exclusions, "받지 않음 · 주의 표시")}
      <h3 class="sub">몇 시에 시작했나</h3>${playHours(R.hours)}`;
  }
  return head + subSecs(`play.${CHART_VIEW}`, body) + playRowsTable(labels);
}

/**
 * 보기 하나의 작은 제목(h3.sub)마다 접는 칸으로 나눈다(2026-10-08). 첫 제목 앞(카드)은 그대로 두고,
 * 첫 칸(날마다 그래프)만 펴 둔다. 칸 이름은 보기와 순서로 짓는다.
 */
function subSecs(prefix, html) {
  const parts = html.split('<h3 class="sub">');
  return parts[0] + parts.slice(1).map((p, i) => {
    const cut = p.indexOf("</h3>");
    return sec(`${prefix}.${i}`, p.slice(0, cut), p.slice(cut + 5), { sub: true, open: i === 0 });
  }).join("");
}

/** 차트 메뉴. 맨 위 하위 탭으로 지금 차트(전체)와 새 보기 셋을 오간다. */
function chartsView(statsErr) {
  const tabs = `<div class="subtabs stick">${CHART_VIEWS.map(([k, label]) =>
    `<button class="${CHART_VIEW === k ? "on" : ""}" data-chartview="${k}">${label}</button>`).join("")}</div>`;
  return tabs + (CHART_VIEW === "all" ? chartsTab(statsErr) : playTab());
}

// ------------------------------------------------------------------ 이벤트 실시간 순위 (103)
// 이벤트 목록에서 「순위」를 누르면 목록 아래에 그 이벤트의 순위 표가 열린다. 진행 중이면 화면이 보이는 동안만
// LE_RANK_REFRESH_MS마다 표만 다시 받고, LE_RANK_REFRESH_MAX_MS가 지나면 멈춘다(7절). 탭을 옮기면 끈다.

const LE_RANK_SIZE = 100;
const LE_RANK_REFRESH_MS = 30 * 1000;
const LE_RANK_REFRESH_MAX_MS = 30 * 60 * 1000;
let LE_OPEN = null, LE_RANK = [], LE_RANK_TOTAL = 0, LE_RANK_PAGE = 0, LE_RANK_ERR = null, LE_RANK_AT = 0;
let LE_TIMER = null, LE_TIMER_START = 0, LE_TIMER_STOPPED = false;

/** 받을 보상의 상태 → [이름, 알약 class]. 서버 claim_state(103·107)의 값이다. 보상은 우편함으로 받는다(18절). */
const CLAIM_STATE = {
  claimed: ["받음", "dim"],
  unclaimed: ["우편함에 있음", "warn"],
  expired: ["기한 지남", "heart"],
  pending: ["보내기 전 예상", "dim"],
};

async function loadLiveRanking() {
  if (LE_OPEN == null) return;
  try {
    LE_RANK = await rpc("admin_live_event_ranking", {
      p_id: Number(LE_OPEN), p_limit: LE_RANK_SIZE, p_offset: LE_RANK_PAGE * LE_RANK_SIZE,
    }) || [];
    LE_RANK_TOTAL = LE_RANK.length ? Number(LE_RANK[0].total_count) || 0 : 0;
    LE_RANK_ERR = null;
  } catch (e) { LE_RANK = []; LE_RANK_TOTAL = 0; LE_RANK_ERR = e; }
  LE_RANK_AT = Date.now();
}

/** 보상 칸. 코인·힌트·자동배치가 다 없으면 「—」. */
function rewardText(r) {
  const parts = [r.coins ? `코인 ${fmt(r.coins)}` : "", r.hints ? `힌트 ${r.hints}` : "", r.autos ? `자동 ${r.autos}` : ""].filter(Boolean);
  return parts.length ? esc(parts.join(" · ")) : '<span class="muted">—</span>';
}
const claimPill = (st) => (CLAIM_STATE[st] ? `<span class="pill ${CLAIM_STATE[st][1]}" style="margin-left:0">${CLAIM_STATE[st][0]}</span>` : '<span class="muted">—</span>');
/** 깃발 알약. 이름은 PLAY_LABEL_FALLBACK(서버 admin_play_reason_label과 같은 말)에서 읽는다. */
const flagPills = (flags) => (flags || []).map((x) =>
  `<span class="pill warn" style="margin:1px 2px">${esc(PLAY_LABEL_FALLBACK[x] || x)}</span>`).join("");

/** 이벤트 순위 상자 안쪽. 30초마다 이 부분만 다시 그린다. */
function liveRankingBox() {
  const e = LIVE_EVENTS.find((x) => String(x.id) === String(LE_OPEN));
  if (!e) return "";
  const live = e.state === "live";
  const refresh = live
    ? (LE_TIMER_STOPPED
        ? `<span class="muted" style="font-size:12.5px">${LE_RANK_REFRESH_MAX_MS / 60000}분이 지나 표를 저절로 새로 받는 것을 멈췄습니다.</span>
           <button class="ghost sm" id="leRankResume">다시 저절로 받기</button>`
        : `<span class="muted" style="font-size:12.5px">${LE_RANK_REFRESH_MS / 1000}초마다 순위 표만 새로 받습니다. 마지막으로 받은 때 ${esc(fmtTime(new Date(LE_RANK_AT).toISOString()))}</span>`)
    : "";
  const pages = Math.max(1, Math.ceil(LE_RANK_TOTAL / LE_RANK_SIZE));
  const leKey = `lerank|${LE_OPEN}|${LE_RANK_PAGE}`;
  const rows = moreRows(leKey, LE_RANK.map((r) => {
    const x = r.extra || {};
    return `<tr>
      <td class="num fit">${r.rank == null ? '<span class="muted">—</span>' : r.rank}</td>
      <td>${r.profile_id ? `<button class="plink" data-member="${esc(r.profile_id)}">${esc(r.username || String(r.profile_id).slice(0, 8))}</button>` : '<span class="muted">탈퇴</span>'}${
        r.test_account ? '<span class="pill dim">시험 계정</span>' : ""}</td>
      <td class="num">${fmt(r.value)}</td>
      <td class="num">${fmt(r.tie)}</td>
      <td class="num">${x.continues == null ? "—" : fmt(x.continues)}</td>
      <td class="num">${x.walk_ms == null ? "—" : fmtDur(x.walk_ms)}</td>
      <td class="num">${fmt(r.runs)}</td>
      <td>${flagPills(r.flags)}</td>
      <td class="long">${r.excluded_at ? `<span class="pill heart" style="margin-left:0">순위에서 뺌</span> ${esc(r.exclude_reason || "")}` : ""}</td>
      <td>${rewardText(r)}</td>
      <td class="c">${claimPill(r.claim_state)}</td>
      <td>${esc(PLATFORM_NAMES[r.platform] || r.platform || "")} ${r.build ?? ""}</td>
      <td>${esc(fmtDateTime(r.achieved_at))}</td>
      <td>${r.profile_id && !r.excluded_at ? `<button class="danger sm" data-le-exclude="${esc(r.profile_id)}" data-name="${esc(r.username || "")}">순위에서 빼기</button>` : ""}</td>
    </tr>`;
  }));
  return `<h2>#${e.id} ${esc(e.name_ko)} 순위</h2>
    <div class="cards">
      <div class="card" data-z><div class="label">참여한 사람</div><div class="value">${fmt(e.participants)}</div></div>
      <div class="card" data-z><div class="label">순위에 든 사람</div><div class="value">${fmt(e.ranked)}</div></div>
      <div class="card" data-z><div class="label">산책 횟수</div><div class="value">${fmt(e.runs)}</div></div>
      <div class="card"><div class="label">${e.settled_at ? "보낸 보상 · 받아 감" : "보상"}</div><div class="value">${e.settled_at ? `${fmt(e.grants)} · ${fmt(e.claimed)}` : "보내기 전"}</div></div>
      ${live ? `<div class="card"><div class="label">끝날 때까지</div><div class="value">${fmtSpan(new Date(e.effective_end) - Date.now())}</div></div>` : ""}
    </div>
    <div class="toolbar">${refresh}<div style="flex:1"></div>
      <button class="ghost sm" data-le-stats="${e.id}">차트로 보기</button>
      <button class="ghost sm" id="leRankClose">순위 접기</button></div>
    <div class="muted" style="font-size:12px;margin-bottom:6px">등수가 없는 줄은 한 판도 못 걸었거나, 순위에서 뺐거나, 시험 계정입니다. 보상은 이벤트가 끝나면 우편함으로 가고, 보낸 날부터 ${RANK_CLAIM_DAYS}일 안에 받아야 합니다.</div>
    ${LE_RANK_ERR ? loadFail("순위를 불러오지 못했습니다.", LE_RANK_ERR, "sql/migrations/103_live_events.sql")
      : LE_RANK.length ? `<div class="table-scroll"><table data-z="cols">
        <thead><tr><th class="num fit">등수</th><th>닉네임</th><th class="num">걸은 판 수</th><th class="num">보탠 뼈${infoTip("산책 중 쉼터에서 사거나 이어 걷기로 더 받은 뼈다귀 수입니다. 걸은 판 수가 같으면 이 값이 적은 사람이 앞입니다.")}</th><th class="num">이어 걷기</th>
          <th class="num">산책 시간</th><th class="num">산책 횟수</th><th>주의 표시</th><th>순위에서 뺌</th><th>보상</th><th class="c">받았나</th><th>기기 · 빌드</th><th>기록 낸 때</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>${moreBar(leKey, LE_RANK.length)}
        ${pages > 1 ? `<div class="toolbar" style="margin-top:8px">
          <button class="ghost sm" id="leRankPrev" ${LE_RANK_PAGE ? "" : "disabled"}>이전</button>
          <span class="muted">${LE_RANK_PAGE + 1} / ${pages}쪽 · ${fmt(LE_RANK_TOTAL)}명</span>
          <button class="ghost sm" id="leRankNext" ${LE_RANK_PAGE + 1 < pages ? "" : "disabled"}>다음</button></div>` : ""}`
      : '<div class="empty">아직 참여한 사람이 없습니다</div>'}`;
}

/** 순위 상자만 다시 그리고 그 안의 버튼을 다시 건다. */
function redrawLiveRanking() {
  const box = $("#leRankBox");
  if (!box) return;
  box.innerHTML = liveRankingBox();
  pruneZeros(box);
  bindLiveRanking();
}

function bindLiveRanking() {
  const box = $("#leRankBox");
  if (!box) return;
  const reload = async () => { await loadLiveRanking(); redrawLiveRanking(); };
  if ($("#leRankClose")) $("#leRankClose").onclick = () => { LE_OPEN = null; stopLiveRankTimer(); render(); };
  if ($("#leRankPrev")) $("#leRankPrev").onclick = () => { LE_RANK_PAGE = Math.max(0, LE_RANK_PAGE - 1); reload(); };
  if ($("#leRankNext")) $("#leRankNext").onclick = () => { LE_RANK_PAGE += 1; reload(); };
  if ($("#leRankResume")) $("#leRankResume").onclick = () => { LE_TIMER_STOPPED = false; startLiveRankTimer(true); reload(); };
  box.querySelectorAll("[data-le-exclude]").forEach((b) => {
    b.onclick = () => excludeFromLiveEvent(b.dataset.leExclude, b.dataset.name);
  });
  box.querySelectorAll("[data-member]").forEach((b) => { b.onclick = () => openMember(b.dataset.member); });
  box.querySelectorAll("[data-le-stats]").forEach((b) => {
    b.onclick = () => {
      TAB = "charts"; CHART_VIEW = "event"; PLAY_EVENT = Number(b.dataset.leStats);
      PLAY_FILTER = null; PLAY_PAGE = 0;
      refresh();
    };
  });
}

function stopLiveRankTimer() {
  clearInterval(LE_TIMER);
  LE_TIMER = null;
}

/** 진행 중 이벤트의 순위 상자가 열려 있을 때만 돈다. reset이면 30분 시계를 처음부터 잰다. */
function startLiveRankTimer(reset = false) {
  const e = LIVE_EVENTS.find((x) => String(x.id) === String(LE_OPEN));
  if (TAB !== "liveevents" || !e || e.state !== "live" || LE_TIMER_STOPPED) { stopLiveRankTimer(); return; }
  if (reset || !LE_TIMER_START) LE_TIMER_START = Date.now();
  if (LE_TIMER) return;
  LE_TIMER = setInterval(async () => {
    if (TAB !== "liveevents" || LE_OPEN == null || !$("#leRankBox")) { stopLiveRankTimer(); return; }
    if (document.hidden) return;   // 화면이 안 보이면 받지 않는다
    if (Date.now() - LE_TIMER_START > LE_RANK_REFRESH_MAX_MS) {
      LE_TIMER_STOPPED = true;
      stopLiveRankTimer();
      redrawLiveRanking();
      return;
    }
    await loadLiveRanking();
    redrawLiveRanking();
  }, LE_RANK_REFRESH_MS);
}

async function openLiveRanking(id) {
  if (String(LE_OPEN) === String(id)) { LE_OPEN = null; stopLiveRankTimer(); render(); return; }
  LE_OPEN = Number(id);
  LE_RANK_PAGE = 0;
  LE_TIMER_STOPPED = false;
  LE_TIMER_START = 0;
  stopLiveRankTimer();
  await loadLiveRanking();
  render();
  $("#leRankBox")?.scrollIntoView({ block: "start" });
}

/** 결과 → 알림 문구. 서버 admin_live_event_exclude·admin_rank_exclude가 돌려주는 값이다. */
const EXCLUDE_RESULT = {
  excluded: "순위에서 뺐습니다.",
  revoked: "순위에서 뺐고, 아직 안 받은 보상을 거둬들였습니다.",
  already_claimed: "순위에서 뺐지만 보상은 이미 받아 가서 되돌리지 못했습니다.",
  not_found: "이 기간에 그 회원의 줄이 없습니다.",
};
const EXCLUDE_HOW = "보상을 보내기 전이면 순위에서만 빠집니다. 보낸 뒤라면 아직 안 받은 보상은 거둬들이고, 이미 받아 간 보상은 되돌리지 못합니다. 아래 등수 사람을 한 칸씩 올려 주지는 않습니다.";

async function excludeFromLiveEvent(profileId, name) {
  if (!confirm(`${name || profileId.slice(0, 8)} 회원을 #${LE_OPEN} 이벤트 순위에서 뺍니다.\n\n${EXCLUDE_HOW}\n\n계속할까요?`)) return;
  const reason = askReasonRequired("이벤트 순위에서 빼기");
  if (reason === null) return;
  await act(async () => {
    const r = await rpc("admin_live_event_exclude", { p_id: Number(LE_OPEN), p_profile_id: profileId, p_reason: reason });
    alert(EXCLUDE_RESULT[r] || String(r));
  }, refresh);
}

/** 회원 목록에서 이 회원을 찾아 이력을 펼친다. 원본 표와 순위 표의 닉네임이 쓴다. */
async function openMember(id) {
  PLAYER_FILTER = null; QUERY = id; PLAYER_PAGE = 0; TAB = "players";
  await refresh();
  if (findPlayer(id) && OPEN_MEMBER !== id) toggleMember(id);
}

// ------------------------------------------------------------------ 랭킹 메뉴: 오늘 점수 · 오늘의 퍼즐 기록 · 숫자 (107)

const RANK_VIEWS = [["today", "오늘 점수"], ["daily_time", "오늘의 퍼즐 기록"], ["number", "숫자 퍼즐"]];
let RANK_VIEW = "today";
/** 기록 랭킹 한 기간의 표. REC_PERIOD가 비면 지금 기간이다(서버가 정한다). */
let REC_ROWS = [], REC_TOTAL = 0, REC_PAGE = 0, REC_PERIOD = "", REC_ERR = null;
const REC_SIZE = 50;
/** 시험 계정(107). null이면 못 읽었다(107 전 서버). */
let TEST_ACCOUNTS = null, TEST_SET = new Set();
/** 숫자 기간 고르기에 늘어놓을 지난 기간 수. */
const NUMBER_PERIOD_CHOICES = { week: 8, day: 14 };

async function loadRecordRanking() {
  try {
    REC_ROWS = await rpc("admin_record_ranking", {
      p_kind: RANK_VIEW, p_period_key: REC_PERIOD || null, p_limit: REC_SIZE, p_offset: REC_PAGE * REC_SIZE,
    }) || [];
    REC_TOTAL = REC_ROWS.length ? Number(REC_ROWS[0].total_count) || 0 : 0;
    REC_ERR = null;
  } catch (e) { REC_ROWS = []; REC_TOTAL = 0; REC_ERR = e; }
}

async function loadTestAccounts() {
  try {
    TEST_ACCOUNTS = await rpc("admin_test_accounts") || [];
  } catch { TEST_ACCOUNTS = null; }
  TEST_SET = new Set((TEST_ACCOUNTS || []).map((t) => String(t.profile_id)));
}

/** 숫자 기간 열쇠(101 rank_period)를 사람이 읽는 말로. w:2026-10-05 → 「10/05 주」, d:2026-10-05 → 「10/05」. */
function numberPeriodLabel(key) {
  const m = /^([wd]):(\d{4}-\d{2}-\d{2})$/.exec(String(key || ""));
  if (!m) return String(key || "");
  return m[1] === "w" ? `${lcShortDate(m[2])} 주 (월~일)` : lcShortDate(m[2]);
}

/** 숫자 기간 열쇠 → 한국 날짜 [처음, 끝]. 통계로 넘어갈 때 쓴다. */
function numberPeriodRange(key) {
  const m = /^([wd]):(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!m) return null;
  const d0 = new Date(Date.UTC(+m[2], +m[3] - 1, +m[4]));
  const d1 = new Date(d0.getTime() + (m[1] === "w" ? 6 : 0) * 86400e3);
  return [d0.toISOString().slice(0, 10), d1.toISOString().slice(0, 10)];
}

/** 고를 수 있는 숫자 기간. 지금 설정의 기간 방식으로 최근 몇 개를 만든다. 서버 rank_period(101)와 같은 셈이다. */
function numberPeriodChoices() {
  const day = CONFIG?.number_mode?.period === "day";
  const today = kstDate(0);
  const t = new Date(`${today}T00:00:00Z`);
  const out = [];
  if (day) {
    for (let i = 0; i < NUMBER_PERIOD_CHOICES.day; i++) out.push(`d:${new Date(t.getTime() - i * 86400e3).toISOString().slice(0, 10)}`);
  } else {
    const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400e3);
    for (let i = 0; i < NUMBER_PERIOD_CHOICES.week; i++) out.push(`w:${new Date(monday.getTime() - i * 7 * 86400e3).toISOString().slice(0, 10)}`);
  }
  return out;
}

/** 시험 계정 표. 랭킹 세 탭 맨 아래에 같은 것을 둔다. */
function testAccountsSection() {
  if (TEST_ACCOUNTS === null) {
    return sec("rank.tests", "시험 계정", loadFail("시험 계정 목록을 불러오지 못했습니다.", "", "sql/migrations/107_admin_records.sql"));
  }
  return sec("rank.tests", `시험 계정 · ${fmt(TEST_ACCOUNTS.length)}명`, `
    <div class="muted" style="font-size:12.5px;margin-bottom:6px">시험 계정은 오늘 점수, 기록전, 숫자 퍼즐 랭킹과 이벤트 순위에서 빠지고, 푸시를 순위 조건으로 보낼 때도 빠집니다.
      차트에서는 「시험 계정도 세기」를 켜야 셉니다. 지정은 회원 목록의 「시험 계정으로」 버튼으로 합니다.</div>
    ${TEST_ACCOUNTS.length ? `<div class="table-scroll"><table>
      <thead><tr><th>닉네임</th><th>까닭</th><th>지정한 때</th><th></th></tr></thead>
      <tbody>${TEST_ACCOUNTS.map((t) => `<tr>
        <td>${t.profile_id ? `<button class="plink" data-member="${esc(t.profile_id)}">${esc(t.username || String(t.profile_id).slice(0, 8))}</button>` : '<span class="muted">탈퇴</span>'}</td>
        <td class="long">${esc(t.reason || "")}</td>
        <td>${esc(fmtDateTime(t.created_at))}</td>
        <td><button class="ghost sm" data-testoff="${esc(t.profile_id)}" data-name="${esc(t.username || "")}">시험 계정 풀기</button></td>
      </tr>`).join("")}</tbody></table></div>` : '<div class="empty">시험 계정이 없습니다</div>'}`);
}

/** 시험 계정 지정·해제. 지정은 사유가 필수다(서버 admin_set_test_account). */
async function setTestAccount(id, on, name = "") {
  const who = name || findPlayer(id)?.username || String(id).slice(0, 8);
  if (on) {
    if (!confirm(`${who} 회원을 시험 계정으로 지정합니다.\n\n오늘 점수, 기록전, 숫자 퍼즐 랭킹과 이벤트 순위에서 빠지고, 푸시를 순위 조건으로 보낼 때도 빠집니다.\n계속할까요?`)) return;
    const reason = askReasonRequired("시험 계정 지정");
    if (reason === null) return;
    await act(() => rpc("admin_set_test_account", { p_profile_id: id, p_on: true, p_reason: reason }), refresh);
  } else {
    if (!confirm(`${who} 회원의 시험 계정 지정을 풉니다. 다시 랭킹에 들어갑니다.`)) return;
    const reason = askReason("시험 계정 풀기");
    if (reason === null) return;
    await act(() => rpc("admin_set_test_account", { p_profile_id: id, p_on: false, p_reason: reason }), refresh);
  }
}

/** 기록 랭킹 줄의 상태 이름. 서버 admin_play_reason_label과 같은 말(PLAY_LABEL_FALLBACK)이고 숫자 갈래 둘을 더한다. */
const REC_STATUS = { ...PLAY_LABEL_FALLBACK, counted: "점수에 든 판 있음", rejected: "기록 확인 실패", late: "마감 뒤 도착" };
/** 기록전 시작 방식(107 start_mode). */
const START_MODE = { server: "온라인에서 시작", offline: "인터넷 없이 시작", late_stamp: "시작 알림이 늦게 닿음" };

/** 오늘의 퍼즐 기록 · 숫자 탭. */
function recordRankingTab() {
  const kind = RANK_VIEW;
  const label = RANK_VIEWS.find(([k]) => k === kind)?.[1] ?? kind;
  const today = kstDate(0);
  const per = REC_ROWS[0]?.period_key || REC_PERIOD;
  const pick = kind === "daily_time"
    ? `<input type="date" id="recDate" value="${esc(REC_PERIOD || today)}" max="${today}">
       <button class="sm" id="recToday">오늘</button>`
    : `<select id="recPeriod"><option value="" ${REC_PERIOD ? "" : "selected"}>지금 진행 중인 기간</option>${
        numberPeriodChoices().map((k) => `<option value="${k}" ${k === REC_PERIOD ? "selected" : ""}>${esc(numberPeriodLabel(k))}</option>`).join("")}</select>`;
  const how = kind === "daily_time"
    ? "그날 오늘의 퍼즐을 빨리 푼 순위입니다. 걸린 시간이 짧은 순이고, 같으면 실수가 적은 순입니다. 매일 한국시간 0시에 마감합니다."
    : `숫자 퍼즐 한 기간의 순위입니다. 기간과 랭킹 점수 세는 법은 운영 → 업데이트·게임 설정의 숫자 퍼즐 칸을 따릅니다.${per ? ` 지금 보는 기간: ${esc(numberPeriodLabel(per))}` : ""}`;
  const rec = (r) => (kind === "daily_time" ? (r.value == null ? "—" : fmtDur(r.value)) : r.value == null ? "—" : fmt(r.value));
  const pages = Math.max(1, Math.ceil(REC_TOTAL / REC_SIZE));
  const recKey = `rank.rec|${kind}|${REC_PERIOD}|${REC_PAGE}`;
  const rows = moreRows(recKey, REC_ROWS.map((r) => `<tr>
      <td class="num fit">${r.rank == null ? '<span class="muted">—</span>' : r.rank}</td>
      <td>${r.profile_id ? `<button class="plink" data-member="${esc(r.profile_id)}">${esc(r.username || String(r.profile_id).slice(0, 8))}</button>` : '<span class="muted">탈퇴</span>'}${
        r.test_account ? '<span class="pill dim">시험 계정</span>' : ""}</td>
      <td class="num">${rec(r)}</td>
      <td class="num">${kind === "daily_time" ? (r.extra ?? "—") : `${fmt(r.extra)} / ${fmt(r.boards)}`}</td>
      <td class="c">${esc(REC_STATUS[r.status] || r.status || "")}</td>
      <td class="long">${esc((r.reason || "").split(",").filter(Boolean).map((x) => PLAY_REASON[x] || x).join(", "))}</td>
      <td>${flagPills(r.flags)}</td>
      <td>${esc(PLATFORM_NAMES[r.platform] || r.platform || "")} ${r.build ?? ""}</td>
      ${kind === "daily_time" ? `<td>${esc(START_MODE[r.start_mode] || r.start_mode || "")}</td>` : ""}
      <td>${esc(fmtDateTime(r.submitted_at))}</td>
      <td>${rewardText(r)}</td>
      <td class="c">${claimPill(r.claim_state)}</td>
      <td>${r.profile_id && r.status !== "excluded" ? `<button class="danger sm" data-rec-exclude="${esc(r.profile_id)}" data-name="${esc(r.username || "")}">순위에서 빼기</button>` : ""}</td>
    </tr>`));
  return `
    <div class="notice">${how}
      랭킹이 마감되면 보상이 <b>우편함</b>으로 가고, 보낸 날부터 ${RANK_CLAIM_DAYS}일 안에 받아야 합니다. 아직 보상을 보내기 전인 줄의 「받을 보상」은 지금 보상표로 계산한 예상입니다.</div>
    <div class="toolbar">${pick}
      <div style="flex:1"></div>
      <button class="ghost sm" id="recStats" title="차트 메뉴에서 이 기간의 판 하나하나를 봅니다">차트로 보기</button>
    </div>
    ${sec(`rank.${kind}.list`, `${esc(label)} 참가자 · ${fmt(REC_TOTAL)}명`, `
    ${REC_ERR ? loadFail("랭킹을 불러오지 못했습니다.", REC_ERR, "sql/migrations/107_admin_records.sql")
      : REC_ROWS.length ? `<div class="table-scroll"><table>
        <thead><tr><th class="num fit">등수</th><th>닉네임</th><th class="num">${kind === "daily_time" ? "기록" : "점수"}</th>
          <th class="num">${kind === "daily_time" ? "실수" : "점수에 든 판 / 전체 판"}</th><th class="c">상태</th><th>빠진 까닭</th><th>주의 표시</th><th>기기 · 빌드</th>
          ${kind === "daily_time" ? "<th>시작 방식</th>" : ""}<th>${kind === "daily_time" ? "올라온 시각" : "마지막으로 올라온 때"}</th><th>받을 보상</th><th class="c">받았나</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>${moreBar(recKey, REC_ROWS.length)}
        ${pages > 1 ? `<div class="toolbar" style="margin-top:8px">
          <button class="ghost sm" id="recPrev" ${REC_PAGE ? "" : "disabled"}>이전</button>
          <span class="muted">${REC_PAGE + 1} / ${pages}쪽</span>
          <button class="ghost sm" id="recNext" ${REC_PAGE + 1 < pages ? "" : "disabled"}>다음</button></div>` : ""}`
      : '<div class="empty">이 기간에 기록이 없습니다</div>'}`, { open: true })}
    ${sec(`rank.${kind}.reward`, `${esc(label)} 보상`, rankRewardEditor(`rank_rewards_${kind}`, label), { note: rewardNote(`rank_rewards_${kind}`) })}
    ${testAccountsSection()}`;
}

/** 기록 랭킹 사유 코드의 이름. 107 admin_play_reason_label과 같은 말이다(관리자 제외·서버 확인 안 됨 등 순위 표에 나오는 것만). */
const PLAY_REASON = {
  admin: "관리자가 뺌", unverified: "서버가 시간을 확인 못 함", game_over: "뼈다귀 다 씀", offline_check: "휴대폰 시각 확인 불가",
  closed: "마감 뒤 도착", unfinished: "마감 전에 못 끝냄", rejected: "기록 확인 실패", before_update: "업데이트 전에 본 퍼즐",
  too_fast: "너무 빠름", too_slow: "너무 오래 걸림", score_over: "나올 수 없는 점수", late: "늦게 도착", game_reset: "게임 초기화",
  off: "기능 꺼짐", old_build: "옛 버전 앱", future: "아직 안 온 기간",
};

async function excludeFromRecordRanking(profileId, name) {
  const per = REC_ROWS[0]?.period_key || REC_PERIOD;
  if (!per) return;
  const label = RANK_VIEW === "number" ? numberPeriodLabel(per) : per;
  if (!confirm(`${name || profileId.slice(0, 8)} 회원을 ${label} 랭킹에서 뺍니다.\n\n${EXCLUDE_HOW}` +
               (RANK_VIEW === "number" ? "\n숫자 퍼즐은 이 기간에 앞으로 깨는 판도 점수에 넣지 않습니다." : "") + "\n\n계속할까요?")) return;
  const reason = askReasonRequired("랭킹 순위에서 빼기");
  if (reason === null) return;
  await act(async () => {
    const r = await rpc("admin_rank_exclude", { p_kind: RANK_VIEW, p_period_key: per, p_profile_id: profileId, p_reason: reason });
    alert(EXCLUDE_RESULT[r] || String(r));
  }, refresh);
}

/** 랭킹 메뉴. 맨 위 하위 탭으로 오늘 점수와 기록 랭킹 둘을 오간다. */
function rankingView(err) {
  const tabs = `<div class="subtabs stick">${RANK_VIEWS.map(([k, label]) =>
    `<button class="${RANK_VIEW === k ? "on" : ""}" data-rankview="${k}">${label}</button>`).join("")}</div>`;
  if (RANK_VIEW !== "today") return tabs + recordRankingTab();
  return tabs + rankingTab(err) + sec("rank.today.reward", "오늘 점수 보상", rankRewardEditor("rank_rewards", "오늘 점수"),
    { note: rewardNote("rank_rewards") }) + testAccountsSection();
}

// ------------------------------------------------------------------ 설정: 오늘의 퍼즐 기록전 · 숫자 퍼즐 (101·102)
// app_config의 daily_record, level_mode, number_mode를 고친다. 서버 daily_record_cfg·number_mode_cfg는 기본값 위에 이 값을 덮으므로
// 칸을 비우면 그 키를 빼서 서버 기본값으로 돌아간다. 화면에 없는 키는 그대로 둔다.

// 숫자 퍼즐 「랭킹 점수 세는 법」의 서버 기본값(102 number_mode_cfg). 칸을 「기본값 쓰기」로 두었을 때 예시와
// 「③일 때 더할 판 수」 흐리기가 이 값을 읽는다.
const NUMBER_BASIS_DEFAULT = "per_size";

// 「랭킹 점수 세는 법」 아래에 보이는 예. 한 주에 6×6을 800·900점 두 판, 7×7을 1,000점 한 판, 8×8을 1,200점 한 판 깬 사람이다.
const NUMBER_BASIS_WEEK = "예시 한 주: 6×6을 800점과 900점 두 판, 7×7을 1,000점 한 판, 8×8을 1,200점 한 판 깬 사람";
const NUMBER_BASIS_EXAMPLES = {
  per_size: "6×6은 더 높은 900점만 셉니다. 900 + 1,000 + 1,200 = 3,100점",
  sum: "깬 판을 모두 더합니다. 800 + 900 + 1,000 + 1,200 = 3,900점",
  best_n: "판 수가 2라면 점수 높은 두 판만 더합니다. 1,200 + 1,000 = 2,200점",
  day_best: "가장 높은 한 판만 셉니다. 1,200점",
};

// 칸마다 help는 늘 보이는 한 줄, tip은 「?」 배지에 넣는 긴 설명과 예다.
const BUILD_TIP = "빌드 번호는 앱을 스토어에 올릴 때마다 하나씩 붙는 숫자입니다. 예: 1.5.1은 52. iOS와 AOS는 둘 다 적거나 둘 다 비워야 합니다.";
const CFG_EDITORS = {
  daily_record: {
    title: "오늘의 퍼즐 기록전",
    note: "오늘의 퍼즐을 누가 더 빨리 푸는지 겨루는 랭킹입니다. 어떤 기록을 받고 어떤 기록을 순위에 넣을지 정합니다. 칸을 비우면 기본값을 씁니다.",
    tip: "시간 칸의 숫자는 1000분의 1초 단위입니다. 1000이 1초, 60000이 1분, 3600000이 1시간입니다. 칸 옆에 시간으로 바꿔 보여 줍니다.",
    fields: [
      { k: "enabled", type: "bool", label: "기록전 켜기", help: "끄면 앱에서 기록전이 열리지 않습니다" },
      { k: "offline_ok", type: "bool", label: "인터넷 없이 시작한 기록도 받기", help: "끄면 인터넷이 끊긴 채 시작한 기록은 랭킹에서 빠집니다" },
      { k: "rank_unverified", type: "bool", label: "서버가 시간을 확인 못 한 기록도 순위에 넣기",
        help: "끄면 이런 기록은 순위에서 빠집니다",
        tip: "다 풀고 나서 늦게 올라와서, 서버가 걸린 시간을 직접 확인하지 못한 기록입니다. 인터넷이 잠깐 끊겼던 사람에게 흔합니다." },
      { k: "min_build.ios", type: "int", label: "iOS 앱 최소 빌드 번호", help: "이 번호보다 낮은 앱의 기록은 받지 않습니다", tip: BUILD_TIP },
      { k: "min_build.android", type: "int", label: "AOS 앱 최소 빌드 번호", help: "이 번호보다 낮은 앱의 기록은 받지 않습니다", tip: BUILD_TIP },
      { k: "max_ms", type: "int", ms: true, label: "가장 오래 걸려도 되는 시간", help: "이보다 오래 걸린 기록은 받지 않습니다" },
      { k: "min_ms_per_dog", type: "int", ms: true, label: "한 마리당 최소 시간",
        help: "이보다 빨리 풀면 사람이 낼 수 없는 기록으로 보고 받지 않습니다",
        tip: "판의 강아지 수 × 이 값이 기준입니다. 예: 600이고 강아지가 8마리면 4.8초보다 빠른 기록을 받지 않습니다." },
      { k: "suspect_ms_per_dog", type: "int", ms: true, label: "의심 표시 기준 · 한 마리당",
        help: "이보다 빠르면 받기는 하고 「빠름」 표시를 붙입니다",
        tip: "판의 강아지 수 × 이 값이 기준입니다. 예: 1500이고 8마리면 12초보다 빠른 기록에 표시가 붙습니다. 랭킹 메뉴에서 보고 직접 순위에서 뺄 수 있습니다." },
      { k: "min_gap_ms", type: "int", ms: true, label: "강아지를 놓는 최소 간격",
        help: "두 마리를 놓은 간격이 이보다 짧으면 받지 않습니다",
        tip: "사람 손으로는 그렇게 빨리 연달아 놓을 수 없어서, 자동 입력 프로그램을 쓴 것으로 봅니다." },
      { k: "slack_ms", type: "int", ms: true, label: "휴대폰 시계 오차 봐주기",
        help: "휴대폰 시계와 서버 시계가 이만큼 달라도 넘어갑니다",
        tip: "이보다 더 다르면 기록을 받지 않습니다. 휴대폰 시계를 돌려 기록을 줄이는 것을 막습니다." },
      { k: "stamp_fresh_ms", type: "int", ms: true, label: "시작 알림이 닿아야 하는 시간",
        help: "늦으면 인터넷 없이 시작한 기록으로 봅니다",
        tip: "판을 시작하면 앱이 서버에 알립니다. 이 시간 안에 닿으면 앱이 잰 시작 시각을 믿고, 늦게 닿으면 인터넷 없이 시작한 기록으로 다룹니다." },
      { k: "late_stamp_max_ms", type: "int", ms: true, label: "인터넷 없이 시작했을 때 허용 차이",
        help: "시작 시각이 이보다 벌어지면 받지 않습니다",
        tip: "인터넷 없이 시작한 기록에서, 앱이 적은 시작 시각과 서버가 처음 알게 된 시각의 차이입니다." },
      { k: "online_grace_ms", type: "int", ms: true, label: "다 풀고 올라오기까지 허용 시간",
        help: "늦게 올라오면 서버가 확인 못 한 기록이 됩니다",
        tip: "다 풀고 이 시간 안에 서버에 올라오면 서버가 걸린 시간을 직접 확인한 기록이 됩니다. 위의 「서버가 시간을 확인 못 한 기록도 순위에 넣기」와 함께 움직입니다." },
    ],
  },
  // 1.5.0. 앱이 coin_pct만 읽는다. 서버 함수는 이 키를 보지 않는다. 비율 위쪽 한도는 두지 않는다(100 넘게도 된다).
  level_mode: {
    title: "레벨 판 코인",
    note: "레벨 판을 깨면 받는 코인을 조절합니다. 1.5.0 이상 앱에만 적용되고, 1.4.4 이하 앱은 예전 그대로 받습니다. 칸을 비우면 기본값을 씁니다.",
    fields: [
      { k: "coin_pct", type: "int", label: "판 클리어 코인 비율 (%)", help: "100이면 그대로, 50이면 절반입니다",
        tip: "점수 ÷ 100이 기본 코인이고, 4개보다 적으면 4개입니다. 여기에 이 비율을 곱합니다. 예: 점수 1,000이면 기본 10개, 비율 50이면 5개입니다. 100보다 크게 넣어도 됩니다." },
    ],
  },
  number_mode: {
    title: "숫자 퍼즐",
    note: "숫자 퍼즐의 랭킹과 코인 설정입니다. 칸을 비우면 기본값을 씁니다. "
      + "「주의」 랭킹 점수 세는 법을 기간 중간에 바꾸면 지금 순위가 바로 달라집니다. 새 기간이 막 시작했을 때 바꾸세요.",
    fields: [
      { k: "enabled", type: "bool", label: "숫자 퍼즐 켜기", help: "끄면 앱 홈에서 숫자 퍼즐이 사라지고, 새로 깬 판은 랭킹에 들어가지 않습니다" },
      { k: "min_build.ios", type: "int", label: "iOS 앱 최소 빌드 번호", help: "이 번호보다 낮은 앱에서 깬 판은 랭킹에 넣지 않습니다", tip: BUILD_TIP },
      { k: "min_build.android", type: "int", label: "AOS 앱 최소 빌드 번호", help: "이 번호보다 낮은 앱에서 깬 판은 랭킹에 넣지 않습니다", tip: BUILD_TIP },
      { k: "period", type: "select", label: "랭킹 기간", opts: [["week", "매주 · 한국시간 월요일 0시 마감"], ["day", "매일 · 한국시간 0시 마감"]],
        help: "한 랭킹이 이어지는 기간입니다", tip: "기간이 끝나면 순위대로 보상을 우편함으로 보냅니다. 보상표는 랭킹 메뉴의 숫자 퍼즐 탭 아래에 있습니다." },
      { k: "rank_basis", type: "select", label: "랭킹 점수 세는 법", def: NUMBER_BASIS_DEFAULT, examples: NUMBER_BASIS_EXAMPLES, exampleHead: NUMBER_BASIS_WEEK,
        opts: [["per_size", "① 크기마다 최고점 하나씩"], ["sum", "② 전부 더하기"], ["best_n", "③ 상위 몇 판만 더하기"], ["day_best", "④ 최고점 한 판"]],
        help: "기간 동안 깬 판의 점수를 어떻게 모아 랭킹 점수로 만들지 정합니다",
        tip: "① 판 크기마다 가장 높은 점수 하나씩만 더합니다. 여러 크기를 고루 해야 유리합니다. "
          + "② 깬 판을 모두 더합니다. 많이 할수록 유리합니다. "
          + "③ 점수 높은 판을 정한 수만큼만 더합니다. 판 수는 아래 칸에서 정합니다. "
          + "④ 가장 높은 한 판만 셉니다." },
      { k: "best_n", type: "int", label: "③일 때 더할 판 수", onlyIf: ["rank_basis", "best_n"],
        help: "「③ 상위 몇 판만 더하기」를 골랐을 때만 씁니다", tip: "예: 20이면 기간 중 점수가 높은 20판만 더합니다." },
      { k: "coin_pct", type: "int", label: "판 클리어 코인 비율 (%)", help: "100이면 레벨 판과 같고, 50이면 절반입니다",
        tip: "숫자 퍼즐 판을 깨면 받는 코인에 이 비율을 곱합니다." },
      { k: "late_grace_min", type: "int", label: "마감 뒤 더 받아 주는 시간 (분)",
        help: "기간이 끝난 뒤에도 이 시간 안에 올라온 판은 받습니다",
        tip: "인터넷이 늦게 붙은 사람을 위한 여유입니다. 예: 10이면 마감 뒤 10분까지 올라온 판을 받습니다." },
      { k: "min_ms_per_dog", type: "int", ms: true, label: "한 마리당 최소 시간",
        help: "이보다 빨리 깬 판은 사람이 낼 수 없는 기록으로 보고 받지 않습니다",
        tip: "판 크기 × 이 값이 기준입니다. 예: 600이고 6×6 판이면 3.6초보다 빨리 깬 판을 받지 않습니다." },
      { k: "suspect_ms_per_dog", type: "int", ms: true, label: "의심 표시 기준 · 한 마리당",
        help: "이보다 빨리 깨면 받기는 하고 「빠름」 표시를 붙입니다",
        tip: "판 크기 × 이 값이 기준입니다. 예: 1500이고 6×6 판이면 9초보다 빨리 깬 판에 표시가 붙습니다." },
      { k: "slack_ms", type: "int", ms: true, label: "휴대폰 시계 오차 봐주기", help: "휴대폰 시계와 서버 시계가 이만큼 달라도 넘어갑니다" },
    ],
  },
  // 110. 서버 mailbox_send_rank_push가 enabled가 참일 때만 보낸다. 다른 설정과 달리 기본이 꺼짐이다.
  mailbox_rank_push: {
    title: "랭킹 보상 도착 푸시",
    note: "켜면 매일 한국시간 12시에 랭킹 보상을 나눠 준 뒤, 새로 보상을 받은 사람에게 「우편함 / 랭킹 보상이 도착했어요.」 알림을 보냅니다. 처음에는 꺼져 있습니다.",
    tip: "오늘 점수, 기록전, 숫자 퍼즐, 이벤트 보상이 모두 해당하고, 광고가 아닌 서비스 안내로 각자의 앱 언어에 맞춰 나갑니다. "
      + "한 사람에게 하루 한 통이고, 같은 보상으로 두 번 보내지 않습니다. 1.5.0 이상 앱을 쓴 적이 있고 광고성 정보 알림을 켠 사람에게만 갑니다.",
    fields: [
      { k: "enabled", type: "bool", label: "랭킹 보상 도착 푸시 켜기", def: false },
    ],
  },
};

/** ms를 사람이 읽는 길이로. 6시간, 2분, 1.5초처럼. 값이 비었거나 숫자가 아니면 빈 글자. */
function msText(v) {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n) || n < 0) return "";
  if (n < 1000) return `${n / 1000}초`;
  const sec = n / 1000;
  if (sec < 60) return `${Math.round(sec * 10) / 10}초`;
  const min = sec / 60;
  if (min < 60) return `${Math.round(min * 10) / 10}분`;
  return `${Math.round(min / 6) / 10}시간`;
}

const cfgGet = (obj, path) => path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

function cfgEditor(key) {
  const ed = CFG_EDITORS[key];
  const cur = CONFIG?.[key] && typeof CONFIG[key] === "object" ? CONFIG[key] : {};
  const fields = ed.fields.map((f) => {
    const v = cfgGet(cur, f.k);
    const id = `cfg_${key}_${f.k.replace(".", "_")}`;
    const help = f.help ? `<div class="muted" style="font-size:12px;margin:-2px 0 6px">${esc(f.help)}</div>` : "";
    if (f.type === "bool") {
      // 서버 기본값이 참인 칸은 값이 없으면 켠 것으로 보인다. 기본이 꺼짐인 칸은 def: false로 적는다(110).
      return `<label class="switch" style="margin:4px 8px 4px 0"><input type="checkbox" id="${id}" ${(v ?? f.def) === false ? "" : "checked"}><span>${esc(f.label)}</span>${infoTip(f.tip)}</label>${help}`;
    }
    // 「기본값 쓰기」 옆에 기본값이 무엇인지 적는다. 서버 기본값을 아는 칸(def)만.
    const defName = f.def != null ? f.opts?.find(([x]) => x === f.def)?.[1] : null;
    const input = f.type === "select"
      ? `<select id="${id}"${f.examples ? ` data-cfgex="${key}:${f.k}"` : ""}><option value="">${defName ? `기본값 쓰기 · ${esc(defName)}` : "기본값 쓰기"}</option>${f.opts.map(([x, l]) =>
          `<option value="${x}" ${String(v) === x ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
      : `<input type="number" id="${id}" value="${v == null ? "" : esc(String(v))}" placeholder="비우면 기본값" style="width:130px"${f.ms ? ` data-mstext="${id}_ms"` : ""}${f.onlyIf ? ` data-onlyif="cfg_${key}_${f.onlyIf[0]}" data-onlyval="${f.onlyIf[1]}" data-onlydef="${esc(CFG_EDITORS[key].fields.find((x) => x.k === f.onlyIf[0])?.def ?? "")}"` : ""}>`;
    // 단위가 ms인 칸은 옆에 「= 6시간」처럼 바꿔 보인다. 입력할 때마다 다시 쓴다.
    const conv = f.ms ? `<span class="muted" id="${id}_ms" style="min-width:70px">${v == null ? "" : "= " + esc(msText(v))}</span>` : "";
    // 고른 값에 따라 바뀌는 예(숫자 퍼즐 「랭킹 점수 세는 법」). 처음 그릴 때도 지금 값으로 채운다.
    const ex = f.examples ? `<div class="notice" style="font-size:12.5px;margin:0 0 8px">${f.exampleHead ? `<div class="muted" style="font-size:12px">${esc(f.exampleHead)}</div>` : ""}<div id="${id}_ex">${esc(cfgExample(f, v))}</div></div>` : "";
    const unit = f.ms ? ' <span class="muted" style="font-size:11px">1000 = 1초</span>' : "";
    return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 0"><span style="min-width:min(260px,45vw)">${esc(f.label)}${infoTip(f.tip)}${unit}</span>${input}${conv}</div>${help}${ex}`;
  }).join("");
  return `<h2>${esc(ed.title)}${infoTip(ed.tip)}</h2>
    <div class="notice">${esc(ed.note)}</div>
    <div class="toolbar" style="display:block">${fields}
      <div class="save-bar"><button class="sm" data-cfgsave="${key}">저장</button></div></div>`;
}

/** 선택 칸 아래의 예. 빈 값(기본값 쓰기)은 기본값의 예를 보인다. */
function cfgExample(f, v) {
  const k = v || f.def;
  const name = f.opts.find(([x]) => x === k)?.[1] ?? "";
  const text = f.examples[k];
  if (!text) return "";
  return `${v ? "" : "기본값인 "}${name}: ${text}`;
}

/** 저장 확인 창에 보일 값. 빈 칸은 기본값, 켬·끔과 고른 이름은 화면 그대로 적는다. */
function cfgShow(f, v) {
  if (v === undefined) return "기본값";
  if (f.type === "bool") return v ? "켬" : "끔";
  if (f.type === "select") return f.opts.find(([x]) => x === v)?.[1] ?? String(v);
  return f.ms ? `${fmt(v)} = ${msText(v)}` : fmt(v);
}

/** 화면 값을 읽어 지금 설정 위에 덮는다. 빈 칸은 키를 뺀다. */
function readCfgEditor(key) {
  const out = JSON.parse(JSON.stringify(CONFIG?.[key] && typeof CONFIG[key] === "object" ? CONFIG[key] : {}));
  for (const f of CFG_EDITORS[key].fields) {
    const el = $(`#cfg_${key}_${f.k.replace(".", "_")}`);
    if (!el) continue;
    const [a, b] = f.k.split(".");
    let v;
    if (f.type === "bool") v = el.checked;
    else if (el.value === "") v = undefined;
    else v = f.type === "int" ? Number(el.value) : el.value;
    if (f.type === "int" && v !== undefined && !(Number.isInteger(v) && v >= 0)) throw new Error(`「${f.label}」에는 0 이상의 정수를 넣어 주세요. 소수점과 음수는 안 됩니다`);
    if (b) {
      out[a] = { ...(out[a] && typeof out[a] === "object" ? out[a] : {}) };
      if (v === undefined) delete out[a][b]; else out[a][b] = v;
      if (!Object.keys(out[a]).length) delete out[a];
    } else if (v === undefined) delete out[a];
    else out[a] = v;
  }
  // 서버는 기본값 위에 맨 위 키만 덮는다(daily_record_cfg·number_mode_cfg의 ||). min_build를 반쪽만 쓰면
  // 다른 쪽 기본값까지 사라지므로 둘을 함께 적거나 함께 비우게 한다.
  if (out.min_build && Object.keys(out.min_build).length !== 2) {
    throw new Error("iOS와 AOS 앱 최소 빌드 번호는 둘 다 적거나 둘 다 비워 주세요. 한쪽만 적으면 비운 쪽은 기본값 대신 아무 검사도 하지 않게 됩니다");
  }
  return out;
}

async function saveCfgEditor(key) {
  let value;
  try { value = readCfgEditor(key); } catch (e) { alert(e.message); return; }
  const ed = CFG_EDITORS[key];
  const lines = ed.fields.map((f) => `· ${f.label}: ${cfgShow(f, cfgGet(value, f.k))}`).join("\n");
  if (!confirm(`「${ed.title}」 설정을 저장합니다. 앱은 다음에 서버 설정을 읽을 때부터 따릅니다.\n\n${lines}\n\n저장할까요?`)) return;
  await act(() => rpc("admin_set_config", { p_key: key, p_value: value }), refresh);
}

function render(warn, eventsErr, statsErr, noticesErr, payErr, auditErr, vsErr, cfgErr, serverErr, pushErr, rkErr) {
  const today = kstToday();
  // 카드 숫자는 서버 집계(092). 못 받았으면 지금 가진 회원 목록으로 센다(예전 방식, 50명까지만 맞다).
  const active = PLAYERS.filter((p) => p.daily_date === today && (p.daily_score || 0) > 0);
  const S = SUMMARY || {
    members: PLAYERS.length, today_players: active.length,
    today_best: Math.max(0, ...active.map((p) => p.daily_score || 0)),
    total_best: Math.max(0, ...PLAYERS.map((p) => p.total_score || 0)),
    supporters: PLAYERS.filter((p) => p.supporter).length,
    unclaimed_rewards: REWARDS.filter((r) => !r.claimed_at).length,
  };
  // 최고점은 사람이 없으면 「—」로 적는다. 아무도 안 한 날의 최고점 0은 0점을 낸 사람이 있는 것처럼 읽힌다.

  $("#app").innerHTML = `
    <div class="head">
      <h1>DogPuzzle 관리자</h1>
      ${navBar()}
      <div class="spacer"></div>
      ${alertBell()}
      <span class="muted" style="font-size:12.5px">${esc(EMAIL)}</span>
      <button class="ghost" id="refresh">새로고침</button>
      <button class="ghost" id="logout">로그아웃</button>
    </div>
    ${warn ? `<div class="notice">${esc(warn)}</div>` : ""}
    <div class="cards">
      <div class="card"><div class="label">전체 회원</div><div class="value">${fmt(S.members)}</div></div>
      <div class="card"><div class="label">오늘 판을 깬 사람${infoTip(TIP_BOARD_CLEAR)}</div><div class="value">${fmt(S.today_players)}</div></div>
      <div class="card"><div class="label">오늘 최고 점수</div><div class="value">${Number(S.today_players) > 0 ? fmt(S.today_best) : "—"}</div></div>
      <div class="card"><div class="label">누적 최고 점수</div><div class="value">${Number(S.members) > 0 ? fmt(S.total_best) : "—"}</div></div>
      <div class="card" data-z><div class="label">응원 상품을 산 사람</div><div class="value">${fmt(S.supporters)}</div></div>
      <div class="card" data-z><div class="label">아직 안 받아 간 보상</div><div class="value">${fmt(S.unclaimed_rewards)}</div></div>
    </div>

    ${TAB === "players" ? `
      <div class="toolbar">
        <input type="search" id="q" placeholder="닉네임이나 회원 ID 앞부분으로 찾기" value="${esc(QUERY)}">
        ${PLAYER_FILTER ? `<span class="pill today" title="차트에서 누른 조건입니다">${esc(PLAYER_FILTER.label)}</span>
          <button class="ghost sm" id="clearFilter">조건 풀고 전체 보기</button>` : ""}
        <select id="sort">
          <option value="total">누적 점수순</option>
          <option value="level">레벨 높은순</option>
          <option value="daily">오늘 점수순</option>
          <option value="coins">코인 많은순</option>
          <option value="vs_wins">대전 많이 이긴 순</option>
          <option value="coop_wins">협동 많이 이긴 순</option>
          <option value="played">마지막으로 한 날 순</option>
          <option value="created">가입한 때 순</option>
          <option value="username">닉네임순</option>
        </select>
        <button class="sm" id="sortDir" title="큰 것부터 볼지 작은 것부터 볼지 바꿉니다">${DESC ? "큰 것부터 ↓" : "작은 것부터 ↑"}</button>
        <span class="muted" style="font-size:12.5px">오늘은 한국시간 ${today}</span>
        <div style="flex:1"></div>
        <button class="sm" id="grantAll">모든 회원에게 보상 주기</button>
        <button class="sm" id="pushSelected" title="체크한 회원에게 보낼 푸시 창을 엽니다">체크한 회원에게 푸시${SELECTED.size ? ` (${SELECTED.size})` : ""}</button>
        <button class="danger sm" id="delSelected">체크한 회원 삭제${SELECTED.size ? ` (${SELECTED.size})` : ""}</button>
        <button class="danger sm" id="resetAll" title="모든 회원의 점수나 대전 기록을 지웁니다">전체 점수 초기화</button>
        <button class="danger sm" id="resetAllGames" title="모든 회원의 레벨, 코인, 아이템을 처음으로 돌립니다">전체 게임 초기화</button>
        <button class="ghost sm" id="cancelResets" title="아직 앱을 안 켜서 적용 안 된 게임 초기화 요청을 거둡니다">게임 초기화 요청 거두기</button>
      </div>
      <div id="ptable">${playersTable()}</div>` : ""}
    ${TAB === "charts" ? chartsView(statsErr) : ""}
    ${TAB === "ranking" ? rankingView(rkErr) : ""}
    ${TAB === "liveevents" ? liveEventsTab() : ""}
    ${TAB === "events" ? eventsTable(eventsErr) : ""}
    ${TAB === "rewards" ? rewardsTable() : ""}
    ${TAB === "purchases" ? purchasesTab(payErr) : ""}
    ${TAB === "versus" ? versusTab(vsErr) : ""}
    ${TAB === "versusset" ? versusSetupTab() : ""}
    ${TAB === "anomaly" ? anomalyTab() : ""}
    ${TAB === "update" ? updateTab(cfgErr) : ""}
    ${TAB === "notices" ? noticesTab(noticesErr) : ""}
    ${TAB === "push" ? pushTab(pushErr) : ""}
    ${TAB === "audit" ? auditTable(auditErr) : ""}
    ${TAB === "server" ? serverTab(serverErr) : ""}`;

  // 0뿐인 줄·칸·카드를 숨기고, 붙는 하위 탭이 머리 아래에 오게 머리 높이를 알린다(2026-10-08).
  pruneZeros($("#app"));
  syncHeadH();
  closeRowMenu();
  $("#refresh").onclick = refresh;
  bindBell();
  const orphan = $("#cleanupOrphans");
  if (orphan) orphan.onclick = async () => {
    if (!confirm("회원 정보가 만들어지지 않은 채 24시간 넘게 남은 빈 계정을 지웁니다.\n\n되돌릴 수 없습니다.")) return;
    await act(async () => {
      const n = await rpc("admin_cleanup_orphan_users", { p_older_than_hours: 24 });
      alert(`빈 계정 ${n}개를 지웠습니다`);
    }, refresh);
  };
  $("#logout").onclick = async () => { await sb.auth.signOut(); renderLogin(); };
  // 차트 막대를 누르면 그 회원들을 회원 목록에서 본다(098). 찾기는 비우고 첫 쪽부터, 그 차트의 기준으로 세운다.
  document.querySelectorAll("[data-chartfilter]").forEach((el) => {
    el.onclick = () => {
      PLAYER_FILTER = { label: el.dataset.chartlabel, arg: JSON.parse(el.dataset.chartfilter) };
      QUERY = "";
      PLAYER_PAGE = 0;
      if (el.dataset.chartsort) { SORT = el.dataset.chartsort; DESC = defaultDesc(SORT); }
      TAB = "players";
      refresh();
    };
  });
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => { BELL_OPEN = false; TAB = b.dataset.tab; refresh(); };
  });
  // 위쪽 메뉴 묶음: 누르면 그 메뉴만 열고 나머지는 닫는다(index.html .nav .item.open 주석).
  document.querySelectorAll(".nav > .item > .top:not([data-tab])").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const item = b.parentElement;
      const willOpen = !item.classList.contains("open");
      document.querySelectorAll(".nav > .item.open").forEach((x) => x.classList.remove("open"));
      if (willOpen) item.classList.add("open");
    };
  });

  if (TAB === "versusset") {
    // 체크박스는 **누르는 순간 눈으로 먼저 넘어간다.** 확인창에서 취소하면 서버는
    // 그대로인데 화면만 바뀐 채 남는다. 그래서 되돌리기가 필요하다.
    //
    // 다만 **되돌릴 값을 밖에서 읽으면 안 된다.** 처음에는 `el.checked = VS_ON`으로
    // 썼는데, 성공한 경우에도 아직 갱신되지 않은 옛 VS_ON을 되써서 "켰는데 다시
    // 꺼지는" 것처럼 보였다. 실제 서버 값은 이미 바뀐 뒤였다(2026-08-17 제보).
    // 지금은 **취소·실패일 때만** 눌린 것을 물리는 방식이라, 밖의 값을 볼 일이 없다.
    const bindToggle = (id, fn) => {
      const el = $("#" + id);
      if (!el) return;
      el.onchange = async () => {
        el.disabled = true;   // 응답을 기다리는 동안 두 번 눌러 상태가 엇갈리는 것을 막는다
        try {
          if (!(await fn())) el.checked = !el.checked;
        } finally { el.disabled = false; }
      };
    };
    bindToggle("toggleVersus", toggleVersus);
    bindToggle("toggleVsEvents", toggleVersusEvents);
    document.querySelectorAll("[data-evtoggle]").forEach((b) => {
      b.onclick = async () => {
        const ev = VS_EVENTS.find((x) => String(x.id) === b.dataset.evtoggle);
        if (!ev) return;
        await act(async () => {
          const { error } = await sb.from("versus_events")
            .update({ enabled: !ev.enabled }).eq("id", ev.id);
          if (error) throw error;
        }, refresh);
      };
    });
    document.querySelectorAll("[data-evwhen]").forEach((b) => {
      b.onclick = () => openEventWhen(Number(b.dataset.evwhen));
    });
  }

  if (TAB === "versus") {
    if ($("#purgeRooms")) {
      $("#purgeRooms").onclick = async () => {
        if (!confirm("사람이 없는 방은 지우고, 30분 넘게 아무 움직임이 없는 방은 닫습니다.\n\n대전 중인 방은 건드리지 않습니다.")) return;
        await act(async () => {
          const n = await rpc("admin_purge_stale_rooms", { p_minutes: 30 });
          alert(`방 ${n}개를 정리했습니다`);
        }, refresh);
      };
    }
    document.querySelectorAll("[data-report-ok]").forEach((b) => {
      b.onclick = async () => {
        const note = askReason("신고를 문제없음으로 처리");
        if (note === null) return;
        await act(() => rpc("admin_resolve_report", {
          p_id: Number(b.dataset.reportOk), p_note: note, p_rename: false,
        }), refresh);
      };
    });
    document.querySelectorAll("[data-report-rename]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("신고당한 회원의 닉네임을 임의 이름으로 바꿉니다.\n\n본인은 코인 없이 다시 정할 수 있습니다.")) return;
        const note = askReason("닉네임 강제 변경");
        if (note === null) return;
        await act(() => rpc("admin_resolve_report", {
          p_id: Number(b.dataset.reportRename), p_note: note, p_rename: true,
        }), refresh);
      };
    });
    document.querySelectorAll("[data-close-room]").forEach((b) => {
      b.onclick = async () => {
        const code = b.dataset.closeRoom;
        if (!confirm(`방 ${code}을(를) 강제로 닫습니다.\n\n참가자들은 "상대가 나갔어요" 안내와 함께 홈으로 나갑니다.`)) return;
        const reason = askReason("대전 방 강제 닫기");
        if (reason === null) return;
        await act(() => rpc("admin_close_room", { p_code: code, p_reason: reason }), refresh);
      };
    });
  }

  if (TAB === "ranking") {
    const reload = async () => { await loadRanking(); render(warn, eventsErr); };
    if ($("#rankDate")) {
      $("#rankDate").onchange = async (e) => {
        RANK_DATE = e.target.value || "";
        RANK_PAGE = 0;                 // 날짜를 바꾸면 첫 쪽부터 본다
        await reload();
      };
    }
    if ($("#rankToday")) {
      $("#rankToday").onclick = async () => { RANK_DATE = ""; RANK_PAGE = 0; await reload(); };
    }
    if ($("#rankPrev")) {
      $("#rankPrev").onclick = async () => { RANK_PAGE = Math.max(0, RANK_PAGE - 1); await reload(); };
    }
    if ($("#rankNext")) {
      $("#rankNext").onclick = async () => { RANK_PAGE += 1; await reload(); };
    }
    document.querySelectorAll("[data-rankview]").forEach((b) => {
      b.onclick = () => { RANK_VIEW = b.dataset.rankview; REC_PERIOD = ""; REC_PAGE = 0; refresh(); };
    });
    const recReload = async () => { await loadRecordRanking(); render(); };
    if ($("#recDate")) $("#recDate").onchange = (e) => { REC_PERIOD = e.target.value === kstDate(0) ? "" : e.target.value; REC_PAGE = 0; recReload(); };
    if ($("#recToday")) $("#recToday").onclick = () => { REC_PERIOD = ""; REC_PAGE = 0; recReload(); };
    if ($("#recPeriod")) $("#recPeriod").onchange = (e) => { REC_PERIOD = e.target.value; REC_PAGE = 0; recReload(); };
    if ($("#recPrev")) $("#recPrev").onclick = () => { REC_PAGE = Math.max(0, REC_PAGE - 1); recReload(); };
    if ($("#recNext")) $("#recNext").onclick = () => { REC_PAGE += 1; recReload(); };
    document.querySelectorAll("[data-rec-exclude]").forEach((b) => {
      b.onclick = () => excludeFromRecordRanking(b.dataset.recExclude, b.dataset.name);
    });
    // 통계 보기: 차트 메뉴의 같은 모드로 가서 이 기간의 원본 기록만 본다.
    if ($("#recStats")) $("#recStats").onclick = () => {
      const per = REC_ROWS[0]?.period_key || REC_PERIOD || (RANK_VIEW === "daily_time" ? kstDate(0) : "");
      const range = RANK_VIEW === "daily_time" ? [per, per] : numberPeriodRange(per);
      TAB = "charts"; CHART_VIEW = RANK_VIEW === "daily_time" ? "daily" : "number"; PLAY_PAGE = 0;
      PLAY_FILTER = range ? { label: RANK_VIEW === "daily_time" ? `${per} 기록전` : numberPeriodLabel(per),
                              arg: { from: range[0], to: range[1], include_test: PLAY_TEST } } : null;
      refresh();
    };
    document.querySelectorAll("[data-testoff]").forEach((b) => {
      b.onclick = () => setTestAccount(b.dataset.testoff, false, b.dataset.name);
    });
    bindTierEditors();
  }

  if (TAB === "liveevents") {
    $("#leNew").onclick = () => openLiveEvent(null);
    const on = (attr, fn) => document.querySelectorAll(`[${attr}]`).forEach((b) => {
      b.onclick = () => fn(b.getAttribute(attr));
    });
    on("data-le-edit", (id) => openLiveEvent(id));
    on("data-le-end", endLiveEventNow);
    on("data-le-cancel", cancelLiveEvent);
    on("data-le-push", (id) => pushToEvent(id, false));
    on("data-le-rank", (id) => openLiveRanking(id));
    on("data-le-startpush", (id) => pushToEvent(id, true));
    on("data-le-stats", (id) => {
      TAB = "charts"; CHART_VIEW = "event"; PLAY_EVENT = Number(id);
      PLAY_FILTER = null; PLAY_PAGE = 0;
      refresh();
    });
    bindLiveRanking();
  }
  // 이벤트 순위 상자의 자동 새로고침. 탭을 옮기거나 상자를 닫으면 끈다.
  if (TAB === "liveevents" && LE_OPEN != null) startLiveRankTimer();
  else stopLiveRankTimer();
  // 닉네임을 누르면 회원 목록에서 그 회원을 찾아 이력을 펼친다(원본 기록, 순위 표, 시험 계정 표).
  document.querySelectorAll("[data-member]").forEach((b) => { b.onclick = () => openMember(b.dataset.member); });

  if (TAB === "charts") {
    document.querySelectorAll("[data-chartview]").forEach((b) => {
      b.onclick = () => { CHART_VIEW = b.dataset.chartview; PLAY_FILTER = null; PLAY_PAGE = 0; refresh(); };
    });
    // 기간·이벤트·시험 계정을 바꾸면 고른 막대 조건은 옛 기간의 것이라 푼다.
    const reloadPlay = async () => { PLAY_FILTER = null; PLAY_PAGE = 0; await loadPlay(); render(); };
    if ($("#playDays")) $("#playDays").onchange = (e) => { PLAY_DAYS = Number(e.target.value) || 14; reloadPlay(); };
    if ($("#playEvent")) $("#playEvent").onchange = (e) => { PLAY_EVENT = e.target.value ? Number(e.target.value) : null; reloadPlay(); };
    if ($("#playTest")) $("#playTest").onchange = (e) => { PLAY_TEST = e.target.checked; reloadPlay(); };
    // 막대·칸·카드·표 숫자를 누르면 그 filter로 원본 표만 다시 받고 표로 내려간다.
    // 쌓은 막대는 칸이 기둥 안에 있어서, 칸을 누르면 기둥(그날 전체)까지 올라가지 않게 막는다.
    const rowsAgain = async (scroll) => {
      await loadPlayRows();
      render();
      // 부드럽게 굴리지 않는다. 화면을 통째로 다시 그린 직후라 smooth는 브라우저에 따라 멈춰 버렸다(자동화 창에서 확인).
      if (scroll) $("#playRows")?.scrollIntoView({ block: "start" });
    };
    document.querySelectorAll("[data-playfilter]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        PLAY_FILTER = { label: el.dataset.playlabel, arg: JSON.parse(el.dataset.playfilter) };
        PLAY_PAGE = 0;
        rowsAgain(true);
      };
    });
    if ($("#playClear")) $("#playClear").onclick = () => { PLAY_FILTER = null; PLAY_PAGE = 0; rowsAgain(false); };
    if ($("#playPrev")) $("#playPrev").onclick = () => { PLAY_PAGE = Math.max(0, PLAY_PAGE - 1); rowsAgain(true); };
    if ($("#playNext")) $("#playNext").onclick = () => { PLAY_PAGE += 1; rowsAgain(true); };
    // 이 조건에 걸린 회원을 회원 목록으로 본다(107 admin_players_ranked의 "play").
    if ($("#playToPlayers")) $("#playToPlayers").onclick = () => {
      const view = CHART_VIEWS.find(([k]) => k === CHART_VIEW)?.[1] ?? CHART_VIEW;
      PLAYER_FILTER = {
        label: `${view}: ${PLAY_FILTER ? PLAY_FILTER.label : "전체"}`,
        arg: { play: { mode: CHART_VIEW, filter: PLAY_FILTER ? PLAY_FILTER.arg : playBaseFilter() } },
      };
      QUERY = ""; PLAYER_PAGE = 0; TAB = "players";
      refresh();
    };
  }

  if (TAB === "server") {
    if ($("#winnerDays")) {
      $("#winnerDays").onchange = async (e) => {
        WINNER_DAYS = Number(e.target.value) || 14;
        await loadServer();
        render(warn, eventsErr);
      };
    }
  }

  if (TAB === "update" && $("#saveVersions")) {
    // 하위 탭은 그리기를 다시 하지 않고 보이는 칸만 바꾼다. 입력하던 값이 남는다.
    document.querySelectorAll("[data-updview]").forEach((b) => {
      b.onclick = () => {
        UPD_VIEW = b.dataset.updview;
        saveStore(UPD_STORE, UPD_VIEW);
        document.querySelectorAll("[data-updview]").forEach((x) => x.classList.toggle("on", x === b));
        document.querySelectorAll(".upd-pane").forEach((p) => { p.hidden = p.dataset.upd !== UPD_VIEW; });
      };
    });
    $("#saveVersions").onclick = saveVersions;
    if ($("#saveMaint")) $("#saveMaint").onclick = saveMaintenance;
    if ($("#saveMaintSched")) $("#saveMaintSched").onclick = saveMaintenance;
    if ($("#saveAnomaly")) $("#saveAnomaly").onclick = saveAnomalyThreshold;
    if ($("#saveApiUrl")) $("#saveApiUrl").onclick = saveApiUrl;
    document.querySelectorAll("[data-cfgsave]").forEach((b) => { b.onclick = () => saveCfgEditor(b.dataset.cfgsave); });
    // 다른 선택에서만 쓰는 칸은 흐리게 한다(숫자 퍼즐 「③일 때 더할 판 수」). 「기본값 쓰기」면 서버 기본값으로 따진다.
    document.querySelectorAll("[data-onlyif]").forEach((el) => {
      const src = $("#" + el.dataset.onlyif);
      const sync = () => {
        const cur = src.value || el.dataset.onlydef;
        const on = cur === el.dataset.onlyval;
        el.disabled = !on; el.closest("div").style.opacity = on ? "1" : "0.45";
      };
      src.addEventListener("change", sync); sync();
    });
    // 고른 값에 따라 아래 예를 바꾼다(숫자 퍼즐 「랭킹 점수 세는 법」).
    document.querySelectorAll("[data-cfgex]").forEach((el) => {
      const [key, k] = el.dataset.cfgex.split(":");
      const f = CFG_EDITORS[key].fields.find((x) => x.k === k);
      el.addEventListener("change", () => { $("#" + el.id + "_ex").textContent = cfgExample(f, el.value); });
    });
    document.querySelectorAll("[data-mstext]").forEach((el) => {
      el.oninput = () => { const t = msText(el.value); $("#" + el.dataset.mstext).textContent = t ? "= " + t : ""; };
    });
  }

  if (TAB === "audit") {
    if ($("#auditKind")) $("#auditKind").onchange = (e) => { AUDIT_KIND = e.target.value; render(warn, eventsErr); };
    if ($("#auditQ")) $("#auditQ").onchange = (e) => { AUDIT_Q = e.target.value; render(warn, eventsErr); };
  }

  if (TAB === "notices") {
    $("#newNotice").onclick = openNotice;
    document.querySelectorAll("[data-delnotice]").forEach((b) => {
      b.onclick = () => deleteNotice(Number(b.dataset.delnotice));
    });
    document.querySelectorAll("[data-noticepopup]").forEach((b) => {
      b.onchange = () => act(() => rpc("admin_set_notice_popup",
        { p_id: Number(b.dataset.noticepopup), p_popup: b.checked }), refresh);
    });
  }
  if ($("#newPush")) {
    $("#newPush").onclick = () => openPush();
    document.querySelectorAll("[data-cancelpush]").forEach((b) => {
      b.onclick = () => cancelPush(Number(b.dataset.cancelpush));
    });
    const findPush = (id) => PUSHES.find((m) => String(m.id) === String(id));
    const reloadPush = async () => { await loadPush(); render(); };
    if ($("#pushDays")) $("#pushDays").onchange = (e) => { PUSH_DAYS = Number(e.target.value); reloadPush(); };
    if ($("#pushHourMsg")) $("#pushHourMsg").onchange = (e) => { PUSH_HOUR_MSG = e.target.value ? Number(e.target.value) : null; reloadPush(); };
    document.querySelectorAll("[data-hourpush]").forEach((b) => {
      b.onclick = async () => {
        PUSH_HOUR_MSG = Number(b.dataset.hourpush);
        await reloadPush();
        $("#pushHours")?.scrollIntoView({ behavior: "smooth" });
      };
    });
    document.querySelectorAll("[data-editpush]").forEach((b) => {
      b.onclick = () => { const m = findPush(b.dataset.editpush); if (m) openPush(m, m.id); };
    });
    // 복제는 예약 시각을 비운다 — 지난 시각을 그대로 들고 오면 바로 막힌다.
    document.querySelectorAll("[data-copypush]").forEach((b) => {
      b.onclick = () => { const m = findPush(b.dataset.copypush); if (m) openPush({ ...m, scheduled_at: null }); };
    });
  }

  if (TAB === "rewards") {
    document.querySelectorAll("[data-bview]").forEach((b) => {
      // 화면만 갈아 끼운다 — 같은 BATCHES를 다시 나누는 것뿐이라 서버를 부를 이유가 없다.
      b.onclick = () => { BATCH_VIEW = b.dataset.bview; OPEN_BATCH = null; BATCH_MEMBERS = []; render(); };
    });
    document.querySelectorAll("[data-batch]").forEach((b) => {
      b.onclick = () => toggleBatch(Number(b.dataset.batch));
    });
    document.querySelectorAll("[data-revoke]").forEach((b) => {
      b.onclick = () => revokeBatch(Number(b.dataset.revoke));
    });
  }

  if (TAB === "players") {
    $("#sort").value = SORT;
    // 한 군데로 모은다 — 선택 상자·방향 단추·표 머리글이 같은 길을 쓴다.
    const applySort = async (key, desc) => {
      SORT = key;
      DESC = desc;
      PLAYER_PAGE = 0;                 // 기준을 바꾸면 첫 쪽부터
      await loadPlayers();
      render(warn, eventsErr);
    };
    $("#sort").onchange = (e) => applySort(e.target.value, defaultDesc(e.target.value));
    const clear = $("#clearFilter");
    if (clear) clear.onclick = async () => {
      PLAYER_FILTER = null;
      PLAYER_PAGE = 0;
      await loadPlayers();
      render(warn, eventsErr);
    };
    $("#sortDir").onclick = () => applySort(SORT, !DESC);
    // **머리글을 눌러도 세운다.** 기준이 그대로면 방향만 뒤집고,
    // 다른 칸이면 그 칸의 기본 방향으로 간다.
    //
    // ⚠️ **검색할 때마다 표를 통째로 다시 그리므로 그때도 다시 걸어야 한다.**
    // 안 걸면 한 글자 치는 순간 머리글이 죽는다.
    const bindSortHeaders = () => {
      document.querySelectorAll("[data-sort]").forEach((el) => {
        el.onclick = () => {
          const key = SORT_BY_COL[el.dataset.sort];
          if (!key) return;
          applySort(key, key === SORT ? !DESC : defaultDesc(key));
        };
      });
    };
    bindSortHeaders();
    // ⚠️ **찾기는 서버가 한다**(079). 예전에는 받아 둔 목록을 브라우저에서 걸렀는데,
    // 50명씩 끊어 받는 지금은 **그 쪽 안에서만** 찾게 되어 3쪽에 있는 사람이
    // 「없다」고 나온다.
    //
    // 타자마다 부르면 요청이 쏟아지므로 **350ms 쉰 뒤에** 보낸다. 그 사이 한 글자가
    // 더 들어오면 앞의 예약은 버린다.
    $("#q").oninput = (e) => {
      QUERY = e.target.value;
      PLAYER_PAGE = 0;                 // 찾으면 첫 쪽부터
      clearTimeout(QUERY_TIMER);
      QUERY_TIMER = setTimeout(async () => {
        await loadPlayers();
        render(warn, eventsErr);
        const box = $("#q");
        // 다시 그리면 입력칸이 새로 만들어진다 — 커서를 되돌려 준다.
        if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      }, 350);
    };
    const turnPage = async (d) => {
      PLAYER_PAGE = Math.max(0, PLAYER_PAGE + d);
      await loadPlayers();
      render(warn, eventsErr);
    };
    if ($("#playerPrev")) $("#playerPrev").onclick = () => turnPage(-1);
    if ($("#playerNext")) $("#playerNext").onclick = () => turnPage(1);
    $("#resetAll").onclick = resetAllScores;
    $("#resetAllGames").onclick = resetAllGames;
    $("#cancelResets").onclick = cancelGameResets;
    $("#grantAll").onclick = () => openGrant(null);
    $("#delSelected").onclick = deleteSelected;
    $("#pushSelected").onclick = pushSelected;
    bindPicks();
    bindRowActions();
    // 회원 이력의 모드별 기록 버튼(107). 차트 메뉴의 그 모드로 가서 이 회원의 원본 기록만 본다.
    document.querySelectorAll("[data-memplay]").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.id;
        PLAY_PENDING_MEMBER = { id, label: findPlayer(id)?.username || id.slice(0, 8) };
        TAB = "charts"; CHART_VIEW = b.dataset.memplay; PLAY_PAGE = 0;
        if (CHART_VIEW !== "event") PLAY_DAYS = PLAY_MEMBER_DAYS;
        refresh();
      };
    });
  }
}

/** 체크박스 배선. 선택은 SELECTED에 모으고, 헤더 체크는 지금 화면에 보이는 것만 다룬다 —
 *  검색으로 걸러 놓고 전체 선택을 눌렀는데 안 보이는 사람까지 잡히면 사고가 난다. */
function updatePickButtons() {
  const n = SELECTED.size ? ` (${SELECTED.size})` : "";
  if ($("#delSelected")) $("#delSelected").textContent = `체크한 회원 삭제${n}`;
  if ($("#pushSelected")) $("#pushSelected").textContent = `체크한 회원에게 푸시${n}`;
}

/** 지금 눈에 보이는 줄의 체크박스. 「더 보기」로 가린 줄은 빼야 안 보이는 회원이 같이 골라지지 않는다. */
const visiblePicks = () => [...document.querySelectorAll("[data-pick]")].filter((b) => !b.closest("tr[data-mr-hide]"));
function syncPickAll() {
  const all = $("#pickAll");
  if (!all) return;
  const boxes = visiblePicks();
  all.checked = boxes.length > 0 && boxes.every((x) => x.checked);
}

function bindPicks() {
  document.querySelectorAll("[data-pick]").forEach((b) => {
    b.onchange = () => {
      if (b.checked) SELECTED.add(b.dataset.pick);
      else SELECTED.delete(b.dataset.pick);
      updatePickButtons();
      syncPickAll();
    };
  });
  const all = $("#pickAll");
  if (all) {
    syncPickAll();
    all.onchange = () => {
      visiblePicks().forEach((b) => {
        b.checked = all.checked;
        if (all.checked) SELECTED.add(b.dataset.pick);
        else SELECTED.delete(b.dataset.pick);
      });
      updatePickButtons();
    };
  }
}

const ROW_HANDLERS = {
  name: editName, score: editScores, heart: toggleSupporter, gift: openGrant,
  zero: resetScores, wipe: requestGameReset, del: removePlayer, log: toggleMember,
  testacct: (id) => setTestAccount(id, !TEST_SET.has(String(id))),
};

function bindRowActions() {
  document.querySelectorAll("[data-act]").forEach((b) => {
    b.onclick = () => ROW_HANDLERS[b.dataset.act](b.dataset.id);
  });
}

// ------------------------------------------------------------------ 회원 줄의 「관리」 메뉴 (2026-10-08)
// 버튼 아홉 개가 줄마다 늘어서 1568px 화면에서도 표가 76px 넘쳤다. 「기록 보기」만 남기고 나머지는 메뉴로 모았다.
// 표는 가로로 굴러가는 상자 안이라 메뉴를 그 안에 두면 잘린다. body 끝에 하나만 두고 버튼 자리로 옮겨 띄운다.
// 폰에서는 화면 아래 띠로 띄운다(index.html #rowMenu).

/** [작업, 이름, 설명, 위험한가]. 설명은 메뉴에 마우스를 올리면 보인다. */
function rowMenuItems(id) {
  const test = TEST_SET.has(String(id));
  return [
    ["name", "닉네임 바꾸기", ""],
    ["score", "점수 고치기", ""],
    ["heart", "응원 배지", "이름 옆 응원 배지를 켜고 끕니다"],
    ["gift", "보상 주기", ""],
    ["testacct", test ? "시험 계정 풀기" : "시험 계정으로", "시험 계정은 랭킹과 이벤트 순위에서 빠집니다"],
    null,
    ["zero", "점수 0으로", "오늘 점수와 누적 점수를 0으로 만듭니다", true],
    ["wipe", "게임 초기화", "레벨, 코인, 아이템을 처음 상태로 돌립니다. 그 사람이 다음에 앱을 켤 때 적용됩니다", true],
    ["del", "계정 삭제", "", true],
  ];
}

let ROW_MENU_FOR = null;
function closeRowMenu() {
  const m = document.getElementById("rowMenu");
  if (m) m.classList.remove("show");
  document.querySelectorAll("[data-rowmenu][aria-expanded=true]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  ROW_MENU_FOR = null;
}
function openRowMenu(btn) {
  const id = btn.dataset.rowmenu;
  let m = document.getElementById("rowMenu");
  if (!m) { m = document.createElement("div"); m.id = "rowMenu"; m.setAttribute("role", "menu"); document.body.append(m); }
  const who = findPlayer(id)?.username || id.slice(0, 8);
  m.innerHTML = `<div class="rm-head">${esc(who)}</div>` + rowMenuItems(id).map((x) => (x
    ? `<button type="button" role="menuitem" class="${x[3] ? "danger" : ""}" data-menuact="${x[0]}"${x[2] ? ` title="${esc(x[2])}"` : ""}>${esc(x[1])}</button>`
    : "<hr>")).join("");
  m.querySelectorAll("[data-menuact]").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); closeRowMenu(); ROW_HANDLERS[b.dataset.menuact](id); };
  });
  m.classList.add("show");
  ROW_MENU_FOR = id;
  btn.setAttribute("aria-expanded", "true");
  // 버튼 바로 아래, 오른쪽 끝을 맞춘다. 아래가 모자라면 위로 띄운다. 폰은 CSS가 아래 띠로 고정한다.
  const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - 8 - w))}px`;
  m.style.top = `${r.bottom + 4 + h > window.innerHeight - 8 && r.top - 4 - h > 8 ? r.top - 4 - h : r.bottom + 4}px`;
  m.querySelector("button")?.focus({ preventScroll: true });
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest?.("[data-rowmenu]");
  if (btn) {
    e.stopPropagation();
    if (ROW_MENU_FOR === btn.dataset.rowmenu) closeRowMenu(); else openRowMenu(btn);
    return;
  }
  if (!e.target.closest?.("#rowMenu")) closeRowMenu();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ROW_MENU_FOR) closeRowMenu(); });
// 넓은 화면의 메뉴는 버튼 자리에 붙어 있어서 화면을 굴리면 떨어진다. 굴리면 닫는다. 폰의 아래 띠는 그대로 둔다.
document.addEventListener("scroll", () => { if (ROW_MENU_FOR && !matchMedia("(max-width:720px)").matches) closeRowMenu(); }, true);
window.addEventListener("resize", () => { if (ROW_MENU_FOR) closeRowMenu(); });

// **await를 빠뜨리면 안 된다.** act(fn, refresh)가 `await done?.()`로 이걸 기다리는데,
// boot()를 안 기다리면 화면을 다시 그리기도 전에 호출한 쪽이 이어서 돈다. 토글에서
// 그 틈에 옛 값을 되써서 "켰는데 다시 꺼지는" 것처럼 보였다.
// **겹쳐 돌지 않게 한다.** 새로고침을 두 번 누르거나 탭을 연달아 바꾸면 boot가 겹쳐 요청이 전부 두 벌 나갔다
// (2026-10-05 조사). 도는 중에 또 부르면 끝난 뒤 한 번만 더 돈다.
let BOOTING = null, BOOT_AGAIN = false;
async function refresh() {
  if (BOOTING) { BOOT_AGAIN = true; return BOOTING; }
  BOOTING = (async () => { do { BOOT_AGAIN = false; await boot(); } while (BOOT_AGAIN); })();
  try { await BOOTING; } finally { BOOTING = null; }
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  if (await needsMfa()) return;
  EMAIL = session.user.email || "";

  // **탭이 쓰는 것만 부른다**(요청 줄이기, 2026-10-05). 예전에는 어느 탭이든 회원 목록·설정·코인 급증을 다 불렀다.
  // 상단 카드는 서버 집계 하나(092)로 센다.
  let sumErr = null;
  SUMMARY = await rpc("admin_summary").catch((e) => { sumErr = e; return null; });
  const needsPlayers = ["players", "rewards"].includes(TAB);
  const perr = needsPlayers ? await loadPlayers() : null;
  // 문턱·점검 예약이 여기서 온다. 업데이트 탭은 실패를 보여 줘야 해서 오류를 받아 둔다.
  const cfgLoadErr = await loadConfig().then(() => null).catch((e) => e);
  if (TAB === "anomaly") { await loadAnomalies(); await loadAnomalyExtras(); }
  const eerr = TAB === "events" ? await loadEvents() : null;
  // 이벤트 목록은 이벤트 메뉴, 푸시(이벤트 링크·조건), 차트의 이벤트 보기가 쓴다.
  if (TAB === "liveevents" || TAB === "push" || (TAB === "charts" && CHART_VIEW === "event")) await loadLiveEvents();
  // 지금 차트의 RPC 일곱은 「전체」에서만, 새 보기는 보고서와 원본 표만 부른다.
  const serr = TAB === "charts" && CHART_VIEW === "all" ? await loadStats() : null;
  if (TAB === "charts" && CHART_VIEW !== "all") await loadPlay();
  const nerr = TAB === "notices" ? await loadNotices() : null;
  const perr2 = TAB === "purchases" ? await loadPurchases() : null;
  if (TAB === "players") await Promise.all([loadPayTotals(), loadAppVersions()]);
  if (TAB === "players") await loadReach();
  if (TAB === "rewards" || TAB === "players") {
    await loadRewards().catch(() => {});
    await loadBatches().catch(() => {});
  }
  const aerr = TAB === "audit" ? await loadAudit().catch((e) => e) : null;
  const vserr = TAB === "versus" ? await loadVersus() : null;
  // 설정 탭도 개별 사건 표를 그린다. 이 목록을 안 가져오면 versusEventsTable이
  // `if (!VS_EVENTS.length) return ""`로 **조용히 빈 화면**을 준다 — 표가 없는 것인지
  // 사건이 없는 것인지 구별이 안 된다. 스위치만 있는 탭이라 나머지 집계는 안 부른다.
  if (TAB === "versusset") {
    VS_EVENTS = (await sb.from("versus_events").select("*").order("category").order("code")
      .then((r) => r.data).catch(() => null)) || [];
  }
  const cfgerr = TAB === "update" ? cfgLoadErr : null;
  const sverr = TAB === "server" ? await loadServer() : null;
  const rkerr = TAB === "ranking" && RANK_VIEW === "today" ? await loadRanking() : null;
  if (TAB === "ranking" && RANK_VIEW !== "today") await loadRecordRanking();
  // 시험 계정은 회원 목록(알약·버튼)과 랭킹 메뉴(맨 아래 표)가 쓴다.
  if (TAB === "players" || TAB === "ranking") await loadTestAccounts();
  if (TAB === "liveevents" && LE_OPEN != null) await loadLiveRanking();
  const pusherr = TAB === "push" ? await loadPush() : null;
  // 알림은 **새로고침할 때만** 가져온다(사용자 지시) — 따로 도는 타이머는 두지 않는다.
  await loadAlerts();

  let warn = "";
  if (perr) warn = "회원 목록을 불러오지 못했습니다. " + plainError(perr.message);
  else if (sumErr) warn = "맨 위 요약 숫자를 불러오지 못했습니다. " + plainError(sumErr.message) + " · 개발 담당에게 전할 단서: 092_admin_summary.sql";
  else if (!SUMMARY) {
    // 관리자가 아니면 서버가 null을 돌려준다.
    warn = "받아 온 내용이 비어 있습니다. 이 계정이 관리자로 등록되지 않았을 수 있습니다. " +
           "개발 담당에게 전할 단서: admins 표, supabase_admin_access.sql 4번 항목";
  }
  render(warn, eerr, serr, nerr, perr2, aerr, vserr, cfgerr, sverr, pusherr, rkerr);
}

boot();
