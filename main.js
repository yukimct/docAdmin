// 관리자 화면 — 회원·점수 관리 / 이벤트 집계 / 보상 지급.
import { sb, $, fmt, fmtDate, esc, kstToday, askReason, rpc } from "./app.js";

/** 처음 열었을 때 보이는 탭. 차트다(사용자 지시) — 관리자가 가장 자주 확인하는 건
 *  개별 회원이 아니라 "어제 오늘 뭐가 달라졌나"이기 때문이다. */
let TAB = "charts";
let PLAYERS = [], EVENTS = [], AUDIT = [], REWARDS = [], BATCHES = [], STATS = [], BUCKETS = [];
let FUNNEL = [], RETENTION = [], NOTICES = [];
let PAY_DAILY = [], PAY_MONTHLY = [], PAY_PRODUCT = [], PAY_LEDGER = [], COIN_SINKS = [];
/** 같이하기(대전) — 일자별/계정별/판 크기별 집계와 기능 스위치. */
let VS_DAILY = [], VS_PLAYERS = [], VS_BOARDS = [], VS_MODES = [], VS_ON = false;
/** 지금 살아 있는 대전 방 목록. */
let VS_ROOMS = [];
/** 공개 매칭 — 현황 한 줄과 신고 목록. */
let MATCH = null, REPORTS = [];
/** 경제 건강 요약 한 줄과 오늘 코인 이상 획득 계정. */
let ECON = null, ANOMALIES = [];
/** 앱 설정값 전체 (key → value). 업데이트 관문·기능 스위치가 여기 들어 있다. */
let CONFIG = {};
/** 회원 id → {orders, revenue, currency}. 회원 목록 옆에 붙여 쓴다. */
let PAY_TOTALS = {};
/** 이벤트 이력을 펼쳐 놓은 회원. */
let OPEN_MEMBER = null, MEMBER_EVENTS = [], MEMBER_PAYS = [];
let SORT = "total", QUERY = "", EMAIL = "";
/** 다중 삭제용 선택 목록. 검색어를 바꿔도 선택은 유지된다 — 여러 번 걸러 가며
 *  고르는 게 자연스럽고, 안 보이는 걸 지우는 사고는 삭제 직전 명단 확인으로 막는다. */
let SELECTED = new Set();
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
  const serverSorts = ["total", "daily", "coins", "vs_wins", "coop_wins", "created", "username"];
  if (serverSorts.includes(SORT)) {
    const rows = await rpc("admin_players_ranked", { p_sort: SORT, p_limit: 500 })
                   .catch(() => null);
    if (rows) { PLAYERS = rows; return null; }
  }
  // 되돌아가는 길 — 옛 정렬 이름을 profiles 칸 이름으로 옮긴다.
  const col = SORT === "daily" ? "daily_score"
            : SORT === "created" ? "created_at"
            : SORT === "username" ? "username" : "total_score";
  const { data, error } = await sb.from("profiles").select("*")
    .order(col, { ascending: col === "username" }).limit(500);
  PLAYERS = data || [];
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
    FUNNEL = await rpc("admin_level_funnel", { p_max: 30 }) || [];
    RETENTION = await rpc("admin_retention", { p_days: 21 }) || [];
    // 기간을 30일로 맞춘다. 이 카드만 14일이라 바로 아래 30일 그래프와 숫자가 안 맞았다 —
    // 같은 화면에서 같은 주제를 다른 창으로 보여 주면 매번 어느 쪽 기간인지 되짚어야 한다.
    ECON = (await rpc("admin_economy_health", { p_days: 30 }).catch(() => []))[0] || null;
    // 코인 소모처는 **구매 탭에 있었다.** 구매는 실제 결제(IAP) 이야기고 코인 소모는
    // 게임 안 경제라 주제가 다르다. 경제를 한자리에 모으려고 이쪽으로 옮겼다.
    COIN_SINKS = await rpc("admin_coin_sinks", { p_days: 30 }).catch(() => []) || [];
    return null;
  } catch (e) { STATS = []; BUCKETS = []; FUNNEL = []; RETENTION = []; return e; }
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

// ------------------------------------------------------------------ 차트
// 라이브러리를 쓰지 않는다. 필요한 건 시계열 두어 개와 막대 하나뿐이고,
// 외부 스크립트를 붙이면 그쪽이 죽는 날 관리자 페이지가 통째로 안 열린다.

/** 여러 계열을 겹쳐 그리는 선 그래프. series = [{name, color, values:[n]}] */
function lineChart(labels, series, height = 160) {
  const W = 720, H = height, PAD = { l: 44, r: 12, t: 12, b: 22 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i) => PAD.l + (labels.length < 2 ? iw / 2 : (i * iw) / (labels.length - 1));
  const y = (v) => PAD.t + ih - (v / max) * ih;

  const grid = [0, 0.5, 1].map((f) => {
    const gy = PAD.t + ih - f * ih;
    return `<line x1="${PAD.l}" y1="${gy}" x2="${W - PAD.r}" y2="${gy}" class="gl"/>
            <text x="${PAD.l - 6}" y="${gy + 4}" class="ax" text-anchor="end">${fmt(Math.round(max * f))}</text>`;
  }).join("");

  const paths = series.map((s) => {
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const last = s.values.length - 1;
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"
                  stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="${x(last).toFixed(1)}" cy="${y(s.values[last] || 0).toFixed(1)}" r="3" fill="${s.color}"/>`;
  }).join("");

  const ticks = labels.map((d, i) =>
    (i === 0 || i === labels.length - 1 || i === Math.floor(labels.length / 2))
      ? `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${esc(d.slice(5))}</text>` : "").join("");

  const legend = series.map((s) =>
    `<span class="lg"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("");

  return `<div class="chart">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${grid}${paths}${ticks}</svg>
    <div class="legend">${legend}</div>
  </div>`;
}

/** 가로 막대 — 구간별 인원처럼 항목이 몇 개 안 될 때. */
function barChart(rows) {
  const max = Math.max(1, ...rows.map((r) => r.players));
  return `<div class="bars">${rows.map((r) => `
    <div class="bar-row">
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
  const avg = (arr, k) => (arr.length
    ? Math.round(arr.reduce((a, r) => a + num(r, k), 0) / arr.length) : 0);
  const w1 = STATS.slice(-7), w0 = STATS.slice(-14, -7);

  // D1 리텐션은 **어제 가입한 사람은 아직 하루가 안 지났다.** 그래서 마지막 줄이 아니라
  // 하루 건너뛴 줄을 본다 — 안 그러면 늘 0%에 가깝게 나온다.
  const rt = RETENTION.filter((r) => Number(r.cohort) > 0);
  const rtRow = rt.length > 1 ? rt[rt.length - 2] : rt[rt.length - 1];
  const d1 = rtRow && Number(rtRow.cohort)
    ? Math.round((Number(rtRow.d1) / Number(rtRow.cohort)) * 100) : null;

  const cards = [
    ["오늘 접속자", fmt(num(last, "active")), delta(num(last, "active"), num(prev, "active"))],
    ["오늘 신규", fmt(num(last, "signups")), delta(num(last, "signups"), num(prev, "signups"))],
    ["7일 평균 접속", fmt(avg(w1, "active")), delta(avg(w1, "active"), avg(w0, "active"))],
    ["D1 리텐션", d1 == null ? "—" : d1 + "%", ""],
    ["코인 순증 (오늘)", fmt(num(last, "coin_earned") - num(last, "coin_spent")),
     delta(num(last, "coin_earned") - num(last, "coin_spent"),
           num(prev, "coin_earned") - num(prev, "coin_spent"))],
    ["소모/발행", ECON ? String(ECON.sink_ratio) : "—", ""],
  ];
  return `<div class="cards">${cards.map(([label, value, d]) => `
    <div class="card"><div class="label">${label}</div>
      <div class="value">${value} ${d}</div></div>`).join("")}</div>`;
}

/** 어제(또는 지난주) 대비. 0에서 늘어난 건 비율로 말할 수 없어 숫자만 적는다. */
function delta(now, before) {
  if (before === 0) return now === 0 ? "" : `<span class="dl">+${fmt(now)}</span>`;
  const diff = now - before;
  if (diff === 0) return "";
  const pct = Math.round((diff / Math.abs(before)) * 100);
  // 방향은 화살표가 말한다. 색까지 쓰지 않는 이유는 CSS 주석에 적어 뒀다.
  return `<span class="dl">${diff > 0 ? "▲" : "▼"}${Math.abs(pct)}%</span>`;
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
        <div class="value" style="${Number(ECON.sink_ratio) < 0.35 ? "color:var(--danger)" : ""}">${ECON.sink_ratio}</div></div>
    </div>
    ${Number(ECON.sink_ratio) < 0.35 ? `<div class="notice">소모/발행이 0.35 아래입니다 —
      코인이 쌓이기만 하고 있습니다. 상점 가격이나 판당 지급을 볼 때입니다.</div>` : ""}` : ""}
    <h3 class="sub">코인 획득 · 소모</h3>
    ${lineChart(days, [
      { name: "획득", color: "#d9a441", values: STATS.map((r) => Number(r.coin_earned)) },
      { name: "소모", color: "#d95757", values: STATS.map((r) => Number(r.coin_spent)) },
    ])}
    <h3 class="sub">코인을 어디에 썼나</h3>
    ${COIN_SINKS.length
      ? barChart(COIN_SINKS.map((r) => ({ bucket: r.sink, players: Number(r.spent) })))
      : `<div class="empty">아직 소모 기록이 없습니다</div>`}

    <h2>진행</h2>
    <h3 class="sub">레벨별 도달 인원 — 어디서 그만두는지</h3>
    ${FUNNEL.length
      ? lineChart(FUNNEL.map((r) => String(r.level).padStart(5, "0")),
                  [{ name: "도달 인원", color: "#17b3a8", values: FUNNEL.map((r) => Number(r.players)) }])
      : `<div class="empty">레벨 클리어 기록이 아직 없습니다</div>`}
    <h3 class="sub">누적 점수 분포</h3>
    ${BUCKETS.length ? barChart(BUCKETS) : `<div class="empty">데이터 없음</div>`}`;
}

function retentionTable() {
  if (!RETENTION.length) return `<div class="empty">아직 계산할 가입 기록이 없습니다</div>`;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) + "%" : "—");
  return `<div class="table-scroll"><table style="min-width:460px">
    <thead><tr><th>가입일</th><th style="text-align:right">인원</th>
      <th style="text-align:right">다음 날</th><th style="text-align:right">7일째</th></tr></thead>
    <tbody>${RETENTION.map((r) => `<tr>
      <td class="muted">${fmtDate(r.cohort_date)}</td>
      <td class="num">${fmt(r.cohort)}</td>
      <td class="num">${pct(Number(r.d1), Number(r.cohort))}
        <span class="muted">(${fmt(r.d1)})</span></td>
      <td class="num">${pct(Number(r.d7), Number(r.cohort))}
        <span class="muted">(${fmt(r.d7)})</span></td>
    </tr>`).join("")}</tbody></table></div>
    <p class="muted" style="font-size:12px">표본이 적은 날은 비율이 크게 튑니다 — 인원수를 같이 보세요.</p>`;
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
  const n = PLAYERS.length;
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
  const waiting = PLAYERS.filter((p) => p.reset_requested_at).length;
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

/** id가 null이면 전체 지급. 기간을 비워 두면 제한 없이 받을 수 있다. */
function openGrant(id) {
  const p = id ? findPlayer(id) : null;
  const dlg = $("#grantDlg");
  $("#grantTitle").textContent = id ? "보상 지급" : "전체 보상 지급";
  $("#grantWho").textContent = id
    ? `${p.username} 에게 지급합니다. 앱 접속 시 자동으로 받아갑니다.`
    : `전체 회원 ${PLAYERS.length}명에게 지급합니다. 각자 앱을 켤 때 받아갑니다.`;
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
    await loadConfig();
    VS_ON = CONFIG.versus_enabled === true;
    return null;
  } catch (e) { return e; }
}

async function loadConfig() {
  const { data, error } = await sb.from("app_config").select("*");
  if (error) throw new Error(error.message);
  CONFIG = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
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
      <input type="text" id="maintMsg" placeholder="안내 문구 (비우면 기본 문구)"
             value="${esc(CONFIG?.maintenance?.message || "")}" style="flex:1">
      <button class="sm" id="saveMaint">저장</button>
    </div>
    <div class="toolbar">
      <span class="muted">예약(한국시간, 비우면 예약 없음)</span>
      <input type="datetime-local" id="maintFrom" value="${esc(CONFIG?.maintenance?.starts_at || "")}">
      <span class="muted">~</span>
      <input type="datetime-local" id="maintTo" value="${esc(CONFIG?.maintenance?.ends_at || "")}">
    </div>
    <div class="muted" style="margin-top:-6px;font-size:12px">
      예약이 있으면 그 시간 동안 앱이 스스로 점검 상태가 됩니다. 스위치를 켤 필요가 없습니다.
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
  { id: "versus", label: "같이하기" },
  { label: "회원", items: [["players", "회원 목록"], ["rewards", "보상"]] },
  { label: "기록", items: [["events", "이벤트"], ["purchases", "구매"], ["audit", "관리 기록"]] },
  { label: "운영", items: [["update", "업데이트"], ["notices", "공지"], ["server", "서버 상태"]] },
];

let SRV = null, WINNERS = [], TRANSFERS = [], COIN_AUDIT = [];

/** 052·054가 있어야 채워진다. 없는 서버에서는 조용히 빈 값으로 두고 안내만 띄운다 —
 *  관리자 페이지는 서버보다 먼저 배포될 수 있다. */
async function loadServer() {
  try {
    SRV = (await rpc("admin_server_status").catch(() => []))[0] || null;
    WINNERS = await rpc("admin_daily_winners", { p_days: 14 }).catch(() => []) || [];
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

  const winners = WINNERS.length ? `<div class="table-scroll"><table style="min-width:420px">
      <thead><tr><th>날짜</th><th>등수</th><th>닉네임</th><th>수령</th></tr></thead>
      <tbody>${WINNERS.map((w) => `<tr>
        <td class="muted">${fmtDate(w.award_date)}</td>
        <td>${w.rank === 1 ? "🥇" : w.rank === 2 ? "🥈" : "🥉"}</td>
        <td>${esc(w.username || "— (탈퇴)")}</td>
        <td>${w.claimed ? '<span class="muted">받아 감</span>'
                        : '<span class="pill today">대기</span>'}</td>
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

    <h2>코인 잔액 대조 — 이상치</h2>
    <div class="notice">
      앱이 올린 잔액과 <b>events로 계산한 잔액</b>을 맞대어 봅니다. 차이가 크게 양수면
      이벤트 없이 코인이 생긴 것입니다. <b>막지는 않습니다</b> — 오프라인에서 쓰고 늦게
      올라오거나 기기 이전 직후에도 차이가 날 수 있어, 판단은 사람이 합니다.
      events는 90일만 보관하므로 <b>가입이 오래된 계정일수록 차이가 크게 나옵니다.</b>
    </div>
    ${audit}

    <h2>어제의 랭킹 보상 (최근 14일)</h2>
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
  ["coin_gap_players", "잔액이 안 맞는 계정", "server"],
  ["open_reports", "처리 안 된 신고", "versus"],
  ["unclaimed_rewards", "안 받아 간 보상", "rewards"],
  ["stale_rooms", "방치된 대전 방", "versus"],
];

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
  return `<div class="bell" tabindex="0">
    <button class="top" title="봐야 할 것">🔔${total
      ? `<span class="pill heart" style="margin-left:4px">${fmt(total)}</span>` : ""}</button>
    <div class="menu">${list}</div>
  </div>`;
}

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

/** 대전 기능을 켜고 끈다. 끄면 앱 대기화면에서 버튼이 사라진다. */
async function toggleVersus() {
  const next = !VS_ON;
  if (!confirm(next
    ? "같이하기를 켭니다.\n\n앱 대기화면에 버튼이 나타납니다."
    : "같이하기를 끕니다.\n\n앱에서 버튼이 사라집니다. 이미 진행 중인 방은 그대로 끝납니다.")) return;
  await act(() => rpc("admin_set_config", { p_key: "versus_enabled", p_value: next }), refresh);
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
                 <th>참가자</th><th>만든 때</th><th>관리</th></tr></thead>
      <tbody>${VS_ROOMS.map((r) => `<tr>
        <td class="num"><b>${esc(r.code)}</b></td>
        <td>${r.status === "playing" ? "대전 중" : "대기"}</td>
        <td class="num">${r.round_no}/${r.win_target * 2 - 1}</td>
        <td class="num">${r.players}</td>
        <td class="muted">${esc(r.usernames || "")}</td>
        <td class="muted">${fmtDate(r.created_at)}</td>
        <td><button class="danger sm" data-close-room="${esc(r.code)}">닫기</button></td>
      </tr>`).join("")}</tbody>
    </table></div>` : `<h2>지금 열려 있는 방</h2><div class="empty">없습니다</div>`;
  return `
    <div class="toolbar">
      <span>같이하기 기능</span>
      <b style="color:${VS_ON ? "var(--accent)" : "var(--dim)"}">${VS_ON ? "켜짐" : "꺼짐"}</b>
      <button class="sm" id="toggleVersus">${VS_ON ? "끄기" : "켜기"}</button>
      <span class="muted" style="font-size:12.5px">
        앱은 켤 때 이 값을 읽습니다. 이미 실행 중인 앱은 다시 켜야 반영됩니다.
      </span>
    </div>
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
      <th>#</th><th>닉네임</th><th style="text-align:right">누적</th>
      <th style="text-align:right">오늘</th><th style="text-align:right">코인</th>
      <th style="text-align:right">대전 (승-패-무)</th><th style="text-align:right">협동</th>
      <th style="text-align:right">결제</th>
      <th>마지막 플레이</th><th>가입일</th><th>관리</th>
    </tr></thead><tbody>${list.map((p, i) => {
      const played = p.daily_date === today && (p.daily_score || 0) > 0;
      return `<tr>
        <td><input type="checkbox" data-pick="${p.id}" ${SELECTED.has(p.id) ? "checked" : ""}></td>
        <td class="num muted">${i + 1}</td>
        <td>${esc(p.username || "(이름 없음)")}
          ${p.supporter ? '<span class="pill heart">응원</span>' : ""}
          ${played ? '<span class="pill today">오늘</span>' : ""}
          ${p.reset_requested_at ? '<span class="pill heart">초기화 대기</span>' : ""}</td>
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
        <td class="muted">${fmtDate(p.daily_date)}</td>
        <td class="muted">${fmtDate(p.created_at)}</td>
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
    }).join("")}</tbody></table></div>`;
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

function batchesTable() {
  if (!BATCHES.length) return "";
  const now = Date.now();
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");

  const marked = BATCHES.map((b) => ({ b, st: batchState(b, now) }));
  const live = marked.filter((m) => isLiveBatch(m.st));
  const done = marked.filter((m) => !isLiveBatch(m.st));
  const shown = BATCH_VIEW === "live" ? live : done;

  const tabs = `<div class="subtabs">
    <button class="${BATCH_VIEW === "live" ? "on" : ""}" data-bview="live">진행 중 <b>${fmt(live.length)}</b></button>
    <button class="${BATCH_VIEW === "done" ? "on" : ""}" data-bview="done">지난 것 <b>${fmt(done.length)}</b></button>
  </div>`;

  if (!shown.length) {
    return `<h2>전체 지급 묶음</h2>${tabs}<div class="empty">${
      BATCH_VIEW === "live" ? "진행 중인 묶음이 없습니다" : "지난 묶음이 없습니다"}</div>`;
  }

  return `<h2>전체 지급 묶음</h2>${tabs}
  <div class="table-scroll"><table>
    <thead><tr><th>등록</th><th>내용</th><th>메모</th><th>받을 수 있는 기간</th>
      <th>상태</th><th style="text-align:right">수령</th><th>관리</th></tr></thead>
    <tbody>${shown.map(({ b, st }) => {
      const rows = `<tr>
        <td class="muted">${when(b.created_at)}</td>
        <td>${[b.coins && `🪙${b.coins}`, b.hints && `💡${b.hints}`, b.autos && `✨${b.autos}`]
              .filter(Boolean).join(" ")}</td>
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

function rewardsTable() {
  if (!REWARDS.length && !BATCHES.length) return `<div class="empty">지급한 보상이 없습니다</div>`;
  if (!REWARDS.length) return batchesTable();
  const rows = `<div class="table-scroll"><table>
    <thead><tr><th>시각</th><th>대상</th><th style="text-align:right">코인</th>
      <th style="text-align:right">힌트</th><th style="text-align:right">자동</th>
      <th>메모</th><th>수령</th></tr></thead>
    <tbody>${REWARDS.map((r) => {
      const who = PLAYERS.find((p) => p.id === r.profile_id);
      return `<tr>
        <td class="muted">${new Date(r.created_at).toLocaleString("ko-KR")}</td>
        <td>${esc(who?.username || (r.profile_id || "").slice(0, 8))}</td>
        <td class="num">${fmt(r.coins)}</td><td class="num">${fmt(r.hints)}</td><td class="num">${fmt(r.autos)}</td>
        <td class="muted">${esc(r.memo || "")}</td>
        <td>${r.claimed_at
          ? `<span class="muted">${new Date(r.claimed_at).toLocaleDateString("ko-KR")}</span>`
          : '<span class="pill today">대기</span>'}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  return batchesTable() + `<h2>개별 지급</h2>` + rows;
}

// ------------------------------------------------------------------ 화면
function render(warn, eventsErr, statsErr, noticesErr, payErr, auditErr, vsErr, cfgErr, serverErr) {
  const today = kstToday();
  const active = PLAYERS.filter((p) => p.daily_date === today && (p.daily_score || 0) > 0);
  const totals = PLAYERS.map((p) => p.total_score || 0);

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
      <div class="card"><div class="label">전체 회원</div><div class="value">${fmt(PLAYERS.length)}</div></div>
      <div class="card"><div class="label">오늘 플레이</div><div class="value">${fmt(active.length)}</div></div>
      <div class="card"><div class="label">오늘 최고점</div><div class="value">${fmt(Math.max(0, ...active.map((p) => p.daily_score || 0)))}</div></div>
      <div class="card"><div class="label">누적 최고점</div><div class="value">${fmt(Math.max(0, ...totals))}</div></div>
      <div class="card"><div class="label">응원해 주신 분</div><div class="value">${fmt(PLAYERS.filter((p) => p.supporter).length)}</div></div>
      <div class="card"><div class="label">미수령 보상</div><div class="value">${fmt(REWARDS.filter((r) => !r.claimed_at).length)}</div></div>
    </div>
      ${ANOMALIES.length ? `<div class="notice" style="margin-bottom:8px">
        <b>이상 징후</b> — 오늘 코인 3,000 이상 획득 ${ANOMALIES.length}명:
        ${ANOMALIES.slice(0, 5).map((a) => `${esc(a.username || "?")} (${fmt(a.earned_today)})`).join(", ")}
        ${ANOMALIES.length > 5 ? " 외" : ""}</div>` : ""}

    ${TAB === "players" ? `
      <div class="toolbar">
        <input type="search" id="q" placeholder="닉네임 또는 id 검색" value="${esc(QUERY)}">
        <select id="sort">
          <option value="total">누적 점수순</option>
          <option value="daily">오늘 점수순</option>
          <option value="coins">코인 많은순</option>
          <option value="vs_wins">대전 승수순</option>
          <option value="coop_wins">협동 승수순</option>
          <option value="created">가입 최신순</option>
          <option value="username">닉네임순</option>
        </select>
        <span class="muted" style="font-size:12.5px">기준 ${today} (한국시간)</span>
        <div style="flex:1"></div>
        <button class="sm" id="grantAll">전체 보상 지급</button>
        <button class="danger sm" id="delSelected">선택 삭제${SELECTED.size ? ` (${SELECTED.size})` : ""}</button>
        <button class="danger sm" id="resetAll">전체 점수 초기화</button>
        <button class="danger sm" id="resetAllGames">전체 게임 초기화</button>
        <button class="ghost sm" id="cancelResets">초기화 요청 취소</button>
      </div>
      <div id="ptable">${playersTable()}</div>` : ""}
    ${TAB === "charts" ? chartsTab(statsErr) : ""}
    ${TAB === "events" ? eventsTable(eventsErr) : ""}
    ${TAB === "rewards" ? rewardsTable() : ""}
    ${TAB === "purchases" ? purchasesTab(payErr) : ""}
    ${TAB === "versus" ? versusTab(vsErr) : ""}
    ${TAB === "update" ? updateTab(cfgErr) : ""}
    ${TAB === "notices" ? noticesTab(noticesErr) : ""}
    ${TAB === "audit" ? auditTable(auditErr) : ""}
    ${TAB === "server" ? serverTab(serverErr) : ""}`;

  $("#refresh").onclick = refresh;
  // 알림 "확인" — 지금 개수를 적어 두고 종만 다시 그린다. 서버는 건드리지 않는다.
  document.querySelectorAll("[data-seen]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      markSeen(b.dataset.seen, Number(b.dataset.seenN));
      render(warn, eventsErr, statsErr, noticesErr, payErr, auditErr, vsErr, cfgErr, serverErr);
    };
  });
  const orphan = $("#cleanupOrphans");
  if (orphan) orphan.onclick = async () => {
    if (!confirm("프로필 없이 24시간 넘게 남아 있는 익명 계정을 지웁니다.\n\n되돌릴 수 없습니다.")) return;
    await act(async () => {
      const n = await rpc("admin_cleanup_orphan_users", { p_older_than_hours: 24 });
      alert(`${n}개 계정을 정리했습니다`);
    }, refresh);
  };
  $("#logout").onclick = async () => { await sb.auth.signOut(); renderLogin(); };
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => { TAB = b.dataset.tab; refresh(); };
  });

  if (TAB === "versus") {
    $("#toggleVersus").onclick = toggleVersus;
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

  if (TAB === "update" && $("#saveVersions")) {
    $("#saveVersions").onclick = saveVersions;
    if ($("#saveMaint")) $("#saveMaint").onclick = saveMaintenance;
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
    $("#sort").onchange = async (e) => { SORT = e.target.value; await loadPlayers(); render(warn, eventsErr); };
    $("#q").oninput = (e) => {
      QUERY = e.target.value;
      $("#ptable").innerHTML = playersTable();
      bindPicks();
      bindRowActions();
    };
    $("#resetAll").onclick = resetAllScores;
    $("#resetAllGames").onclick = resetAllGames;
    $("#cancelResets").onclick = cancelGameResets;
    $("#grantAll").onclick = () => openGrant(null);
    $("#delSelected").onclick = deleteSelected;
    bindPicks();
    bindRowActions();
  }
}

/** 체크박스 배선. 선택은 SELECTED에 모으고, 헤더 체크는 지금 화면에 보이는 것만 다룬다 —
 *  검색으로 걸러 놓고 전체 선택을 눌렀는데 안 보이는 사람까지 잡히면 사고가 난다. */
function bindPicks() {
  const boxes = [...document.querySelectorAll("[data-pick]")];
  boxes.forEach((b) => {
    b.onchange = () => {
      if (b.checked) SELECTED.add(b.dataset.pick);
      else SELECTED.delete(b.dataset.pick);
      $("#delSelected").textContent = `선택 삭제${SELECTED.size ? ` (${SELECTED.size})` : ""}`;
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
      $("#delSelected").textContent = `선택 삭제${SELECTED.size ? ` (${SELECTED.size})` : ""}`;
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

async function refresh() { boot(); }

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  EMAIL = session.user.email || "";

  const perr = await loadPlayers();
  await loadConfig().catch(() => {});   // 문턱·점검 예약이 여기서 온다
  await loadAnomalies();
  const eerr = TAB === "events" ? await loadEvents() : null;
  const serr = TAB === "charts" ? await loadStats() : null;
  const nerr = TAB === "notices" ? await loadNotices() : null;
  const perr2 = TAB === "purchases" ? await loadPurchases() : null;
  if (TAB === "players") await loadPayTotals();
  if (TAB === "rewards" || TAB === "players") {
    await loadRewards().catch(() => {});
    await loadBatches().catch(() => {});
  }
  const aerr = TAB === "audit" ? await loadAudit().catch((e) => e) : null;
  const vserr = TAB === "versus" ? await loadVersus() : null;
  const cfgerr = TAB === "update" ? await loadConfig().then(() => null).catch((e) => e) : null;
  const sverr = TAB === "server" ? await loadServer() : null;
  // 알림은 **새로고침할 때만** 가져온다(사용자 지시) — 따로 도는 타이머는 두지 않는다.
  await loadAlerts();

  let warn = "";
  if (perr) warn = "회원 조회 실패: " + perr.message;
  else if (!PLAYERS.length) {
    warn = "조회 결과가 비어 있습니다. 이 계정이 admins 테이블에 등록됐는지 확인하세요 " +
           "(supabase_admin_access.sql 4번 항목).";
  }
  render(warn, eerr, serr, nerr, perr2, aerr, vserr, cfgerr, sverr);
}

boot();
