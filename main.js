// 관리자 화면 — 회원·점수 관리 / 이벤트 집계 / 보상 지급.
import { sb, $, fmt, fmtDate, esc, kstToday, askReason, rpc } from "./app.js";

let TAB = "players";
let PLAYERS = [], EVENTS = [], AUDIT = [], REWARDS = [], BATCHES = [], STATS = [], BUCKETS = [];
let FUNNEL = [], RETENTION = [], NOTICES = [];
/** 이벤트 이력을 펼쳐 놓은 회원. */
let OPEN_MEMBER = null, MEMBER_EVENTS = [];
let SORT = "total_score", QUERY = "", EMAIL = "";
/** 다중 삭제용 선택 목록. 검색어를 바꿔도 선택은 유지된다 — 여러 번 걸러 가며
 *  고르는 게 자연스럽고, 안 보이는 걸 지우는 사고는 삭제 직전 명단 확인으로 막는다. */
let SELECTED = new Set();
/** 보상 탭에서 펼쳐 놓은 묶음 id와 그 명단. */
let OPEN_BATCH = null, BATCH_MEMBERS = [];

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
async function loadPlayers() {
  const { data, error } = await sb.from("profiles").select("*")
    .order(SORT, { ascending: SORT === "username" }).limit(500);
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
    return null;
  } catch (e) { STATS = []; BUCKETS = []; FUNNEL = []; RETENTION = []; return e; }
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

function chartsTab(err) {
  if (err) return `<div class="notice">집계 조회 실패: ${esc(err.message)}<br>supabase_admin_v2.sql을 실행했는지 확인하세요.</div>`;
  if (!STATS.length) return `<div class="empty">집계할 데이터가 아직 없습니다</div>`;
  const days = STATS.map((r) => r.day);
  return `
    <h2>신규 가입 · 접속자 (최근 30일)</h2>
    ${lineChart(days, [
      { name: "신규 가입", color: "#17b3a8", values: STATS.map((r) => Number(r.signups)) },
      { name: "접속자", color: "#7aa2f7", values: STATS.map((r) => Number(r.active)) },
    ])}
    <h2>코인 획득 · 소모</h2>
    ${lineChart(days, [
      { name: "획득", color: "#d9a441", values: STATS.map((r) => Number(r.coin_earned)) },
      { name: "소모", color: "#d95757", values: STATS.map((r) => Number(r.coin_spent)) },
    ])}
    <h2>누적 점수 분포</h2>
    ${BUCKETS.length ? barChart(BUCKETS) : `<div class="empty">데이터 없음</div>`}
    <h2>레벨별 도달 인원 — 어디서 그만두는지</h2>
    ${FUNNEL.length
      ? lineChart(FUNNEL.map((r) => String(r.level).padStart(5, "0")),
                  [{ name: "도달 인원", color: "#17b3a8", values: FUNNEL.map((r) => Number(r.players)) }])
      : `<div class="empty">레벨 클리어 기록이 아직 없습니다</div>`}
    <h2>리텐션 (가입일 기준 재방문)</h2>
    ${retentionTable()}`;
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

async function resetAllScores() {
  const scope = window.prompt(
    "전체 회원의 점수를 초기화합니다.\n\n" +
    "daily = 오늘 점수만\ntotal = 누적 점수만\nboth = 둘 다\n\n입력:", "daily");
  if (scope === null) return;
  if (!["daily", "total", "both"].includes(scope)) { alert("daily, total, both 중 하나만 됩니다"); return; }
  if (!confirm(`정말로 전체 회원의 ${scope} 점수를 0으로 만들까요? 되돌릴 수 없습니다.`)) return;
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
  ["#gMemo", "#gStart", "#gEnd"].forEach((s) => ($(s).value = ""));
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
  if (OPEN_MEMBER === id) { OPEN_MEMBER = null; MEMBER_EVENTS = []; render(); return; }
  OPEN_MEMBER = id;
  try { MEMBER_EVENTS = await rpc("admin_member_events", { p_target: id, p_limit: 200 }) || []; }
  catch (e) { MEMBER_EVENTS = []; alert("이력 조회 실패: " + e.message); }
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
  const left = (b?.target_count || 0) - Number(b?.claimed_count || 0);
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
function playersTable() {
  const today = kstToday();
  const q = QUERY.trim().toLowerCase();
  const list = q ? PLAYERS.filter((p) => (p.username || "").toLowerCase().includes(q)) : PLAYERS;
  if (!list.length) return `<div class="empty">해당하는 회원이 없습니다</div>`;
  return `<div class="table-scroll"><table>
    <thead><tr>
      <th style="width:34px"><input type="checkbox" id="pickAll"></th>
      <th>#</th><th>닉네임</th><th style="text-align:right">누적</th>
      <th style="text-align:right">오늘</th><th>마지막 플레이</th><th>가입일</th><th>관리</th>
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
  const inner = MEMBER_EVENTS.length
    ? `<div class="table-scroll" style="max-height:260px;overflow-y:auto">
         <table style="min-width:380px"><tbody>${MEMBER_EVENTS.map((e) => `<tr>
           <td class="muted">${new Date(e.created_at).toLocaleString("ko-KR")}</td>
           <td>${esc(e.name)}</td>
           <td class="num">${e.value ?? ""}</td>
           <td class="muted">${esc(e.platform || "")}</td>
         </tr>`).join("")}</tbody></table></div>`
    : `<div class="muted" style="font-size:12.5px">기록된 이벤트가 없습니다</div>`;
  return `<tr><td colspan="9" style="white-space:normal">${inner}</td></tr>`;
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

function auditTable() {
  if (!AUDIT.length) return `<div class="empty">기록된 관리 작업이 없습니다</div>`;
  return `<div class="table-scroll"><table>
    <thead><tr><th>시각</th><th>작업</th><th>대상</th><th>내용</th></tr></thead>
    <tbody>${AUDIT.map((a) => `<tr>
      <td class="muted">${new Date(a.created_at).toLocaleString("ko-KR")}</td>
      <td>${esc(a.action)}</td>
      <td class="muted">${esc((a.target_id || "").slice(0, 8))}</td>
      <td class="muted" style="white-space:normal;max-width:520px">${esc(JSON.stringify(a.detail))}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function batchesTable() {
  if (!BATCHES.length) return "";
  const now = Date.now();
  const when = (v) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");
  return `<h2>전체 지급 묶음</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>등록</th><th>내용</th><th>메모</th><th>받을 수 있는 기간</th>
      <th style="text-align:right">수령</th><th>관리</th></tr></thead>
    <tbody>${BATCHES.map((b) => {
      const expired = b.expires_at && new Date(b.expires_at).getTime() <= now;
      const notYet = b.starts_at && new Date(b.starts_at).getTime() > now;
      const left = (b.target_count || 0) - Number(b.claimed_count || 0);
      const rows = `<tr>
        <td class="muted">${when(b.created_at)}</td>
        <td>${[b.coins && `🪙${b.coins}`, b.hints && `💡${b.hints}`, b.autos && `✨${b.autos}`]
              .filter(Boolean).join(" ")}</td>
        <td class="muted">${esc(b.memo || "")}</td>
        <td class="muted">${when(b.starts_at)} ~ ${when(b.expires_at)}
          ${expired ? '<span class="pill heart">만료</span>' : ""}
          ${notYet ? '<span class="pill today">대기</span>' : ""}</td>
        <td class="num">${fmt(b.claimed_count)} / ${fmt(b.target_count)}</td>
        <td><div class="actions">
          <button class="ghost sm" data-batch="${b.id}">${OPEN_BATCH === b.id ? "접기" : "명단"}</button>
          ${left > 0 ? `<button class="danger sm" data-revoke="${b.id}">회수</button>` : ""}
        </div></td>
      </tr>`;
      if (OPEN_BATCH !== b.id) return rows;
      const members = BATCH_MEMBERS.length
        ? BATCH_MEMBERS.map((m) => `<span class="mem ${m.claimed_at ? "got" : ""}">${esc(m.username || "—")}</span>`).join("")
        : '<span class="muted">명단 없음</span>';
      return rows + `<tr><td colspan="6" style="white-space:normal">
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
function render(warn, eventsErr, statsErr, noticesErr) {
  const today = kstToday();
  const active = PLAYERS.filter((p) => p.daily_date === today && (p.daily_score || 0) > 0);
  const totals = PLAYERS.map((p) => p.total_score || 0);
  const tab = (id, label) => `<button class="${TAB === id ? "on" : ""}" data-tab="${id}">${label}</button>`;

  $("#app").innerHTML = `
    <div class="head">
      <h1>🐾 DogPuzzle 관리자</h1>
      <div class="spacer"></div>
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
    <div class="tabs">
      ${tab("players", "회원")}${tab("charts", "차트")}${tab("events", "이벤트")}${tab("rewards", "보상")}${tab("notices", "공지")}${tab("audit", "관리 기록")}
    </div>
    ${TAB === "players" ? `
      <div class="toolbar">
        <input type="search" id="q" placeholder="닉네임 검색" value="${esc(QUERY)}">
        <select id="sort">
          <option value="total_score">누적 점수순</option>
          <option value="daily_score">오늘 점수순</option>
          <option value="created_at">가입 최신순</option>
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
    ${TAB === "notices" ? noticesTab(noticesErr) : ""}
    ${TAB === "audit" ? auditTable() : ""}`;

  $("#refresh").onclick = refresh;
  $("#logout").onclick = async () => { await sb.auth.signOut(); renderLogin(); };
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => { TAB = b.dataset.tab; refresh(); };
  });

  if (TAB === "notices") {
    $("#newNotice").onclick = openNotice;
    document.querySelectorAll("[data-delnotice]").forEach((b) => {
      b.onclick = () => deleteNotice(Number(b.dataset.delnotice));
    });
  }

  if (TAB === "rewards") {
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
  const eerr = TAB === "events" ? await loadEvents() : null;
  const serr = TAB === "charts" ? await loadStats() : null;
  const nerr = TAB === "notices" ? await loadNotices() : null;
  if (TAB === "rewards" || TAB === "players") {
    await loadRewards().catch(() => {});
    await loadBatches().catch(() => {});
  }
  if (TAB === "audit") await loadAudit().catch(() => {});

  let warn = "";
  if (perr) warn = "회원 조회 실패: " + perr.message;
  else if (!PLAYERS.length) {
    warn = "조회 결과가 비어 있습니다. 이 계정이 admins 테이블에 등록됐는지 확인하세요 " +
           "(supabase_admin_access.sql 4번 항목).";
  }
  render(warn, eerr, serr, nerr);
}

boot();
