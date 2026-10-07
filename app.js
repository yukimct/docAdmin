// DogPuzzle 관리자 — 회원·점수 관리, 이벤트 집계, 보상 지급.
//
// anon 키는 공개용이다(앱 바이너리에도 들어 있다). 실제 접근 통제는 서버 RLS와
// admin_* 함수 안의 is_admin() 검사가 한다 — 이 파일에는 비밀이 없다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 개발 서버 dogpuzzle-dev에 붙는 경우는 둘이다(2026-10-07). 그 밖에는 운영이다.
//   1) 배포본의 dev/ 경로: https://dogadm.koinoroom.com/dev/ — 1.5.0 관리자 작업은 출시 전까지 여기에만 올린다.
//   2) 주소 뒤 ?env=dev: 이 Mac에서 띄워 볼 때.
// 개발 서버에서는 화면 맨 위에 「개발 서버」 띠가 뜬다. 운영과 헷갈려 운영 데이터를 고치는 일을 막으려는 것이다.
export const IS_DEV = location.pathname.startsWith("/dev/")
  || new URLSearchParams(location.search).get("env") === "dev";
const SUPABASE_URL = IS_DEV ? "https://xejwxuugyurnihnvbkcl.supabase.co"
                            : "https://xlresbtzkbdyryhhtmuv.supabase.co";
const ANON_KEY = IS_DEV
  ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhland4dXVneXVybmlobnZia2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDY1MDIsImV4cCI6MjEwNjg4MjUwMn0.fJ8x_dbkeztdgs6bnu1zqtluPGFWf7lZsUDOScjZsyU"
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhscmVzYnR6a2JkeXJ5aGh0bXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDM2ODcsImV4cCI6MjEwMTg3OTY4N30.FVhGFd2FjDyZeJXz8yVDwk5FOSBmXO_wlYBe6KpA09o";
// 배포본(dogadm.koinoroom.com)은 dev/ 경로로, 이 Mac에서 띄운 것은 ?env=dev로 서버를 가른다.
const DEPLOYED = location.hostname === "dogadm.koinoroom.com";

/** 지금 화면을 반대쪽 서버로 연 주소. 로그인은 서버마다 따로라 넘어가면 그쪽에서 한 번 로그인한다. */
function otherEnvURL() {
  const u = new URL(location.href);
  if (DEPLOYED) {
    u.pathname = IS_DEV ? (u.pathname.replace(/^\/dev(\/|$)/, "/")) : "/dev" + u.pathname;
    u.searchParams.delete("env");
  } else if (IS_DEV) {
    u.searchParams.delete("env");
  } else {
    u.searchParams.set("env", "dev");
  }
  return u.toString();
}

// 개발 서버에서는 맨 위에 보라색 띠를, 운영에서는 오른쪽 아래에 작은 버튼을 둔다(사용자 요청, 2026-10-07).
// 띠는 운영과 헷갈려 운영 데이터를 고치는 일을 막으려는 것이고, 버튼은 두 서버를 오가는 길이다.
const markEnv = () => {
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = IS_DEV ? "운영으로 전환" : "개발 서버로 전환";
  go.onclick = () => { location.href = otherEnvURL(); };
  if (IS_DEV) {
    const bar = document.createElement("div");
    bar.style.cssText = "position:sticky;top:0;z-index:9999;background:#7c3aed;color:#fff;font-weight:700;text-align:center;padding:6px 8px;font-size:13px;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap";
    const label = document.createElement("span");
    label.textContent = "개발 서버 dogpuzzle-dev. 운영 데이터가 아닙니다.";
    go.style.cssText = "background:#fff;color:#5b21b6;border:0;border-radius:999px;padding:3px 10px;font-weight:700;font-size:12px;cursor:pointer";
    bar.append(label, go);
    document.body.prepend(bar);
    document.title = "[개발] " + document.title;
  } else {
    go.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9999;background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;border-radius:999px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.12)";
    document.body.append(go);
  }
};
// 모듈은 문서를 다 읽은 뒤에 돌 수도 있어서 두 경우를 다 받는다.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markEnv);
else markEnv();

export const sb = createClient(SUPABASE_URL, ANON_KEY);
export const $ = (s, r = document) => r.querySelector(s);

export const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
/**
 * 날짜만. **한국시간 기준으로 자른다.**
 *
 * ⚠️ 예전에는 ISO 문자열을 그냥 `slice(0,10)`했다. 그건 **UTC 날짜**라,
 * 한국시간 0시~9시 사이에 생긴 것이 하루 전으로 보였다.
 */
export const fmtDate = (s) => (s ? kst(s).slice(0, 10) : "—");

/** 날짜와 시:분. 가입 시각처럼 **언제인지가 중요한 값**에 쓴다. */
export const fmtDateTime = (s) => (s ? kst(s).replace("T", " ").slice(0, 16) : "—");

/** 시:분만. 날짜를 이미 옆에 적어 둔 자리에 쓴다. */
export const fmtTime = (s) => (s ? kst(s).slice(11, 16) : "—");

/** UTC로 저장된 시각을 한국시간 ISO 문자열로 옮긴다. */
function kst(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString();
}
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 한국시간 기준 오늘 — daily_date가 KST로 저장되므로 화면도 같은 기준을 써야 한다. */
export function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 되돌릴 수 없는 작업은 이유를 남기게 한다 — 감사 로그에 그대로 들어간다. */
export function askReason(title) {
  const reason = window.prompt(`${title}\n\n사유를 적어주세요 (감사 로그에 남습니다)`);
  if (reason === null) return null;
  return reason.trim() || "(사유 없음)";
}

/** 사유가 꼭 있어야 하는 작업(이벤트 지금 끝내기·취소, 103). 서버가 빈 사유를 거절하므로 빈칸이면 다시 묻는다.
 *  취소를 누르면 null이다. askReason은 빈칸을 「(사유 없음)」으로 넘겨 여기에는 못 쓴다. */
export function askReasonRequired(title) {
  let hint = "";
  for (;;) {
    const reason = window.prompt(`${title}\n\n사유를 적어주세요 (감사 로그에 남습니다, 필수)${hint}`);
    if (reason === null) return null;
    if (reason.trim()) return reason.trim();
    hint = "\n\n사유를 비울 수 없습니다.";
  }
}

export async function rpc(name, params) {
  const { data, error } = await sb.rpc(name, params);
  if (error) throw new Error(error.message);
  return data;
}
