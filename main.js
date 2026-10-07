// 관리자 화면 — 회원·점수 관리 / 이벤트 집계 / 보상 지급.
import { sb, $, fmt, fmtDate, fmtDateTime, fmtTime, esc, kstToday, askReason, rpc } from "./app.js";

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

// ------------------------------------------------------------------ 로그인
function renderLogin(msg) {
  $("#app").innerHTML = `
    <div class="login">
      <h2>DogPuzzle 관리자</h2>
      <p>회원 정보를 다루는 화면입니다. 관리자 계정으로 로그인하세요.</p>
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
    if (error) $("#err").textContent = "로그인 실패: " + error.message;
    else boot();
  };
  $("#go").onclick = submit;
  $("#pw").onkeydown = (e) => { if (e.key === "Enter") submit(); };
  $("#email").focus();
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
async function loadPayTotals() {
  try {
    const rows = await rpc("admin_purchase_totals") || [];
    PAY_TOTALS = Object.fromEntries(rows.map((r) => [r.profile_id, r]));
  } catch { PAY_TOTALS = {}; }
}

async function loadNotices() {
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
  return `<div class="table-scroll"><table>
    <thead><tr><th>날짜</th><th style="text-align:right">발송 건수</th><th style="text-align:right">성공(기기)</th>
      <th style="text-align:right">실패</th><th style="text-align:right">성공률</th>
      <th style="text-align:right">열림</th><th style="text-align:right">열림률</th></tr></thead>
    <tbody>${line(`최근 ${PUSH_DAYS}일 합계`, sum, true)}${rows.map((d) => line(esc(d.day), d)).join("") ||
      '<tr><td colspan="7" class="muted">이 기간에 발송도 열림도 없습니다</td></tr>'}</tbody></table></div>
    <div class="muted" style="font-size:12px">열림률은 그날 열린 수 ÷ 그날 성공한 기기 수입니다. 전날 보낸 알림을 오늘 열면 오늘에 셉니다.
      발송·열림이 없는 날은 뺐습니다.</div>`;
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
  const pick = `<select id="pushHourMsg">
      <option value="">모든 푸시</option>
      ${sent.map((m) => `<option value="${m.id}" ${String(PUSH_HOUR_MSG) === String(m.id) ? "selected" : ""}>${
        esc(fmtDateTime(m.sent_at))} · ${esc(m.title)} · 열림 ${fmt(m.opens || 0)}</option>`).join("")}
    </select>`;
  const bars = `<div style="display:grid;grid-template-columns:repeat(24,1fr);gap:3px;align-items:end;height:90px;margin-top:10px">
      ${byHour.map((n, h) => `<div title="${h}시 · ${fmt(n)}회" style="height:${Math.max(2, Math.round((n / max) * 80))}px;
        background:var(--accent);opacity:${n ? 1 : 0.15};border-radius:3px 3px 0 0"></div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:3px;font-size:10px;text-align:center" class="muted">
      ${byHour.map((_, h) => `<div>${h}</div>`).join("")}</div>`;
  const heat = days.size ? `<div class="table-scroll" style="margin-top:12px"><table style="font-size:11px">
      <thead><tr><th>날짜</th>${byHour.map((_, h) => `<th style="text-align:center;padding:4px 2px">${h}</th>`).join("")}<th style="text-align:right">합계</th></tr></thead>
      <tbody>${[...days].map(([day, cells]) => `<tr><td style="white-space:nowrap">${esc(day)}</td>${cells.map((c, h) => c
          ? `<td title="${h}시 · iOS ${c.ios} · Android ${c.android}" style="text-align:center;padding:4px 2px;
              background:color-mix(in srgb, var(--accent) ${Math.round((c.opens / cellMax) * 85) + 15}%, transparent);color:#fff">${c.opens}</td>`
          : '<td style="padding:4px 2px"></td>').join("")}<td class="num">${fmt(cells.reduce((a, c) => a + (c ? c.opens : 0), 0))}</td></tr>`).join("")}
      </tbody></table></div>` : '<div class="muted" style="margin-top:8px">이 기간에 열린 기록이 없습니다</div>';
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${pick}
      <span class="muted" style="font-size:12px">한국시간 기준, 막대는 시간대별 합계입니다. 칸에 마우스를 올리면 기기별 수가 보입니다.</span></div>
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
    ["오늘 접속자", fmt(num(last, "active")), delta(num(last, "active"), was("active"))],
    ["오늘 신규", fmt(num(last, "signups")), delta(num(last, "signups"), was("signups"))],
    ["7일 평균 접속", fmt(avg(w1, "active")), delta(avg(w1, "active"), avg(w0, "active"))],
    ["D1 리텐션", d1 == null ? "—" : d1 + "%", ""],
    ["코인 순증 (오늘)", fmt(net(last)), delta(net(last), prev ? net(prev) : null)],
    ["소모/발행", ratio == null ? "—" : String(ratio), ""],
  ];
  return `<div class="cards">${cards.map(([label, value, d]) => `
    <div class="card"><div class="label">${label}</div>
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
  if (err) return `<div class="notice">집계 조회 실패: ${esc(err.message)}<br>supabase_admin_v2.sql을 실행했는지 확인하세요.</div>`;
  if (!STATS.length) return `<div class="empty">집계할 데이터가 아직 없습니다</div>`;
  const days = STATS.map((r) => r.day);
  // 여섯 덩어리가 평평하게 나열돼 있었다. **묻는 질문이 다른 것끼리** 갈라 놓으면
  // 무엇을 보러 왔는지에 따라 눈이 바로 그 자리로 간다.
  //   사람 — 몇 명이 들어오고 남는가
  //   경제 — 코인이 도는가, 쌓이기만 하는가
  //   진행 — 어디까지 가고 어디서 그만두는가
  // 모든 창은 **30일로 맞췄다**(경제 건강 카드만 14일이었다).
  return `
    ${kpiRow()}
    <h2>사람</h2>
    <h3 class="sub">신규 가입 · 접속자 (최근 30일)</h3>
    ${lineChart(days, [
      { name: "신규 가입", color: "#17b3a8", values: STATS.map((r) => Number(r.signups)) },
      { name: "접속자", color: "#7aa2f7", values: STATS.map((r) => Number(r.active)) },
    ])}
    <h3 class="sub">리텐션 — 가입일 기준 재방문</h3>
    ${retentionTable()}

    <h2>경제</h2>
    ${ECON ? `
    <div class="cards">
      <div class="card"><div class="label">발행 (30일)</div><div class="value">${fmt(ECON.earned)}</div></div>
      <div class="card"><div class="label">소모 (30일)</div><div class="value">${fmt(ECON.spent)}</div></div>
      <div class="card"><div class="label">소모/발행</div>
        <div class="value" style="${sinkLow() ? "color:var(--danger)" : ""}">${sinkRatio() ?? "—"}</div></div>
    </div>
    ${sinkLow() ? `<div class="notice">소모/발행이 ${SINK_WARN} 아래입니다.
      코인이 쌓이기만 하고 있습니다. 상점 가격이나 판당 지급을 볼 때입니다.</div>` : ""}` : ""}
    <h3 class="sub">코인 획득 · 소모</h3>
    ${lineChart(days, [
      { name: "획득", color: "#d9a441", values: STATS.map((r) => Number(r.coin_earned)) },
      { name: "소모", color: "#d95757", values: STATS.map((r) => Number(r.coin_spent)) },
    ])}
    <h3 class="sub">코인을 어디에 썼나</h3>
    ${COIN_SINKS.length
      ? barChart(COIN_SINKS.map((r) => ({
          bucket: r.sink, players: Number(r.spent),
          filter: r.sink_key ? { sink: r.sink_key, days: SINK_DAYS } : null,
          filterLabel: `최근 ${SINK_DAYS}일 「${r.sink}」에 코인을 쓴 회원`,
        })))
      : `<div class="empty">아직 소모 기록이 없습니다</div>`}

    <h2>진행</h2>
    <h3 class="sub">레벨별 도달 인원 — 어디서 그만두는지</h3>
    <div class="muted" style="margin-bottom:6px">그 레벨까지 온 사람 수입니다. 오늘 깬 판까지 셉니다.</div>
    ${FUNNEL.length
      // 선 그래프는 아래 눈금을 날짜로 보고 앞 다섯 글자를 잘라서, 레벨 숫자가 하나도 안 보였다. 막대로 바꿨다.
      ? barChart(FUNNEL.map((r) => ({
          bucket: `레벨 ${fmt(r.level)}`, players: Number(r.players),
          filter: { level_min: Number(r.level) }, filterLabel: `레벨 ${fmt(r.level)}까지 온 회원`, sort: "level",
        })))
      : `<div class="empty">레벨 클리어 기록이 아직 없습니다</div>`}
    <h3 class="sub">누적 점수 분포</h3>
    ${BUCKETS.length ? barChart(scoreRows(BUCKETS, "total", "누적 점수"))
                     : `<div class="empty">데이터 없음</div>`}
    <h3 class="sub">일일 점수 분포 — 오늘(한국시간)</h3>
    <div class="muted" style="margin-bottom:6px">오늘 점수를 낸 사람만 셉니다. 0점인 날은 기록이 없습니다.</div>
    ${DAILY_BUCKETS.some((r) => Number(r.players) > 0) ? barChart(scoreRows(DAILY_BUCKETS, "daily", "오늘 점수"))
                           : `<div class="empty">오늘 점수를 낸 회원이 아직 없습니다</div>`}`;
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
  return `<div class="table-scroll"><table style="min-width:460px">
    <thead><tr><th>가입일</th><th style="text-align:right">인원</th>
      <th style="text-align:right">다음 날</th><th style="text-align:right">7일째</th></tr></thead>
    <tbody>${RETENTION.map((r) => `<tr>
      <td class="muted">${fmtDate(r.cohort_date)}</td>
      <td class="num">${fmt(r.cohort)}</td>
      <td class="num">${cell(r, "d1", 1)}</td>
      <td class="num">${cell(r, "d7", 7)}</td>
    </tr>`).join("")}</tbody></table></div>
    <p class="muted" style="font-size:12px">표본이 적은 날은 비율이 크게 튑니다 — 인원수를 같이 보세요.
      그날이 아직 안 지난 칸은 「—」로 비워 둡니다.</p>`;
}

/** 통화를 섞어 더하면 안 된다 — 통화별로 나눠서 보여준다. */
const money = (v, cur) => `${fmt(Math.round(Number(v) || 0))} ${esc(cur || "")}`.trim();

function purchasesTab(err) {
  if (err) return `<div class="notice">구매 조회 실패: ${esc(err.message)}<br>supabase_purchases.sql을 실행했는지 확인하세요.</div>`;
  if (!PAY_LEDGER.length) {
    return `<div class="empty">아직 기록된 구매가 없습니다.<br>
      새 빌드를 배포해야 결제가 서버에 쌓이기 시작합니다 — 과거 결제는 소급되지 않습니다.</div>`;
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
        <div class="label">최근 30일 매출 (${esc(t.cur)})</div>
        <div class="value">${fmt(Math.round(t.revenue))}</div></div>`).join("")}
      <div class="card"><div class="label">결제 건수</div>
        <div class="value">${fmt(PAY_LEDGER.length)}</div></div>
      <div class="card"><div class="label">결제한 회원</div>
        <div class="value">${fmt(new Set(PAY_LEDGER.map((r) => r.profile_id)).size)}</div></div>
    </div>

    <h2>일자별 매출 (최근 30일)</h2>
    ${days.length ? lineChart(days, series) : `<div class="empty">데이터 없음</div>`}

    <h2>월별 매출</h2>
    <div class="table-scroll"><table style="min-width:420px">
      <thead><tr><th>월</th><th>통화</th><th style="text-align:right">매출</th>
        <th style="text-align:right">건수</th><th style="text-align:right">인원</th></tr></thead>
      <tbody>${PAY_MONTHLY.map((r) => `<tr>
        <td>${esc(r.month)}</td><td class="muted">${esc(r.currency)}</td>
        <td class="num">${fmt(Math.round(r.revenue))}</td>
        <td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.buyers)}</td>
      </tr>`).join("")}</tbody></table></div>

    <h2>상품별</h2>
    <div class="table-scroll"><table style="min-width:520px">
      <thead><tr><th>상품</th><th>종류</th><th>통화</th><th style="text-align:right">매출</th>
        <th style="text-align:right">건수</th><th style="text-align:right">인원</th></tr></thead>
      <tbody>${PAY_PRODUCT.map((r) => `<tr>
        <td>${esc(r.product_id)}</td><td class="muted">${esc(r.kind)}</td>
        <td class="muted">${esc(r.currency)}</td>
        <td class="num">${fmt(Math.round(r.revenue))}</td>
        <td class="num">${fmt(r.orders)}</td><td class="num">${fmt(r.buyers)}</td>
      </tr>`).join("")}</tbody></table></div>

    <h2>원장</h2>
    <div class="table-scroll"><table>
      <thead><tr><th>시각</th><th>회원</th><th>상품</th><th style="text-align:right">코인</th>
        <th style="text-align:right">금액</th><th>스토어</th></tr></thead>
      <tbody>${PAY_LEDGER.map((r) => `<tr>
        <td class="muted">${new Date(r.created_at).toLocaleString("ko-KR")}</td>
        <td>${esc(r.username || (r.profile_id || "").slice(0, 8) || "(삭제됨)")}</td>
        <td>${esc(r.product_id)}</td>
        <td class="num">${r.coins ? fmt(r.coins) : "—"}</td>
        <td class="num">${money(r.amount, r.currency)}</td>
        <td class="muted">${esc(r.store)}</td>
      </tr>`).join("")}</tbody></table></div>`;
}

function noticesTab(err) {
  if (err) return `<div class="notice">공지 조회 실패: ${esc(err.message)}<br>supabase_admin_v3.sql을 실행했는지 확인하세요.</div>`;
  const now = Date.now();
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");
  return `<div class="toolbar">
      <span class="muted" style="font-size:12.5px">앱이 접속할 때 가장 최근 공지 하나를 한 번만 보여줍니다</span>
      <div style="flex:1"></div>
      <button class="sm" id="newNotice">공지 작성</button>
    </div>
    ${!NOTICES.length ? `<div class="empty">등록된 공지가 없습니다</div>` : `
    <div class="table-scroll"><table>
      <thead><tr><th>등록</th><th>제목</th><th>내용</th><th>기간</th><th>관리</th></tr></thead>
      <tbody>${NOTICES.map((n) => {
        const expired = n.expires_at && new Date(n.expires_at).getTime() <= now;
        const notYet = n.starts_at && new Date(n.starts_at).getTime() > now;
        return `<tr>
          <td class="muted">${when(n.created_at)}</td>
          <td>${esc(n.title)}</td>
          <td class="muted" style="white-space:normal;max-width:360px">${esc(n.body)}</td>
          <td class="muted">${when(n.starts_at)} ~ ${when(n.expires_at)}
            ${expired ? '<span class="pill heart">만료</span>' : ""}
            ${notYet ? '<span class="pill today">대기</span>' : ""}</td>
          <td><button class="danger sm" data-delnotice="${n.id}">삭제</button></td>
        </tr>`;
      }).join("")}</tbody></table></div>`}`;
}

function pushTab(err) {
  if (err) return `<div class="notice">푸시 조회 실패: ${esc(err.message)}<br>sql/migrations/067_push.sql을 실행했는지 확인하세요.</div>`;
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "—");
  const now = new Date();
  const target = (m) => {
    switch (m.target) {
      case "all": return "동의한 전체";
      case "users": {
        const ids = (m.target_arg || "").split(",").filter(Boolean);
        return `지정 ${fmt(ids.length)}명<br><span style="font-size:11px" title="${esc(ids.join("\n"))}">${esc(ids[0] || "")}${ids.length > 1 ? " …" : ""}</span>`;
      }
      case "filter": return `조건<br><span style="font-size:11px">${describeConds(m.target_arg)}</span>`;
      case "user": return `지정<br><span style="font-size:11px">${esc(m.target_arg || "")}</span>`;
      case "inactive_7d": return "7일 미접속";
      case "top100": return "오늘 상위 100";
      default: return esc(m.target);
    }
  };
  const status = (m) => {
    if (m.sent_at) {
      // 0대이고 실패도 0이면 받을 사람이 없었거나, 발송 함수가 대상을 고르다 실패한 것이다
      // (send-push는 그 경우 이 줄을 「보냄」으로 둔 채 넘어간다). 둘을 가를 기록은 없다.
      const none = !m.sent_count && !m.fail_count && !m.error;
      return `<span class="pill today">보냄</span> ${fmt(m.sent_count)}대${
        m.fail_count ? ` <span class="pill heart">실패 ${fmt(m.fail_count)}</span>` : ""}
        ${m.error ? `<div class="err" style="font-size:11px">대상 고르기 실패: ${esc(m.error)}</div>` : ""}
        ${none ? '<div class="muted" style="font-size:11px">받을 사람이 없었습니다</div>' : ""}
        <div class="muted" style="font-size:11px">${when(m.sent_at)}</div>`;
    }
    const at = new Date(m.scheduled_at);
    if (at > now) return '<span class="pill">예약</span>';
    // 시각은 지났는데 안 나갔다 — 밤 시간이면 8시를 기다리는 중이다(084).
    return inQuiet(now) ? `<span class="pill">${QUIET_END} 대기</span>` : '<span class="pill">곧 나감</span>';
  };
  const pending = PUSHES.filter((m) => !m.sent_at).length;
  return `<div class="toolbar">
      <span class="muted" style="font-size:12.5px">기기 알림으로 나갑니다. <b>보낸 뒤에는 되돌릴 수 없습니다</b>.
        <b>광고성 정보 알림에 동의한 사람에게만</b> 갑니다(기본 꺼짐, 1.4.2부터).
        한국시간 ${QUIET_TEXT}에는 보내지 않고 ${QUIET_END}에 몰아서 내보냅니다.
        광고성 정보면 제목 앞 「(광고)」와 본문 끝 수신거부 안내를 서버가 붙입니다. 서비스 안내는 붙이지 않습니다.${pending ? ` 대기 중 ${fmt(pending)}건.` : ""}</span>
      <div style="flex:1"></div>
      <button class="sm" id="newPush">푸시 발송</button>
    </div>
    <h3 style="margin:18px 0 6px">일자별 발송·열림
      <select id="pushDays" style="margin-left:8px">${[7, 30, 90].map((d) =>
        `<option value="${d}" ${d === PUSH_DAYS ? "selected" : ""}>최근 ${d}일</option>`).join("")}</select></h3>
    ${pushDailyTable()}
    <h3 id="pushHours" style="margin:22px 0 6px">시간대·일자별 열림</h3>
    ${pushHoursView()}
    <h3 style="margin:22px 0 6px">발송 목록</h3>
    ${!PUSHES.length ? `<div class="empty">발송한 푸시가 없습니다</div>` : `
    <div class="table-scroll"><table>
      <thead><tr><th>등록</th><th>제목</th><th>본문</th><th>대상</th><th>나갈 시각</th><th>결과</th><th>열림</th><th>관리</th></tr></thead>
      <tbody>${PUSHES.map((m) => `<tr>
          <td class="muted">${when(m.created_at)}</td>
          <td>${m.kind === "notice" ? '<span class="pill">서비스 안내</span> ' : ""}${esc(m.title)}</td>
          <td class="muted" style="white-space:normal;max-width:320px">${esc(m.body)}${
            `<div style="font-size:11px">열 곳: ${esc(linkLabel(m.link, m.kind))}</div>`}</td>
          <td class="muted" style="white-space:normal;max-width:260px">${target(m)}</td>
          <td class="muted">${when(m.scheduled_at)}</td>
          <td>${status(m)}</td>
          <td class="num" style="white-space:nowrap">${m.sent_at ? `${fmt(m.opens || 0)}회<div class="muted" style="font-size:11px">${pct(m.opens || 0, m.sent_count)}</div>
            <button class="ghost sm" data-hourpush="${m.id}" title="이 푸시가 언제 열렸는지 아래 표로 봅니다">시간대</button>` : '<span class="muted">—</span>'}</td>
          <td style="white-space:nowrap">${m.sent_at ? "" : `<button class="sm" data-editpush="${m.id}">고치기</button>
              <button class="danger sm" data-cancelpush="${m.id}">취소</button>`}
            <button class="ghost sm" data-copypush="${m.id}" title="같은 대상·문구로 새 발송 창을 엽니다">복제</button></td>
        </tr>`).join("")}</tbody></table></div>`}`;
}

// ------------------------------------------------------------------ 동작
async function act(fn, done) {
  try { await fn(); await done?.(); }
  catch (e) { alert("실패: " + e.message); }
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
  $("#evTitle").textContent = `${ev.code} 기간`;
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
    if (starts && ends && ends <= starts) { $("#evErr").textContent = "종료가 시작보다 빠릅니다"; return; }
    await act(async () => {
      const { error } = await sb.from("versus_events")
        .update({ starts_at: starts, ends_at: ends }).eq("id", id);
      if (error) throw error;
      dlg.close();
    }, refresh);
  };
}

/** id가 null이면 전체 지급. 기간을 비워 두면 제한 없이 받을 수 있다. */
function openGrant(id) {
  const p = id ? findPlayer(id) : null;
  const dlg = $("#grantDlg");
  $("#grantTitle").textContent = id ? "보상 지급" : "전체 보상 지급";
  $("#grantWho").textContent = id
    ? `${p.username} 에게 지급합니다. 앱 접속 시 자동으로 받아갑니다.`
    : `전체 회원 ${SUMMARY?.members ?? PLAYERS.length}명에게 지급합니다. 각자 앱을 켤 때 받아갑니다.`;
  $("#gErr").textContent = "";
  ["#gCoins", "#gHints", "#gAutos"].forEach((s) => ($(s).value = 0));
  $("#gMemo").value = "";
  // 받기 시작은 **오늘 지금**을 미리 넣어 둔다(사용자 지시). 비워 두면 "즉시"와 같지만,
  // 빈 칸은 "안 정했다"로도 읽혀서 매번 무엇이 기본인지 다시 생각해야 했다.
  // 마감은 비워 둔다 — 언제까지 받게 할지는 보상마다 다르고, 잘못 넣으면 못 받는다.
  $("#gStart").value = localDatetimeValue(new Date());
  $("#gEnd").value = "";
  dlg.showModal();
  $("#gCancel").onclick = () => dlg.close();
  $("#gOk").onclick = async () => {
    const coins = Number($("#gCoins").value) || 0;
    const hints = Number($("#gHints").value) || 0;
    const autos = Number($("#gAutos").value) || 0;
    if (coins + hints + autos <= 0) { $("#gErr").textContent = "하나 이상 입력하세요"; return; }
    // datetime-local은 표준시 표기가 없다 — 브라우저(=한국) 기준으로 해석해 ISO로 보낸다.
    const at = (v) => (v ? new Date(v).toISOString() : null);
    const starts = at($("#gStart").value), ends = at($("#gEnd").value);
    if (starts && ends && ends <= starts) { $("#gErr").textContent = "종료가 시작보다 빠릅니다"; return; }
    try {
      if (id) {
        await rpc("admin_grant_reward", {
          p_target: id, p_coins: coins, p_hints: hints, p_autos: autos,
          p_memo: $("#gMemo").value.trim() || null,
          p_starts_at: starts, p_expires_at: ends,
        });
      } else {
        const reason = askReason("전체 보상 지급");
        if (reason === null) return;
        await rpc("admin_grant_reward_all", {
          p_coins: coins, p_hints: hints, p_autos: autos,
          p_memo: $("#gMemo").value.trim() || null,
          p_starts_at: starts, p_expires_at: ends, p_reason: reason,
        });
      }
      dlg.close();
      refresh();
    } catch (e) { $("#gErr").textContent = e.message; }
  };
}

function openNotice() {
  const dlg = $("#noticeDlg");
  ["#nTitle", "#nBody", "#nStart", "#nEnd"].forEach((x) => ($(x).value = ""));
  $("#nErr").textContent = "";
  dlg.showModal();
  $("#nCancel").onclick = () => dlg.close();
  $("#nOk").onclick = async () => {
    const title = $("#nTitle").value.trim(), body = $("#nBody").value.trim();
    if (!title || !body) { $("#nErr").textContent = "제목과 내용을 모두 입력하세요"; return; }
    const at = (v) => (v ? new Date(v).toISOString() : null);
    try {
      await rpc("admin_create_notice", {
        p_title: title, p_body: body,
        p_starts_at: at($("#nStart").value), p_expires_at: at($("#nEnd").value),
      });
      dlg.close();
      refresh();
    } catch (e) { $("#nErr").textContent = e.message; }
  };
}

// ------------------------------------------------------------------ 푸시 대상 조건
// 서버 push_condition_ok(086)와 짝이다. 종류(t)와 칸 이름을 바꾸면 거기도 바꾼다.
const OPS_NUM = [["gte", "이상"], ["lte", "이하"]];
const OPS_DAYS = [["within", "일 안에"], ["over", "일 넘게 지남"]];
const COND_TYPES = {
  rank: { label: "날짜별 랭킹", fields: [
    { k: "date", type: "date", def: () => kstDate(-1), pre: "" },
    { k: "from", type: "number", def: 1, pre: "" },
    { k: "to", type: "number", def: 10, pre: "~", post: "위" }] },
  score: { label: "점수", fields: [
    { k: "field", type: "select", opts: [["today", "오늘 점수"], ["total", "누적 점수"]], def: "today" },
    { k: "v", type: "number", def: 0 },
    { k: "op", type: "select", opts: OPS_NUM, def: "lte" }] },
  seen: { label: "마지막 접속", fields: [
    { k: "days", type: "number", def: 7 },
    { k: "op", type: "select", opts: OPS_DAYS, def: "over" }] },
  joined: { label: "가입", fields: [
    { k: "days", type: "number", def: 7 },
    { k: "op", type: "select", opts: OPS_DAYS, def: "within" }] },
  purchased: { label: "결제", fields: [
    { k: "item", type: "select", def: "any", opts: [["any", "아무 상품"], ["remove_ads", "광고 제거"],
      ["support", "응원"], ["coins", "코인팩(아무거나)"], ["coins:600", "코인 600"],
      ["coins:3300", "코인 3,300"], ["coins:7200", "코인 7,200"]] },
    { k: "has", type: "select", opts: [["true", "산 적 있음"], ["false", "산 적 없음"]], def: "true" }] },
  coins: { label: "코인 잔액", fields: [
    { k: "v", type: "number", def: 5000 },
    { k: "op", type: "select", opts: OPS_NUM, def: "gte" }] },
  versus: { label: "대전 (최근 90일)", fields: [
    { k: "field", type: "select", opts: [["played", "판 수"], ["wins", "1등 수"]], def: "played" },
    { k: "v", type: "number", def: 1 },
    { k: "op", type: "select", opts: OPS_NUM, def: "gte" }] },
  supporter: { label: "응원 결제 회원", fields: [] },
  platform: { label: "기기", fields: [
    { k: "v", type: "select", opts: [["ios", "iPhone·iPad"], ["android", "Android"]], def: "ios" }] },
  lang: { label: "앱 언어", fields: [
    { k: "v", type: "select", opts: [["ko", "한국어"], ["en", "English"], ["ja", "日本語"], ["zh", "中文"]], def: "ko" }] },
};
// 자주 쓰는 조건. 고르면 조건 줄이 그대로 들어간다(이미 있는 줄에 더해진다).
const COND_PRESETS = [
  ["어제 랭킹 1~10위", () => [{ t: "rank", date: kstDate(-1), from: 1, to: 10 }]],
  ["오늘 0점 (오늘 안 깬 사람)", () => [{ t: "score", field: "today", op: "lte", v: 0 }]],
  ["7일 넘게 안 들어온 사람", () => [{ t: "seen", op: "over", days: 7 }]],
  ["가입 3일 안의 새 회원", () => [{ t: "joined", op: "within", days: 3 }]],
  ["결제한 적 없는 사람", () => [{ t: "purchased", item: "any", has: "false" }]],
  ["광고 제거 구매자", () => [{ t: "purchased", item: "remove_ads", has: "true" }]],
  ["코인 5,000 이상 쌓인 사람", () => [{ t: "coins", op: "gte", v: 5000 }]],
  ["대전을 한 번도 안 한 사람", () => [{ t: "versus", field: "played", op: "lte", v: 0 }]],
];
const LANG_NAMES = { ko: "한국어", en: "English", ja: "日本語", zh: "中文" };
const PLATFORM_NAMES = { ios: "iOS", android: "Android" };

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
  { link: "", label: "설정 화면 · 광고성 알림을 끄는 곳 · 기본" },
  { link: "/home", label: "홈 화면 · 앱만 열기" },
  { link: "/shop", label: "상점" },
  { link: "/ranking", label: "랭킹" },
  { link: "/missions", label: "미션" },
  { link: "/vs/", label: "대전 초대 · 방 코드로 바로 입장", code: true },
];
/** 링크를 사람이 읽는 이름으로. 모르는 링크는 링크를 그대로 보인다.
 *  서비스 안내(notice)는 링크가 비면 서버가 설정 대신 홈을 연다(095). */
function linkLabel(link, kind = "ad") {
  if (!link && kind === "notice") return "홈 화면 · 앱만 열기 · 기본";
  if (!link || link === "/settings") return PUSH_LINKS[0].label;
  if (/^\/vs\/\d{6}$/.test(link)) return `대전 초대 · 방 ${link.slice(4)}`;
  return PUSH_LINKS.find((x) => x.link === link)?.label ?? link;
}
// 085 이전에 만든 대상. 새 화면의 조건으로 옮기면 판정이 조금 달라져서(086 seen은 접속 기준) 그대로 둔다.
const LEGACY_TARGETS = { inactive_7d: "옛 대상: 7일 미접속", top100: "옛 대상: 오늘 상위 100" };
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
  const name = (type, k, v) => (COND_TYPES[type]?.fields.find((f) => f.k === k)?.opts || [])
    .find(([x]) => String(x) === String(v))?.[1] ?? v;
  return list.map((c) => {
    switch (c.t) {
      case "rank": return `${c.date === "today" ? "나가는 날" : c.date} 랭킹 ${c.from}~${c.to}위`;
      case "score": return `${name("score", "field", c.field)} ${fmt(c.v)} ${name("score", "op", c.op)}`;
      case "seen": return `접속 ${c.days}${name("seen", "op", c.op)}`;
      case "joined": return `가입 ${c.days}${name("joined", "op", c.op)}`;
      case "purchased": return `${name("purchased", "item", c.item)} ${name("purchased", "has", String(c.has))}`;
      case "coins": return `코인 ${fmt(c.v)} ${name("coins", "op", c.op)}`;
      case "versus": return `대전 ${name("versus", "field", c.field)} ${fmt(c.v)} ${name("versus", "op", c.op)}`;
      case "supporter": return "응원 결제 회원";
      case "platform": return PLATFORM_NAMES[c.v] || c.v;
      case "lang": return LANG_NAMES[c.v] || c.v;
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
      out[f.k] = f.type === "number" ? Number(v) : f.k === "has" ? String(v) === "true" : v;
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
  let li = PUSH_LINKS.findIndex((x) => !x.code && x.link === link0);
  $("#pLinkCode").value = "";
  if (li < 0 && /^\/vs\/\d{6}$/.test(link0)) { li = PUSH_LINKS.findIndex((x) => x.code); $("#pLinkCode").value = link0.slice(4); }
  if (li < 0) {
    $("#pLinkSel").insertAdjacentHTML("beforeend", `<option value="raw">그대로 · ${esc(link0)}</option>`);
    $("#pLinkSel").value = "raw";
  } else $("#pLinkSel").value = String(li);
  const showLinkCode = () => {
    const x = PUSH_LINKS[Number($("#pLinkSel").value)];
    $("#pLinkCodeRow").style.display = x && x.code ? "" : "none";
  };
  $("#pLinkSel").onchange = showLinkCode;
  showLinkCode();
  const currentLink = () => {
    if ($("#pLinkSel").value === "raw") return link0;
    const x = PUSH_LINKS[Number($("#pLinkSel").value)];
    if (x.code) return `/vs/${$("#pLinkCode").value.trim()}`;
    return x.link || null;
  };
  // 이미 지난 예약 시각(밤이라 8시를 기다리는 줄)은 비워서 연다. 그대로 두면 「지난 시각」으로 막힌다.
  const pastAt = pf.scheduled_at && new Date(pf.scheduled_at) < new Date(Date.now() - 10 * 60e3);
  $("#pWhen").value = editId && pf.scheduled_at && !pastAt ? toKstInput(pf.scheduled_at) : "";
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
  dlg.querySelector("h3").textContent = editId ? "예약 고치기" : "푸시 발송";
  $("#pOk").textContent = editId ? "고치기" : "발송";

  const renderConds = () => {
    $("#pConds").innerHTML = conds.map((c, i) => {
      const type = COND_TYPES[c.t];
      const fields = type.fields.map((f) => {
        const v = c[f.k] ?? (typeof f.def === "function" ? f.def() : f.def);
        c[f.k] = v;
        const input = f.type === "select"
          ? `<select data-ci="${i}" data-ck="${f.k}">${f.opts.map(([x, l]) =>
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
        <button class="ghost sm" type="button" data-cdel="${i}">빼기</button>
      </div>`;
    }).join("") + `<div style="margin:6px 0"><select id="pPreset"><option value="">자주 쓰는 조건 넣기…</option>${
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
      summary = "받을 사람: — (회원을 찾아 넣으세요)";
      $("#pCount").textContent = summary;
      $("#pPreview").textContent = "";
      return summary;
    }
    if (t === "filter" && !conds.length) {
      summary = "받을 사람: — (조건을 하나 이상 넣으세요)";
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
      summary = `받을 사람: ${fmt(r.people)}명, 기기 ${fmt(r.devices)}대`;
      $("#pCount").innerHTML = `받을 사람: <b>${fmt(r.people)}명</b> (기기 ${fmt(r.devices)}대)` +
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
      if (foreign) $("#pPreview").innerHTML += `<div style="margin-top:4px">「주의」 한국어가 아닌 기기 ${fmt(foreign)}대에도 이 문구 그대로 갑니다. 언어별로 보내려면 「앱 언어」 조건을 넣어 따로 보내세요.</div>`;
      return summary;
    } catch (e) {
      if (!live()) return null;
      summary = "받을 사람: 확인 실패";
      $("#pCount").textContent = summary;
      $("#pPreview").textContent = e.message;
      return summary;
    }
  };
  // 입력 중에는 300ms 모았다가 센다.
  const recount = () => {
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
        ${u.reachable ? '<span class="pill today">받음</span>' : '<span class="muted" style="font-size:11px" title="광고성 알림을 안 켰거나 기기 토큰이 없습니다">못 받음</span>'}
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
    if (!title || !body) { $("#pErr").textContent = "제목과 본문을 모두 입력하세요"; return; }
    const t = $("#pTarget").value, arg = currentArg();
    if (t === "users" && !picked.size) { $("#pErr").textContent = "보낼 회원을 찾아 넣으세요"; return; }
    const linkNow = currentLink();
    if (linkNow && linkNow.startsWith("/vs/") && !/^\/vs\/\d{6}$/.test(linkNow)) {
      $("#pErr").textContent = "방 코드는 숫자 6자리입니다"; return;
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
    const kindLine = kind === "notice" ? "종류: 서비스 안내 · 「(광고)」 없이 나갑니다" : "종류: 광고성 정보 · 「(광고)」를 붙입니다";
    if (!confirm(`${counted}\n${when}\n${kindLine}\n눌렀을 때: ${linkLabel(linkNow, kind)}\n\n"${title}"\n\n${verb}`)) return;
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
function pushSelected() {
  const ids = [...SELECTED];
  if (!ids.length) { alert("먼저 회원을 체크하세요"); return; }
  // 받을 수 있는지 모르면 막지 않는다. 창의 미리보기가 실제 수를 센다.
  const off = REACH === null ? 0 : ids.filter((id) => !REACH[id]).length;
  if (off && off === ids.length) {
    alert(`체크한 ${ids.length}명 모두 지금은 푸시를 받을 수 없습니다.\n「푸시」 칸이 「받음」인 회원만 받습니다.`);
    return;
  }
  if (off && !confirm(`체크한 ${ids.length}명 중 ${off}명은 푸시를 받을 수 없습니다(광고성 알림을 안 켰거나 기기 토큰이 없음).\n나머지 ${ids.length - off}명에게 보내는 창을 열까요?`)) return;
  openPush({ target: "users", target_arg: ids.join(","),
             names: Object.fromEntries(ids.map((id) => [id, findPlayer(id)?.username || null])) });
}

async function cancelPush(id) {
  if (!confirm("아직 안 나간 발송을 취소합니다.")) return;
  await act(() => rpc("admin_cancel_push", { p_id: id }), refresh);
}

async function deleteNotice(id) {
  if (!confirm("이 공지를 삭제합니다. 아직 못 본 사람은 앞으로도 못 봅니다.")) return;
  const reason = askReason("공지 삭제");
  if (reason === null) return;
  await act(() => rpc("admin_delete_notice", { p_id: id, p_reason: reason }), refresh);
}

async function toggleMember(id) {
  if (OPEN_MEMBER === id) { OPEN_MEMBER = null; MEMBER_EVENTS = []; MEMBER_PAYS = []; render(); return; }
  OPEN_MEMBER = id;
  try { MEMBER_EVENTS = await rpc("admin_member_events", { p_target: id, p_limit: 200 }) || []; }
  catch (e) { MEMBER_EVENTS = []; alert("이력 조회 실패: " + e.message); }
  // 구매 기능을 아직 안 깐 프로젝트에서도 이력은 열려야 한다.
  try { MEMBER_PAYS = await rpc("admin_member_purchases", { p_target: id, p_limit: 100 }) || []; }
  catch { MEMBER_PAYS = []; }
  render();
}

async function toggleBatch(id) {
  if (OPEN_BATCH === id) { OPEN_BATCH = null; BATCH_MEMBERS = []; render(); return; }
  OPEN_BATCH = id;
  try { BATCH_MEMBERS = await rpc("admin_batch_members", { p_batch: id }) || []; }
  catch (e) { BATCH_MEMBERS = []; alert("명단 조회 실패: " + e.message); }
  render();
}

async function revokeBatch(id) {
  const b = BATCHES.find((x) => x.id === id);
  // 등록−수령으로 계산하면 안 된다 — 회수로 지워진 건 등록 숫자에 남아 있어서,
  // 회수를 반복해도 "17건 회수합니다 → 0건 회수했습니다"만 돌았다(실측).
  const left = Number(b?.pending_count || 0);
  if (!confirm(`아직 안 받아 간 ${left}건을 회수합니다.\n\n` +
    `이미 받아 간 사람의 코인은 기기에 들어가 있어서 되돌릴 수 없습니다.`)) return;
  const reason = askReason("지급 묶음 회수");
  if (reason === null) return;
  await act(async () => {
    const n = await rpc("admin_revoke_batch", { p_batch: id, p_reason: reason });
    alert(`${n}건을 회수했습니다`);
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
function rankRewardEditor() {
  const tiers = Array.isArray(CONFIG?.rank_rewards?.tiers) ? CONFIG.rank_rewards.tiers : [];
  const n = (v) => Number(v ?? 0) || 0;
  const row = (t, i) => `
    <tr data-tier="${i}">
      <td class="num"><input type="number" min="1" class="t-to"    value="${n(t.to)}"    style="width:80px"></td>
      <td class="num"><input type="number" min="0" class="t-coins" value="${n(t.coins)}" style="width:100px"></td>
      <td class="num"><input type="number" min="0" class="t-hints" value="${n(t.hints)}" style="width:80px"></td>
      <td class="num"><input type="number" min="0" class="t-autos" value="${n(t.autos)}" style="width:80px"></td>
      <td><button class="sm" data-tier-del="${i}">삭제</button></td>
    </tr>`;
  const body = tiers.length
    ? tiers.map(row).join("")
    : `<tr><td colspan="5" class="muted">표가 비어 있습니다. 비면 서버가 기본값으로 정산합니다.</td></tr>`;
  return `
    <div class="notice">
      <b>「~등까지」로 적습니다.</b> 1 · 2 · 3 · 5 · 10이면 4등은 「5까지」 줄을 받습니다.
      <b>마지막 줄이 몇 등까지 줄지를 정합니다.</b>
      <br>여기를 고치면 <b>앱 안내 문구도 같이 바뀝니다.</b> 앱을 다시 올릴 필요가 없습니다.
      <br>앱 랭킹 목록은 100명까지만 보여 줍니다 — 그보다 많이 주면 지급은 되지만 목록에는 안 보입니다.
    </div>
    <div class="table-scroll"><table style="min-width:520px">
      <thead><tr>
        <th class="num">~등까지</th><th class="num">코인</th>
        <th class="num">힌트</th><th class="num">자동배치</th><th></th>
      </tr></thead>
      <tbody id="tierBody">${body}</tbody>
    </table></div>
    <div class="toolbar">
      <button class="sm" id="tierAdd">줄 추가</button>
      <div style="flex:1"></div>
      <button class="sm" id="saveTiers">저장</button>
    </div>`;
}

/**
 * 표를 읽어 서버에 올린다.
 *
 * **`to` 오름차순으로 세워서 보낸다.** 서버는 「등수를 덮는 첫 줄」을 고르는데,
 * 순서가 뒤섞여 있으면 사람이 의도한 줄과 다른 줄이 걸린다.
 */
async function saveRankRewards() {
  const rows = [...document.querySelectorAll("#tierBody tr[data-tier]")];
  const tiers = rows.map((tr) => ({
    to:    Math.max(1, Number(tr.querySelector(".t-to").value) || 0),
    coins: Math.max(0, Number(tr.querySelector(".t-coins").value) || 0),
    hints: Math.max(0, Number(tr.querySelector(".t-hints").value) || 0),
    autos: Math.max(0, Number(tr.querySelector(".t-autos").value) || 0),
  })).sort((a, b) => a.to - b.to);

  // 같은 등수가 두 줄이면 뒤의 줄은 영영 안 걸린다 — 조용히 죽는 설정은 만들지 않는다.
  const dup = tiers.find((t, i) => i > 0 && t.to === tiers[i - 1].to);
  if (dup) return alert(`「${dup.to}등까지」가 두 줄입니다. 한 줄로 합쳐 주세요.`);

  const last = tiers.length ? tiers[tiers.length - 1].to : 0;
  if (!confirm(`${last}등까지 보상을 줍니다.\n\n` +
               tiers.map((t) => `  ~${t.to}등: 코인 ${t.coins}` +
                 (t.hints || t.autos ? ` · 힌트 ${t.hints} · 자동 ${t.autos}` : "")).join("\n") +
               `\n\n앱 안내 문구도 이대로 바뀝니다. 저장할까요?`)) return;

  await act(() => rpc("admin_set_config",
                      { p_key: "rank_rewards", p_value: { tiers } }), refresh);
}

/**
 * 업데이트 관문. 숫자는 Android versionCode / iOS 빌드 번호다.
 *
 * 사람이 읽는 1.1.2가 아니라 정수로 비교한다 — 문자열 버전 비교는 "1.10 < 1.9"가 되는
 * 함정이 있어 반드시 틀린다. 0은 "검사 안 함"이다.
 */
function updateTab(err) {
  if (err) {
    return `<div class="notice">설정 조회 실패: ${esc(err.message)}<br>
            sql/migrations/013_app_config.sql을 실행했는지 확인하세요.</div>`;
  }
  const g = (k, p) => Number(CONFIG?.[k]?.[p] ?? 0);
  const url = (p) => String(CONFIG?.store_url?.[p] ?? "");
  const row = (p, label) => `
    <tr>
      <td><b>${label}</b></td>
      <td class="num"><input type="number" id="min_${p}" value="${g("min_version", p)}" style="width:90px"></td>
      <td class="num"><input type="number" id="latest_${p}" value="${g("latest_version", p)}" style="width:90px"></td>
      <td><input type="text" id="url_${p}" value="${esc(url(p))}" placeholder="스토어 주소" style="width:100%"></td>
    </tr>`;
  return `
    <div class="notice">
      <b>강제 업데이트는 되돌리기 어렵습니다.</b>
      최소 버전을 지금 배포된 버전보다 높게 넣으면 <b>모든 사용자가 앱을 못 씁니다.</b>
      새 버전이 스토어에 올라가 심사를 통과한 뒤에 올리세요. 0이면 검사하지 않습니다.
    </div>
    <div class="table-scroll"><table style="min-width:640px">
      <thead><tr>
        <th>플랫폼</th><th class="num">최소 버전 (강제)</th>
        <th class="num">최신 버전 (권장)</th><th>스토어 주소</th>
      </tr></thead>
      <tbody>${row("android", "Android")}${row("ios", "iOS")}</tbody>
    </table></div>
    <div class="toolbar"><button class="sm" id="saveVersions">저장</button></div>

    <h2>점검 모드</h2>
    ${maintenanceBanner()}
    <div class="notice">
      켜면 앱이 안내 문구를 띄우고 <b>랭킹·같이하기만</b> 잠급니다.
      레벨 진행(오프라인 게임)은 막지 않습니다. 서버를 못 읽는 앱도 막히지 않습니다.
      <br>앱은 <b>1분 안에</b> 스스로 확인합니다 — 사용자가 앱을 껐다 켤 필요가 없습니다.
    </div>
    <div class="toolbar">
      <label class="switch">
        <input type="checkbox" id="maintOn" ${CONFIG?.maintenance?.on ? "checked" : ""}>
        <span>점검 중</span>
      </label>
      <!-- input[type=text]은 줄바꿈을 담지 못해 엔터를 쳐도 한 줄로 붙었다
           (사용자 제보). 앱은 두 줄 이상도 그대로 그리므로 textarea로 바꾼다. -->
      <textarea id="maintMsg" rows="2" placeholder="안내 문구 (비우면 기본 문구) — 줄바꿈 가능"
                style="flex:1;resize:vertical;font:inherit">${esc(CONFIG?.maintenance?.message || "")}</textarea>
      <button class="sm" id="saveMaint">저장</button>
    </div>
    <div class="toolbar">
      <span class="muted">예약(한국시간, 비우면 예약 없음)</span>
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
      예약이 있으면 그 시간 동안 앱이 스스로 점검 상태가 됩니다. 스위치를 켤 필요가 없습니다.
      <b>넣은 뒤 저장을 눌러야</b> 반영됩니다.
    </div>

    <h2>서버 주소 이사</h2>
    <div class="notice">
      <b>평소에는 비워 두세요.</b> 값을 넣으면 앱이 <b>다음 실행부터</b> 그 주소로 접속합니다.
      옛 주소를 내리기 전까지는 두 주소가 <b>모두 살아 있어야</b> 합니다.
      잘못 넣어도 앱은 세 번 실패하면 원래 주소로 스스로 돌아옵니다.
    </div>
    <div class="toolbar">
      <input type="text" id="apiUrl" placeholder="https://api.내도메인.com (비우면 기본 주소)"
             value="${esc(String(CONFIG?.api_url ?? ""))}" style="flex:1">
      <button class="danger sm" id="saveApiUrl">저장</button>
    </div>

    <h2>이상 징후 문턱</h2>
    <div class="toolbar">
      <span class="muted">오늘 코인 획득이 이 값 이상이면 상단에 배지로 띄웁니다</span>
      <input type="number" id="anomalyTh" value="${Number(CONFIG?.anomaly_threshold ?? 3000)}" style="width:110px">
      <button class="sm" id="saveAnomaly">저장</button>
    </div>`;
}

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
 *   기록 — 지나간 걸 훑어보는 자리(읽기 전용): 이벤트·구매·관리 기록
 *   운영 — 앱에 지시를 내리는 자리(설정을 바꿈): 업데이트·공지·서버 상태
 * 이 구분이 있으면 "위험한 버튼이 어디 있나"를 메뉴 이름만 보고 안다.
 */
const NAV = [
  { id: "charts", label: "차트" },
  { id: "ranking", label: "랭킹" },
  { label: "같이하기", items: [["versus", "현황"], ["versusset", "설정"]] },
  { label: "회원", items: [["players", "회원 목록"], ["rewards", "보상"]] },
  { label: "기록", items: [["events", "이벤트"], ["purchases", "구매"], ["audit", "관리 기록"]] },
  { label: "운영", items: [["anomaly", "이상 징후"], ["update", "업데이트"],
                          ["notices", "공지"], ["push", "푸시"], ["server", "서버 상태"]] },
];

let SRV = null, WINNERS = [], TRANSFERS = [], COIN_AUDIT = [];
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
    return `<div class="notice">랭킹 조회 실패: ${esc(err.message)}<br>
            sql/migrations/077_admin_daily_ranking.sql을 실행했는지 확인하세요.</div>`;
  }
  const today = kstToday();
  const day = RANK_DATE || today;
  const stat = RANK_STATS.find((r) => String(r.day).slice(0, 10) === day);
  // 집계 줄은 점수를 낸 사람이 있는 날에만 있다(080). 없는 날의 최고·평균을 0으로 적으면 0점을 낸 것처럼 읽힌다.
  const score = (k) => (stat && Number(stat.players) > 0 && stat[k] != null ? fmt(stat[k]) : "—");

  const cards = `
    <div class="cards">
      <div class="card"><div class="label">참가자</div><div class="value">${fmt(RANK_TOTAL)}</div></div>
      <div class="card"><div class="label">최고 점수</div><div class="value">${score("top_score")}</div></div>
      <div class="card"><div class="label">평균</div><div class="value">${score("avg_score")}</div></div>
      <div class="card"><div class="label">중앙값</div><div class="value">${score("median_score")}</div></div>
    </div>`;

  const days = RANK_STATS.map((r) => String(r.day).slice(5, 10));
  const charts = RANK_STATS.length ? `
    <h3 class="sub">날짜별 참가자</h3>
    ${lineChart(days, [
      { name: "참가자", color: "#7aa2f7", values: RANK_STATS.map((r) => Number(r.players)) },
    ])}
    <h3 class="sub">점수 분포 (최고 · 평균 · 중앙값)</h3>
    ${lineChart(days, [
      { name: "최고", color: "#d9a441", values: RANK_STATS.map((r) => Number(r.top_score)) },
      { name: "평균", color: "#17b3a8", values: RANK_STATS.map((r) => Number(r.avg_score)) },
      { name: "중앙값", color: "#9a8cff", values: RANK_STATS.map((r) => Number(r.median_score)) },
    ])}`
    : `<div class="empty">집계가 없습니다</div>`;

  const rows = RANKING.length ? `<div class="table-scroll"><table style="min-width:720px">
      <thead><tr>
        <th>등수</th><th>닉네임</th><th class="num">오늘 점수</th>
        <th class="num">누적</th><th class="num">코인</th>
        <th>보상</th><th>수령</th>
      </tr></thead>
      <tbody>${RANKING.map((r) => `<tr>
        <td class="num">${r.rank}</td>
        <td>${esc(r.username || "— (탈퇴)")}
          ${r.supporter ? '<span class="pill heart">응원</span>' : ""}</td>
        <td class="num">${fmt(r.daily_score)}</td>
        <td class="num muted">${fmt(r.total_score)}</td>
        <td class="num muted">${r.coins == null ? "—" : fmt(r.coins)}</td>
        <td class="muted">${r.reward_coins == null ? "—"
          : `코인 ${fmt(r.reward_coins)}` +
            ((r.reward_hints || r.reward_autos)
              ? ` · 힌트 ${r.reward_hints} · 자동 ${r.reward_autos}` : "")}</td>
        <td>${r.reward_coins == null ? '<span class="muted">—</span>'
            : r.claimed ? '<span class="muted">받아 감</span>'
                        : '<span class="pill heart">소멸/대기</span>'}</td>
      </tr>`).join("")}</tbody></table></div>`
    : (RANK_SINCE && day < RANK_SINCE)
      ? `<div class="empty">${day}은 <b>기록 시작 전</b>입니다 —
         날짜별 기록은 ${RANK_SINCE}부터 쌓입니다</div>`
      : `<div class="empty">그날 점수를 낸 사람이 없습니다</div>`;

  // 50명씩 끊어 받는다. 전체 수를 알고 있으므로 몇 쪽인지 바로 쓸 수 있다.
  const pages = Math.max(1, Math.ceil(RANK_TOTAL / RANK_SIZE));
  const paging = pages > 1 ? `
    <div class="toolbar">
      <button class="sm" id="rankPrev" ${RANK_PAGE === 0 ? "disabled" : ""}>이전</button>
      <span class="muted">${RANK_PAGE + 1} / ${pages} 쪽 (${fmt(RANK_TOTAL)}명)</span>
      <button class="sm" id="rankNext" ${RANK_PAGE + 1 >= pages ? "disabled" : ""}>다음</button>
    </div>` : "";

  return `
    <div class="notice">
      <b>앱이 보는 것과 같은 목록입니다.</b> 「그 날짜에 점수 1 이상」인 사람만 셉니다 —
      회원 목록과 모집단이 다릅니다(그쪽은 점수가 0인 사람도 들어 있습니다).
      <br>앱은 이 중 <b>100명까지</b> 보여 줍니다. 그보다 아래는 앱에서
      「내 순위 N위」 줄로만 알 수 있습니다.
      <br><b>지난 날짜도 정확합니다</b>(080부터). 점수를 올릴 때 날짜별로 한 줄씩
      따로 남기므로, 그 사람이 다시 접속해도 지난 날짜의 줄은 그대로 있습니다.
      ${RANK_SINCE
        ? `기록은 <b>${RANK_SINCE}</b>부터 있습니다. 그 전 날짜는 1~10등만
           「운영 → 서버 상태」의 수상자 표에 남아 있습니다.`
        : `<b>서버에 080이 아직 안 올라갔습니다.</b> 지금 보이는 지난 날짜는
           다시 접속하지 않은 사람만 남은 수라 참고용입니다.`}
    </div>
    <div class="toolbar">
      <input type="date" id="rankDate" value="${day}" max="${today}"
             ${RANK_SINCE ? `min="${RANK_SINCE}"` : ""}>
      <button class="sm" id="rankToday">오늘</button>
      <div style="flex:1"></div>
      <span class="muted">기준 ${day} (한국시간)</span>
    </div>
    ${cards}
    ${charts}
    <h2>참가자 (${fmt(RANK_TOTAL)}명)</h2>
    ${paging}
    ${rows}
    ${paging}`;
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
  if (err) return `<div class="notice">서버 상태 조회 실패: ${esc(err.message)}</div>`;
  const mig = SRV ? `
    <div class="cards">
      <div class="card"><div class="label">적용된 마이그레이션</div>
        <div class="value">${fmt(SRV.applied)} / ${fmt(SRV.total)}</div></div>
    </div>
    ${(SRV.missing || []).length
      ? `<div class="notice" style="border-color:var(--danger);color:var(--danger)">
           <b>아직 안 돌린 파일</b> — ${(SRV.missing || []).map(esc).join(", ")}
         </div>`
      : `<div class="notice">빠진 파일 없습니다.</div>`}`
    : `<div class="empty">052를 적용하면 여기에 나옵니다</div>`;

  const audit = COIN_AUDIT.length ? `<div class="table-scroll"><table style="min-width:720px">
      <thead><tr><th>닉네임</th><th class="num">실제 잔액</th><th class="num">기대 잔액</th>
        <th class="num">차이</th><th class="num">획득</th><th class="num">소모</th>
        <th class="num">받은 보상</th><th>가입</th></tr></thead>
      <tbody>${COIN_AUDIT.map((r) => `<tr>
        <td>${esc(r.username || "—")}</td>
        <td class="num">${fmt(r.actual)}</td>
        <td class="num">${fmt(r.expected)}</td>
        <td class="num" style="color:var(--danger);font-weight:800">+${fmt(r.gap)}</td>
        <td class="num">${fmt(r.earned)}</td>
        <td class="num">${fmt(r.spent)}</td>
        <td class="num">${fmt(r.granted)}</td>
        <td class="muted">${fmtDate(r.created_at)}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">차이가 큰 계정이 없습니다</div>`;

  // 065 — 10등까지, 코인·아이템·수령 여부. 지난 것(어제 이전)의 "대기"는 소멸이다:
  // 순위 보상은 다음 날 하루만 받을 수 있다(매일 접속 유도, 사용자 확정).
  const winners = WINNERS.length ? `<div class="table-scroll"><table style="min-width:560px">
      <thead><tr><th>날짜</th><th>등수</th><th>닉네임</th><th>코인</th><th>아이템</th><th>수령</th></tr></thead>
      <tbody>${WINNERS.map((w) => `<tr>
        <td class="muted">${fmtDate(w.award_date)}</td>
        <td>${w.rank === 1 ? "🥇" : w.rank === 2 ? "🥈" : w.rank === 3 ? "🥉" : w.rank + "등"}</td>
        <td>${esc(w.username || "— (탈퇴)")}</td>
        <td class="num">${(w.coins ?? "").toLocaleString ? (w.coins).toLocaleString() : w.coins ?? ""}</td>
        <td class="muted">${(w.hints || w.autos) ? `힌트 ${w.hints} · 자동 ${w.autos}` : "—"}</td>
        <td>${w.claimed ? '<span class="muted">받아 감</span>'
                        : '<span class="pill heart">소멸/대기</span>'}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">아직 없습니다</div>`;

  const transfers = TRANSFERS.length ? `<div class="table-scroll"><table style="min-width:560px">
      <thead><tr><th>코드</th><th>닉네임</th><th>발급</th><th>상태</th></tr></thead>
      <tbody>${TRANSFERS.map((t) => `<tr>
        <td class="num"><b>${esc(t.code)}</b></td>
        <td>${esc(t.username || "—")}</td>
        <td class="muted">${fmtDate(t.created_at)}</td>
        <td>${t.used_at ? `<span class="muted">사용됨 ${fmtDate(t.used_at)}</span>`
              : t.expired ? '<span class="pill heart">만료</span>'
              : '<span class="pill today">대기</span>'}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">발급된 코드가 없습니다</div>`;

  return `
    <h2>마이그레이션</h2>
    ${mig}

    <h2>코인 잔액 대조</h2>
    <div class="muted" style="margin-bottom:6px">
      운영 → <b>이상 징후</b>에 같은 표가 다른 항목과 함께 있습니다.</div>
    <div class="notice">
      앱이 올린 잔액과 <b>events로 계산한 잔액</b>을 맞대어 봅니다. 차이가 크게 양수면
      이벤트 없이 코인이 생긴 것입니다. <b>막지는 않습니다</b> — 오프라인에서 쓰고 늦게
      올라오거나 기기 이전 직후에도 차이가 날 수 있어, 판단은 사람이 합니다.
      events는 30일만 보관하므로 <b>가입이 오래된 계정일수록 차이가 크게 나옵니다.</b>
    </div>
    ${audit}

    <h2>랭킹 보상 설정</h2>
    ${rankRewardEditor()}

    <h2>어제의 랭킹 보상</h2>
    <div class="toolbar">
      <select id="winnerDays">
        ${[7, 14, 30, 90].map((d) =>
          `<option value="${d}" ${d === WINNER_DAYS ? "selected" : ""}>최근 ${d}일</option>`).join("")}
      </select>
    </div>
    ${winners}

    <h2>기기 이전 코드 (최근 50건)</h2>
    ${transfers}

    <h2>정리</h2>
    <div class="toolbar">
      <span class="muted">프로필 없이 24시간 넘게 남아 있는 익명 계정을 지웁니다 — MAU에 잡힙니다</span>
      <button class="danger sm" id="cleanupOrphans">고아 계정 정리</button>
    </div>`;
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
  ["open_reports", "처리 안 된 신고", "versus"],
  ["unclaimed_rewards", "안 받아 간 보상", "rewards"],
  ["stale_rooms", "방치된 대전 방", "versus"],
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
    : `<div class="empty">지금은 조용합니다</div>`;
  // 종은 "무엇이 몇 건"까지만 말한다. 자세히 보려면 한 페이지에 모아 둔 곳으로 보낸다.
  const more = `<div class="line" style="border-top:1px solid var(--line);margin-top:4px">
      <button class="go" data-tab="anomaly">이상 징후 모두 보기</button></div>`;
  return `<div class="bell${BELL_OPEN ? " open" : ""}">
    <button class="top" title="봐야 할 것">🔔${total
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
    지금 상태: <b>${on ? "🛠 점검 중 (앱이 잠겨 있습니다)" : "정상 — 잠긴 것 없음"}</b>
    ${sched ? `<br><span class="muted">예약: ${esc(sched)} (한국시간)</span>` : ""}
  </div>`;
}

async function saveMaintenance() {
  const on = $("#maintOn").checked;
  const message = $("#maintMsg").value.trim();
  const starts_at = $("#maintFrom").value || "";
  const ends_at = $("#maintTo").value || "";
  if (starts_at && ends_at && starts_at >= ends_at) { alert("종료가 시작보다 빠릅니다"); return; }
  // 켤 때만 묻고 끌 때는 안 물었다 — 푼 줄 알았는데 안 풀렸는지, 실수로 풀었는지
  // 알 길이 없었다(사용자 지적). 양쪽 다 묻고, 지금 상태는 위 배너로 늘 보인다.
  const was = CONFIG?.maintenance?.on === true;
  if (on && !was && !confirm("점검 모드를 켭니다.\n\n모든 앱에서 랭킹·같이하기가 잠기고 안내가 뜹니다.\n앱은 1분 안에 반영합니다.")) return;
  if (!on && was && !confirm("점검 모드를 풉니다.\n\n랭킹·같이하기가 다시 열립니다.")) return;
  await act(() => rpc("admin_set_config", {
    p_key: "maintenance", p_value: { on, message, starts_at, ends_at },
  }), refresh);
}

async function saveApiUrl() {
  const v = $("#apiUrl").value.trim();
  if (v && !/^https:\/\/[a-z0-9.-]+$/i.test(v)) {
    alert("https://호스트 형태로만 넣어 주세요 (경로·슬래시 없이)");
    return;
  }
  if (v && !confirm(
    `앱이 다음 실행부터 ${v} 로 접속합니다.\n\n` +
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
    `최소 버전을 Android ${min.android} / iOS ${min.ios}로 올립니다.\n\n` +
    `이 버전보다 낮은 앱은 즉시 사용할 수 없게 됩니다.\n` +
    `새 버전이 스토어에 이미 올라가 있는지 확인하셨나요?`)) return;

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
    ? "「장난」을 켭니다.\n\n다음 판부터 판마다 5개가 다시 뽑힙니다.\n판 시작 여유도 6초 → 8초가 됩니다(읽을 시간).\n\n방장이 방마다 따로 끌 수도 있습니다 — 그 방은 그대로 꺼진 채입니다."
    : "「장난」을 끕니다.\n\n다음 판부터 선물·안개 같은 것이 하나도 안 나옵니다.\n판 시작 여유는 8초 → 6초로 줄어듭니다.\n개별 설정과 기간은 그대로 남아, 다시 켜면 지금 상태로 돌아옵니다.")) return false;
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
    <h2>기능 스위치</h2>
    ${sw("같이하기", VS_ON, "toggleVersus",
         "앱은 켤 때 이 값을 읽습니다. 이미 실행 중인 앱은 다시 켜야 반영됩니다.")}
    ${sw("장난", EV_ON, "toggleVsEvents",
         "다음 판부터 적용됩니다. 진행 중인 판은 그대로 끝납니다. 방장이 방마다 따로 끌 수도 있습니다(068).")}
    ${EV_ON ? "" : `<div class="notice">전체가 꺼져 있어 아래 개별 설정은 지금 효과가 없습니다.
        다시 켜면 이 상태 그대로 돌아옵니다.</div>`}
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
      <thead><tr><th>닉네임</th><th class="num">오늘 획득</th><th>가입</th></tr></thead>
      <tbody>${ANOMALIES.map((a) => `<tr>
        <td>${esc(a.username || "—")}</td>
        <td class="num" style="color:var(--danger);font-weight:800">${fmt(a.earned_today)}</td>
        <td class="muted">${fmtDate(a.created_at)}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">문턱(${fmt(th)})을 넘은 계정이 없습니다</div>`;

  const audit = COIN_AUDIT.length ? `<div class="table-scroll"><table style="min-width:640px">
      <thead><tr><th>닉네임</th><th class="num">실제</th><th class="num">기대</th>
        <th class="num">차이</th><th class="num">획득</th><th class="num">소모</th></tr></thead>
      <tbody>${COIN_AUDIT.map((r) => `<tr>
        <td>${esc(r.username || "—")}</td>
        <td class="num">${fmt(r.actual)}</td>
        <td class="num">${fmt(r.expected)}</td>
        <td class="num" style="color:var(--danger);font-weight:800">+${fmt(r.gap)}</td>
        <td class="num">${fmt(r.earned)}</td>
        <td class="num">${fmt(r.spent)}</td>
      </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty">잔액이 어긋난 계정이 없습니다</div>`;

  return `
    <div class="cards">
      ${card("코인 급증", ANOMALIES.length, null)}
      ${card("잔액 불일치", COIN_AUDIT.length, null)}
      ${card("미처리 신고", openReports, "versus")}
      ${card("방치된 방", stale, "versus")}
    </div>
    <h2>오늘 코인 ${fmt(th)} 이상 획득</h2>
    <div class="muted" style="margin-bottom:6px">문턱은 운영 → 업데이트에서 바꿉니다.</div>
    ${anomalies}
    <h2>코인 잔액 대조 (054 · 막지 않고 보고만)</h2>
    <div class="muted" style="margin-bottom:6px">
      실제 잔액이 기대값보다 2,000 넘게 많은 계정입니다. 기기 시계를 돌렸거나 결제 취소가 섞였을 수 있습니다.</div>
    ${audit}`;
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
         ${short.map(([k, v]) => `${KIND[k]}이 ${v}개 이상 켜져 있어야 합니다 (지금 ${alive[k] || 0}개)`).join(" · ")}
         <br>부족하면 그 판은 장난이 다섯 개가 안 됩니다.</div>`
    : "";

  return `<h2>장난</h2>
  <div class="muted" style="font-size:12.5px;margin-bottom:8px">
    판마다 <b>이로움 2 · 해로움 2 · 중립 1</b>로 뽑습니다. 끄면 다음 판부터 빠집니다.
  </div>${warn}
  <div class="table-scroll"><table>
    <thead><tr><th>갈래</th><th>이름</th><th>설정</th><th>기간</th><th>상태</th><th>관리</th></tr></thead>
    <tbody>${VS_EVENTS.map((e) => {
      const started = !e.starts_at || new Date(e.starts_at).getTime() <= now;
      const ended = e.ends_at && new Date(e.ends_at).getTime() <= now;
      const on = e.enabled && started && !ended;
      const state = !e.enabled ? "꺼짐" : ended ? "기간 끝" : !started ? "대기" : "켜짐";
      // 목록에 없는 코드는 **DB에만 있고 앱은 모르는 사건**이다. 물음표로 눈에 띄게 둔다 —
      // 조용히 코드만 보여 주면 왜 앱에서 아무 일도 안 일어나는지 알 수 없다.
      const info = EV_INFO[e.code] || ["ev_unknown", e.code, "앱에 이 코드가 없습니다"];
      return `<tr>
        <td><span class="pill ${CLS[e.category] || ""}">${KIND[e.category] || e.category}</span></td>
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
        <td class="muted">${esc(JSON.stringify(e.config))}</td>
        <td class="muted">${when(e.starts_at)} ~ ${when(e.ends_at)}</td>
        <td>${on ? '<b style="color:var(--accent)">켜짐</b>' : `<span class="muted">${state}</span>`}</td>
        <td><div class="actions">
          <button class="ghost sm" data-evtoggle="${e.id}">${e.enabled ? "끄기" : "켜기"}</button>
          <button class="ghost sm" data-evwhen="${e.id}">기간</button>
        </div></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

function versusTab(err) {
  if (err) {
    return `<div class="notice">대전 집계 조회 실패: ${esc(err.message)}<br>
            sql/migrations/014_versus.sql을 실행했는지 확인하세요.</div>`;
  }
  const totalMatches = VS_DAILY.reduce((a, r) => a + Number(r.matches || 0), 0);
  const matchPanel = MATCH ? `
    <h2>공개 매칭 현황</h2>
    <div class="cards">
      <div class="card"><div class="label">대기 알림</div><div class="value">${fmt(MATCH.waiting_people)}</div></div>
      <div class="card"><div class="label">공개 방</div><div class="value">${fmt(MATCH.public_rooms)}</div></div>
      <div class="card"><div class="label">방치된 방</div>
        <div class="value" style="${Number(MATCH.stale_rooms) > 0 ? "color:var(--danger)" : ""}">${fmt(MATCH.stale_rooms)}</div></div>
      <div class="card"><div class="label">빈 방</div>
        <div class="value" style="${Number(MATCH.empty_rooms) > 0 ? "color:var(--danger)" : ""}">${fmt(MATCH.empty_rooms)}</div></div>
      <div class="card"><div class="label">미처리 신고</div>
        <div class="value" style="${Number(MATCH.open_reports) > 0 ? "color:var(--danger)" : ""}">${fmt(MATCH.open_reports)}</div></div>
    </div>
    <div class="toolbar">
      <button class="danger sm" id="purgeRooms">가비지 방 정리</button>
      <span class="muted">빈 방은 삭제하고, 30분 넘게 소식 없는 방은 닫습니다</span>
    </div>` : "";

  const reportsTable = REPORTS.length ? `
    <h2>신고 (${REPORTS.filter((r) => !r.handled_at).length}건 미처리)</h2>
    <div class="table-scroll"><table style="min-width:640px">
      <thead><tr><th>시각</th><th>대상</th><th>신고자</th><th>방</th><th>상태</th><th>관리</th></tr></thead>
      <tbody>${REPORTS.map((r) => `<tr>
        <td class="muted">${fmtDate(r.created_at)}</td>
        <td><b>${esc(r.target_name || "(삭제됨)")}</b></td>
        <td class="muted">${esc(r.reporter_name || "-")}</td>
        <td class="num muted">${esc(r.room_code || "-")}</td>
        <td>${r.handled_at ? '<span class="muted">처리됨</span>' : '<span class="pill heart">대기</span>'}</td>
        <td><div class="actions">
          ${r.handled_at ? "" : `
            <button class="ghost sm" data-report-ok="${r.id}">확인만</button>
            <button class="danger sm" data-report-rename="${r.id}">닉네임 강제 변경</button>`}
        </div></td>
      </tr>`).join("")}</tbody>
    </table></div>` : "";

  const roomsTable = VS_ROOMS.length ? `
    <h2>지금 열려 있는 방 (${VS_ROOMS.length})</h2>
    <div class="table-scroll"><table style="min-width:560px">
      <thead><tr><th>방</th><th>상태</th><th class="num">판</th><th class="num">인원</th>
                 <th>장난</th><th>참가자</th><th>만든 때</th><th>관리</th></tr></thead>
      <tbody>${VS_ROOMS.map((r) => `<tr>
        <td class="num"><b>${esc(r.code)}</b></td>
        <td>${r.status === "playing" ? "대전 중" : "대기"}</td>
        <td class="num">${r.round_no}/${r.win_target * 2 - 1}</td>
        <td class="num">${r.players}</td>
        <!-- 070. **꺼진 방만 눈에 띄게** 적는다 — 켜진 것이 기본이라 전부 칠하면
             무엇이 예외인지 안 보인다. 070 이전 서버는 값이 없으므로 켜진 것으로 본다. -->
        <td>${r.events_on === false
              ? `<span style="color:var(--danger)">꺼짐</span>` : `<span class="muted">켜짐</span>`}</td>
        <td class="muted">${esc(r.usernames || "")}</td>
        <td class="muted">${fmtDate(r.created_at)}</td>
        <td><button class="danger sm" data-close-room="${esc(r.code)}">닫기</button></td>
      </tr>`).join("")}</tbody>
    </table></div>` : `<h2>지금 열려 있는 방</h2><div class="empty">없습니다</div>`;
  return `
    ${VS_ON ? "" : `<div class="notice" style="border-color:var(--danger);color:var(--danger)">
        같이하기가 <b>꺼져 있습니다</b> — 설정에서 켤 수 있습니다.</div>`}
    ${matchPanel}
    ${roomsTable}
    ${reportsTable}
    <div class="cards">
      <div class="card"><div class="label">누적 판수 (30일)</div><div class="value">${fmt(totalMatches)}</div></div>
      <div class="card"><div class="label">참여 계정</div><div class="value">${fmt(VS_PLAYERS.length)}</div></div>
    </div>
    <h2>일자별 판수 · 참여자 · 무승부</h2>
    ${versusDailyChart()}
    <h2>모드별 (30일)</h2>
    ${versusModesSection()}
    <h2>판 크기별</h2>
    ${VS_BOARDS.length
      ? barChart(sumBy(VS_BOARDS, (r) => `${r.board_n}×${r.board_n}`, (r) => Number(r.matches)))
      : `<div class="empty">데이터 없음</div>`}
    <h2>계정별 전적</h2>
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
       : mode === "coop" ? "🤝2:2 협동"
       : mode === "duo"  ? "1:1"
       : mode || "—";
}

/** 051부터 일자별이 (날짜 × 모드)로 온다. 선 그래프는 날짜 단위라 다시 합친다.
 *  무승부 선을 같이 그리는 이유: 무승부가 갑자기 늘면 제한 시간이 짧다는 신호다. */
function versusDailyChart() {
  if (!VS_DAILY.length) return `<div class="empty">아직 진행된 판이 없습니다</div>`;
  const days = [...new Set(VS_DAILY.map((r) => r.day))].sort();
  const pick = (field) => days.map((d) =>
    VS_DAILY.filter((r) => r.day === d)
            .reduce((sum, r) => sum + Number(r[field] || 0), 0));
  return lineChart(days, [
    { name: "판수", color: "#17b3a8", values: pick("matches") },
    { name: "참여자", color: "#7aa2f7", values: pick("players") },
    { name: "무승부", color: "#e0af68", values: pick("draws") },
  ]);
}

/** 모드별 — "협동을 붙였는데 사람들이 하기는 하나"에 답하는 자리.
 *  이탈을 같이 보는 이유: 판수만 많고 중간에 다 나가는 모드는 재미가 아니라
 *  사람을 붙잡아 두는 시간만 쓰고 있는 것이다. */
function versusModesSection() {
  if (!VS_MODES.length) {
    return `<div class="empty">데이터 없음 (051 적용 후 채워집니다)</div>`;
  }
  const chart = barChart(VS_MODES.map((r) => ({
    bucket: modeLabel(r.mode), players: Number(r.matches),
  })));
  const table = `<div class="table-scroll"><table style="min-width:520px">
    <thead><tr>
      <th>모드</th><th class="num">판수</th><th class="num">참여자</th>
      <th class="num">무승부</th><th class="num">이탈</th><th class="num">평균 시간</th>
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
  return `<div class="table-scroll"><table style="min-width:820px">
    <thead><tr>
      <th>닉네임</th><th class="num">판수</th>
      <th class="num">승</th><th class="num">패</th><th class="num">무</th>
      <th class="num">승률</th>
      <th class="num">2등</th><th class="num">3등</th>
      <th class="num">평균 등수</th><th class="num">미완주</th>
      <th class="num">최고 기록</th><th>마지막</th>
    </tr></thead>
    <tbody>${VS_PLAYERS.map((r) => `<tr>
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
    </tr>`).join("")}</tbody></table></div>`;
}

/**
 * 누를 수 있는 표 머리글 한 칸.
 *
 * 지금 세우는 기준에는 화살표를 붙인다 — 어느 칸으로 세웠는지 머리글만 보고 알아야
 * 선택 상자를 다시 확인하지 않는다. 결제 칸은 서버가 못 세우므로 이걸 안 쓴다.
 */
function th(col, label, align) {
  const on = SORT_BY_COL[col] === SORT;
  const arrow = on ? (DESC ? " ↓" : " ↑") : "";
  return `<th data-sort="${col}" class="sortable${on ? " on" : ""}"`
       + `${align ? ` style="text-align:${align}"` : ""}>${label}${arrow}</th>`;
}

function playersTable() {
  const today = kstToday();
  const q = QUERY.trim().toLowerCase();
  // 닉네임뿐 아니라 프로필 id로도 찾는다 — 문의는 보통 id로 들어온다.
  const list = q ? PLAYERS.filter((p) =>
    (p.username || "").toLowerCase().includes(q) ||
    (p.id || "").toLowerCase().startsWith(q)) : PLAYERS;
  if (!list.length) return `<div class="empty">해당하는 회원이 없습니다</div>`;
  return `<div class="table-scroll"><table>
    <thead><tr>
      <th style="width:34px"><input type="checkbox" id="pickAll"></th>
      <th>#</th>
      ${th("username", "닉네임")}
      ${th("level", "레벨", "right")}
      ${th("total", "누적", "right")}
      ${th("daily", "오늘", "right")}
      ${th("coins", "코인", "right")}
      ${th("vs", "대전 (승-패-무)", "right")}
      ${th("coop", "협동", "right")}
      <th style="text-align:right">결제</th>
      ${th("played", "마지막 플레이")}
      ${th("created", "가입일")}
      <th title="광고성 정보 알림에 동의했고(2년 안) 기기 토큰이 서버에 있는 회원">푸시</th>
      <th>관리</th>
    </tr></thead><tbody>${list.map((p, i) => {
      const played = p.daily_date === today && (p.daily_score || 0) > 0;
      return `<tr>
        <td><input type="checkbox" data-pick="${p.id}" ${SELECTED.has(p.id) ? "checked" : ""}></td>
        <td class="num muted">${i + 1}</td>
        <td>${esc(p.username || "(이름 없음)")}
          ${p.supporter ? '<span class="pill heart">응원</span>' : ""}
          ${played ? '<span class="pill today">오늘</span>' : ""}
          ${p.reset_requested_at ? '<span class="pill heart">초기화 대기</span>' : ""}</td>
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
        <td class="num">${(() => {
          const t = PAY_TOTALS[p.id];
          return t ? `${money(t.revenue, t.currency)} <span class="muted">(${t.orders})</span>`
                   : '<span class="muted">—</span>';
        })()}</td>
        <td class="muted">${fmtDate(p.daily_date)}
          ${p.coins_at ? `<div class="muted" style="font-size:11px">접속 ${
            // daily_date와 같은 날이면 시:분만, 다른 날이면 날짜까지 적는다.
            fmtDate(p.coins_at) === fmtDate(p.daily_date) ? fmtTime(p.coins_at)
                                                          : fmtDateTime(p.coins_at)}</div>` : ""}</td>
        <td class="muted">${fmtDateTime(p.created_at)}</td>
        <td>${REACH === null ? '<span class="muted" title="받을 수 있는 회원 목록을 못 읽었습니다">?</span>'
          : REACH[p.id] ? `<span class="pill today" title="동의 ${esc(fmtDate(REACH[p.id].consented_at))} · 기기 ${REACH[p.id].devices}대">받음</span>`
                          : '<span class="muted" title="광고성 알림을 안 켰거나, 동의한 지 2년이 지났거나, 기기 토큰이 없습니다">—</span>'}</td>
        <td><div class="actions">
          <button class="ghost sm" data-act="name" data-id="${p.id}">닉네임</button>
          <button class="ghost sm" data-act="score" data-id="${p.id}">점수</button>
          <button class="ghost sm" data-act="heart" data-id="${p.id}">응원</button>
          <button class="ghost sm" data-act="gift" data-id="${p.id}">보상</button>
          <button class="ghost sm" data-act="zero" data-id="${p.id}">점수0</button>
          <button class="ghost sm" data-act="wipe" data-id="${p.id}">진행초기화</button>
          <button class="ghost sm" data-act="log" data-id="${p.id}">${OPEN_MEMBER === p.id ? "접기" : "이력"}</button>
          <button class="danger sm" data-act="del" data-id="${p.id}">삭제</button>
        </div></td>
      </tr>` + (OPEN_MEMBER === p.id ? memberEventsRow() : "");
    }).join("")}</tbody></table></div>` + playersPaging();
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
      <span class="muted">${PLAYER_PAGE + 1} / ${pages} 쪽 (${fmt(PLAYER_TOTAL)}명)</span>
      <button class="sm" id="playerNext" ${PLAYER_PAGE + 1 >= pages ? "disabled" : ""}>다음</button>
    </div>`;
}

/** 회원 한 명의 최근 행동. 문의가 들어왔을 때 확인할 최소한의 창구다. */
function memberEventsRow() {
  const pays = MEMBER_PAYS.length
    ? `<div class="muted" style="font-size:12px;margin:2px 0 6px">구매 내역</div>
       <div class="table-scroll" style="margin-bottom:10px">
         <table style="min-width:380px"><tbody>${MEMBER_PAYS.map((p) => `<tr>
           <td class="muted">${new Date(p.created_at).toLocaleString("ko-KR")}</td>
           <td>${esc(p.product_id)}</td>
           <td class="num">${p.coins ? fmt(p.coins) : "—"}</td>
           <td class="num">${money(p.amount, p.currency)}</td>
           <td class="muted">${esc(p.store)}</td>
         </tr>`).join("")}</tbody></table></div>`
    : "";
  const inner = pays + (MEMBER_EVENTS.length
    ? `<div class="table-scroll" style="max-height:260px;overflow-y:auto">
         <table style="min-width:380px"><tbody>${MEMBER_EVENTS.map((e) => `<tr>
           <td class="muted">${new Date(e.created_at).toLocaleString("ko-KR")}</td>
           <td>${esc(e.name)}</td>
           <td class="num">${e.value ?? ""}</td>
           <td class="muted">${esc(e.platform || "")}</td>
         </tr>`).join("")}</tbody></table></div>`
    : `<div class="muted" style="font-size:12.5px">기록된 이벤트가 없습니다</div>`);
  return `<tr><td colspan="10" style="white-space:normal">${inner}</td></tr>`;
}

function eventsTable(err) {
  if (err) return `<div class="notice">이벤트 조회 실패: ${esc(err.message)}<br>supabase_admin_features.sql을 실행했는지 확인하세요.</div>`;
  if (!EVENTS.length) return `<div class="empty">아직 쌓인 이벤트가 없습니다. 앱에 계측을 넣으면 여기에 나타납니다.</div>`;
  const byDay = {};
  for (const e of EVENTS) (byDay[e.day] ??= []).push(e);
  return Object.entries(byDay).map(([day, list]) => `
    <h2>${day}</h2>
    <div class="table-scroll"><table style="min-width:420px">
      <thead><tr><th>이벤트</th><th style="text-align:right">횟수</th><th style="text-align:right">사람</th></tr></thead>
      <tbody>${list.map((e) => `<tr>
        <td>${esc(e.name)}</td><td class="num">${fmt(e.count)}</td><td class="num">${fmt(e.users)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`).join("");
}

function auditTable(err) {
  // 조회 실패를 "기록 없음"으로 보여주면 원인을 영영 못 찾는다.
  if (err) return `<div class="notice">관리 기록 조회 실패: ${esc(err.message)}<br>
    supabase_admin_features.sql이 끝까지 실행됐는지 확인하세요
    (admin_actions 테이블과 읽기 정책이 필요합니다).</div>`;
  if (!AUDIT.length) return `<div class="empty">기록된 관리 작업이 없습니다</div>`;
  // 작업 종류·대상으로 거른다. 100건 나열에서 원하는 한 건을 찾는 게 일이었다.
  const kinds = [...new Set(AUDIT.map((a) => a.action))].sort();
  const rows = AUDIT.filter((a) =>
    (!AUDIT_KIND || a.action === AUDIT_KIND) &&
    (!AUDIT_Q || (a.target_id || "").startsWith(AUDIT_Q) ||
      JSON.stringify(a.detail || {}).toLowerCase().includes(AUDIT_Q.toLowerCase())));
  return `<div class="toolbar">
    <select id="auditKind">
      <option value="">모든 작업</option>
      ${kinds.map((k) => `<option value="${esc(k)}" ${k === AUDIT_KIND ? "selected" : ""}>${esc(k)}</option>`).join("")}
    </select>
    <input type="search" id="auditQ" placeholder="대상 id·내용 검색" value="${esc(AUDIT_Q)}">
    <span class="muted">${rows.length} / ${AUDIT.length}건</span>
  </div>
  <div class="table-scroll"><table>
    <thead><tr><th>시각</th><th>작업</th><th>대상</th><th>내용</th></tr></thead>
    <tbody>${rows.map((a) => `<tr>
      <td class="muted">${new Date(a.created_at).toLocaleString("ko-KR")}</td>
      <td>${esc(a.action)}</td>
      <td class="muted">${esc((a.target_id || "").slice(0, 8))}</td>
      <td class="muted" style="white-space:normal;max-width:520px">${esc(JSON.stringify(a.detail))}</td>
    </tr>`).join("")}</tbody></table></div>`;
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
  if (revoked) return { key: "revoked", label: "회수됨", cls: "heart" };
  if (left === 0) return { key: "allDone", label: "전원 수령", cls: "" };
  if (expired) return { key: "expired", label: "만료", cls: "heart" };
  if (!started) return { key: "notYet", label: "대기", cls: "today" };
  return { key: "live", label: "진행 중", cls: "today" };
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
    b.autos && `${appIcon("dog_01", 16, "저절로 놓기")} ${fmt(b.autos)}`,
  ].filter(Boolean);
  return parts.length
    ? `<span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap">${parts.join("")}</span>`
    : '<span class="muted">—</span>';
}

function batchesTable(shown) {
  if (!shown.length) return "";
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");
  return `<h2>전체 지급 묶음</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>등록</th><th>내용</th><th>메모</th><th>받을 수 있는 기간</th>
      <th>상태</th><th style="text-align:right">수령</th><th>관리</th></tr></thead>
    <tbody>${shown.map(({ b, st }) => {
      const rows = `<tr>
        <td class="muted">${when(b.created_at)}</td>
        <td>${rewardCells(b)}</td>
        <td class="muted">${esc(b.memo || "")}</td>
        <td class="muted">${when(b.starts_at)} ~ ${when(b.expires_at)}</td>
        <td><span class="pill ${st.cls}">${st.label}</span>${
          st.key === "revoked" && b.revoked_at
            ? `<div class="muted" style="font-size:11px;margin-top:3px">${when(b.revoked_at)}${
                b.revoked_count != null ? ` · ${fmt(b.revoked_count)}건` : ""}</div>`
            : ""}</td>
        <td class="num">${fmt(b.claimed_count)} / ${fmt(b.target_count)}</td>
        <td><div class="actions">
          <button class="ghost sm" data-batch="${b.id}">${OPEN_BATCH === b.id ? "접기" : "명단"}</button>
          ${Number(b.pending_count) > 0 ? `<button class="danger sm" data-revoke="${b.id}">회수</button>` : ""}
        </div></td>
      </tr>`;
      if (OPEN_BATCH !== b.id) return rows;
      const members = BATCH_MEMBERS.length
        ? BATCH_MEMBERS.map((m) => `<span class="mem ${m.claimed_at ? "got" : ""}">${esc(m.username || "—")}</span>`).join("")
        : '<span class="muted">명단 없음</span>';
      return rows + `<tr><td colspan="7" style="white-space:normal">
        <div class="muted" style="font-size:12px;margin-bottom:6px">
          진한 표시가 받아 간 사람입니다</div>${members}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

/**
 * 개별 지급 한 건의 상태. 묶음과 같은 말을 쓴다 — 같은 화면에서 다른 낱말을 쓰면
 * 두 표가 다른 것을 재는 것처럼 읽힌다.
 */
function rewardState(r, now) {
  if (r.claimed_at) return { key: "claimed", label: "받아감", cls: "" };
  if (r.expires_at && new Date(r.expires_at).getTime() <= now) return { key: "expired", label: "만료", cls: "heart" };
  if (r.starts_at && new Date(r.starts_at).getTime() > now) return { key: "notYet", label: "대기", cls: "today" };
  return { key: "live", label: "안 받아감", cls: "today" };
}

function rewardsRows(shown) {
  if (!shown.length) return "";
  return `<h2>개별 지급</h2><div class="table-scroll"><table>
    <thead><tr><th>시각</th><th>대상</th><th style="text-align:right">코인</th>
      <th style="text-align:right">힌트</th><th style="text-align:right">자동</th>
      <th>메모</th><th>상태</th></tr></thead>
    <tbody>${shown.map(({ r, st }) => {
      const who = PLAYERS.find((p) => p.id === r.profile_id);
      return `<tr>
        <td class="muted">${new Date(r.created_at).toLocaleString("ko-KR")}</td>
        <td>${esc(who?.username || (r.profile_id || "").slice(0, 8))}</td>
        <td class="num">${fmt(r.coins)}</td><td class="num">${fmt(r.hints)}</td><td class="num">${fmt(r.autos)}</td>
        <td class="muted">${esc(r.memo || "")}</td>
        <td><span class="pill ${st.cls}">${st.label}</span>${
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

  if (!marked.length && !singles.length) return `<div class="empty">지급한 보상이 없습니다</div>`;

  const live = BATCH_VIEW === "live";
  // 탭 하나로 두 표를 같이 거른다 — 표마다 탭을 두면 어느 쪽을 보고 있는지 헷갈린다.
  const tabs = `<div class="subtabs">
    <button class="${live ? "on" : ""}" data-bview="live">진행 중 <b>${fmt(liveB.length + liveS.length)}</b></button>
    <button class="${!live ? "on" : ""}" data-bview="done">지난 것 <b>${fmt(doneB.length + doneS.length)}</b></button>
  </div>`;

  const body = batchesTable(live ? liveB : doneB) + rewardsRows(live ? liveS : doneS);
  return tabs + (body || `<div class="empty">${
    live ? "진행 중인 지급이 없습니다" : "지난 지급이 없습니다"}</div>`);
}

// ------------------------------------------------------------------ 화면
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
      <h1>🐾 DogPuzzle 관리자</h1>
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
      <div class="card"><div class="label">오늘 플레이</div><div class="value">${fmt(S.today_players)}</div></div>
      <div class="card"><div class="label">오늘 최고점</div><div class="value">${Number(S.today_players) > 0 ? fmt(S.today_best) : "—"}</div></div>
      <div class="card"><div class="label">누적 최고점</div><div class="value">${Number(S.members) > 0 ? fmt(S.total_best) : "—"}</div></div>
      <div class="card"><div class="label">응원해 주신 분</div><div class="value">${fmt(S.supporters)}</div></div>
      <div class="card"><div class="label">미수령 보상</div><div class="value">${fmt(S.unclaimed_rewards)}</div></div>
    </div>

    ${TAB === "players" ? `
      <div class="toolbar">
        <input type="search" id="q" placeholder="닉네임 또는 id 검색" value="${esc(QUERY)}">
        ${PLAYER_FILTER ? `<span class="pill today" title="차트에서 누른 조건입니다">${esc(PLAYER_FILTER.label)}</span>
          <button class="ghost sm" id="clearFilter">조건 해제</button>` : ""}
        <select id="sort">
          <option value="total">누적 점수순</option>
          <option value="level">레벨 높은순</option>
          <option value="daily">오늘 점수순</option>
          <option value="coins">코인 많은순</option>
          <option value="vs_wins">대전 승수순</option>
          <option value="coop_wins">협동 승수순</option>
          <option value="played">마지막 플레이순</option>
          <option value="created">가입 최신순</option>
          <option value="username">닉네임순</option>
        </select>
        <button class="sm" id="sortDir" title="오름차순과 내림차순을 바꿉니다">${DESC ? "내림차순 ↓" : "오름차순 ↑"}</button>
        <span class="muted" style="font-size:12.5px">기준 ${today} (한국시간)</span>
        <div style="flex:1"></div>
        <button class="sm" id="grantAll">전체 보상 지급</button>
        <button class="sm" id="pushSelected" title="체크한 회원에게 푸시 발송 창을 엽니다">선택 회원에게 푸시${SELECTED.size ? ` (${SELECTED.size})` : ""}</button>
        <button class="danger sm" id="delSelected">선택 삭제${SELECTED.size ? ` (${SELECTED.size})` : ""}</button>
        <button class="danger sm" id="resetAll">전체 점수 초기화</button>
        <button class="danger sm" id="resetAllGames">전체 게임 초기화</button>
        <button class="ghost sm" id="cancelResets">초기화 요청 취소</button>
      </div>
      <div id="ptable">${playersTable()}</div>` : ""}
    ${TAB === "charts" ? chartsTab(statsErr) : ""}
    ${TAB === "ranking" ? rankingTab(rkErr) : ""}
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

  $("#refresh").onclick = refresh;
  bindBell();
  const orphan = $("#cleanupOrphans");
  if (orphan) orphan.onclick = async () => {
    if (!confirm("프로필 없이 24시간 넘게 남아 있는 익명 계정을 지웁니다.\n\n되돌릴 수 없습니다.")) return;
    await act(async () => {
      const n = await rpc("admin_cleanup_orphan_users", { p_older_than_hours: 24 });
      alert(`${n}개 계정을 정리했습니다`);
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
        if (!confirm("빈 방을 삭제하고, 30분 넘게 소식 없는 방을 닫습니다.\n\n진행 중인 방은 건드리지 않습니다.")) return;
        await act(async () => {
          const n = await rpc("admin_purge_stale_rooms", { p_minutes: 30 });
          alert(`${n}개를 정리했습니다`);
        }, refresh);
      };
    }
    document.querySelectorAll("[data-report-ok]").forEach((b) => {
      b.onclick = async () => {
        const note = askReason("신고 확인 처리");
        if (note === null) return;
        await act(() => rpc("admin_resolve_report", {
          p_id: Number(b.dataset.reportOk), p_note: note, p_rename: false,
        }), refresh);
      };
    });
    document.querySelectorAll("[data-report-rename]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("이 회원의 닉네임을 임의값으로 바꿉니다.\n\n본인은 무료로 다시 정할 수 있습니다.")) return;
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
  }

  if (TAB === "server") {
    if ($("#winnerDays")) {
      $("#winnerDays").onchange = async (e) => {
        WINNER_DAYS = Number(e.target.value) || 14;
        await loadServer();
        render(warn, eventsErr);
      };
    }
    if ($("#saveTiers")) $("#saveTiers").onclick = saveRankRewards;
    if ($("#tierAdd")) {
      $("#tierAdd").onclick = () => {
        const tiers = Array.isArray(CONFIG?.rank_rewards?.tiers)
          ? [...CONFIG.rank_rewards.tiers] : [];
        const last = tiers.length ? Number(tiers[tiers.length - 1].to) || 0 : 0;
        tiers.push({ to: last + 1, coins: 0, hints: 0, autos: 0 });
        CONFIG = { ...CONFIG, rank_rewards: { tiers } };
        render(warn, eventsErr);
      };
    }
    document.querySelectorAll("[data-tier-del]").forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.tierDel);
        const tiers = (CONFIG?.rank_rewards?.tiers || []).filter((_, k) => k !== i);
        CONFIG = { ...CONFIG, rank_rewards: { tiers } };
        render(warn, eventsErr);
      };
    });
  }

  if (TAB === "update" && $("#saveVersions")) {
    $("#saveVersions").onclick = saveVersions;
    if ($("#saveMaint")) $("#saveMaint").onclick = saveMaintenance;
    if ($("#saveMaintSched")) $("#saveMaintSched").onclick = saveMaintenance;
    if ($("#saveAnomaly")) $("#saveAnomaly").onclick = saveAnomalyThreshold;
    if ($("#saveApiUrl")) $("#saveApiUrl").onclick = saveApiUrl;
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
  }
}

/** 체크박스 배선. 선택은 SELECTED에 모으고, 헤더 체크는 지금 화면에 보이는 것만 다룬다 —
 *  검색으로 걸러 놓고 전체 선택을 눌렀는데 안 보이는 사람까지 잡히면 사고가 난다. */
function updatePickButtons() {
  const n = SELECTED.size ? ` (${SELECTED.size})` : "";
  if ($("#delSelected")) $("#delSelected").textContent = `선택 삭제${n}`;
  if ($("#pushSelected")) $("#pushSelected").textContent = `선택 회원에게 푸시${n}`;
}

function bindPicks() {
  const boxes = [...document.querySelectorAll("[data-pick]")];
  boxes.forEach((b) => {
    b.onchange = () => {
      if (b.checked) SELECTED.add(b.dataset.pick);
      else SELECTED.delete(b.dataset.pick);
      updatePickButtons();
      const all = $("#pickAll");
      if (all) all.checked = boxes.length > 0 && boxes.every((x) => x.checked);
    };
  });
  const all = $("#pickAll");
  if (all) {
    all.checked = boxes.length > 0 && boxes.every((x) => x.checked);
    all.onchange = () => {
      boxes.forEach((b) => {
        b.checked = all.checked;
        if (all.checked) SELECTED.add(b.dataset.pick);
        else SELECTED.delete(b.dataset.pick);
      });
      updatePickButtons();
    };
  }
}

function bindRowActions() {
  const handlers = {
    name: editName, score: editScores, heart: toggleSupporter, gift: openGrant,
    zero: resetScores, wipe: requestGameReset, del: removePlayer, log: toggleMember,
  };
  document.querySelectorAll("[data-act]").forEach((b) => {
    b.onclick = () => handlers[b.dataset.act](b.dataset.id);
  });
}

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
  const serr = TAB === "charts" ? await loadStats() : null;
  const nerr = TAB === "notices" ? await loadNotices() : null;
  const perr2 = TAB === "purchases" ? await loadPurchases() : null;
  if (TAB === "players") await loadPayTotals();
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
  const rkerr = TAB === "ranking" ? await loadRanking() : null;
  const pusherr = TAB === "push" ? await loadPush() : null;
  // 알림은 **새로고침할 때만** 가져온다(사용자 지시) — 따로 도는 타이머는 두지 않는다.
  await loadAlerts();

  let warn = "";
  if (perr) warn = "회원 조회 실패: " + perr.message;
  else if (sumErr) warn = "요약 조회 실패: " + sumErr.message + " (092_admin_summary.sql을 실행했는지 확인하세요)";
  else if (!SUMMARY) {
    // 관리자가 아니면 서버가 null을 돌려준다.
    warn = "조회 결과가 비어 있습니다. 이 계정이 admins 테이블에 등록됐는지 확인하세요 " +
           "(supabase_admin_access.sql 4번 항목).";
  }
  render(warn, eerr, serr, nerr, perr2, aerr, vserr, cfgerr, sverr, pusherr, rkerr);
}

boot();
