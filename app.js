// DogPuzzle 관리자 — 회원·점수 관리, 이벤트 집계, 보상 지급.
//
// anon 키는 공개용이다(앱 바이너리에도 들어 있다). 실제 접근 통제는 서버 RLS와
// admin_* 함수 안의 is_admin() 검사가 한다 — 이 파일에는 비밀이 없다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xlresbtzkbdyryhhtmuv.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhscmVzYnR6a2JkeXJ5aGh0bXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDM2ODcsImV4cCI6MjEwMTg3OTY4N30.FVhGFd2FjDyZeJXz8yVDwk5FOSBmXO_wlYBe6KpA09o";

export const sb = createClient(SUPABASE_URL, ANON_KEY);
export const $ = (s, r = document) => r.querySelector(s);

export const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");
export const fmtDate = (s) => (s ? String(s).slice(0, 10) : "—");
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

export async function rpc(name, params) {
  const { data, error } = await sb.rpc(name, params);
  if (error) throw new Error(error.message);
  return data;
}
