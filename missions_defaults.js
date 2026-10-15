// 생성 파일이다. 손으로 고치지 않는다. 원본은 aos/DogPuzzle/missions/defaults.json, 생성은 python3 missions/gen.py
// 관리자 미션 탭이 「기본 목록으로 되돌리기」와 서버에 목록이 없을 때 쓴다.
export const MISSION_DEFAULTS = [
 {
  "id": "d_clear3",
  "period": "daily",
  "kind": "cleared",
  "target": 3,
  "coins": 15,
  "order": 10,
  "on": true
 },
 {
  "id": "d_combo5",
  "period": "daily",
  "kind": "combo5",
  "target": 1,
  "coins": 15,
  "order": 20,
  "on": true
 },
 {
  "id": "d_fast1",
  "period": "daily",
  "kind": "fastClear",
  "target": 1,
  "coins": 15,
  "order": 30,
  "on": true
 },
 {
  "id": "d_watchAd1",
  "period": "daily",
  "kind": "adWatched",
  "target": 1,
  "coins": 15,
  "order": 40,
  "on": true
 },
 {
  "id": "d_perfect1",
  "period": "daily",
  "kind": "perfect",
  "target": 1,
  "coins": 10,
  "order": 50,
  "on": true
 },
 {
  "id": "d_versus1",
  "period": "daily",
  "kind": "versusPlayed",
  "target": 1,
  "coins": 15,
  "order": 60,
  "on": false
 },
 {
  "id": "d_today1",
  "period": "daily",
  "kind": "dailyCleared",
  "target": 1,
  "coins": 10,
  "order": 70,
  "on": true
 },
 {
  "id": "d_clear5",
  "period": "daily",
  "kind": "cleared",
  "target": 5,
  "coins": 20,
  "order": 80,
  "on": true
 },
 {
  "id": "d_hint1",
  "period": "daily",
  "kind": "hintUsed",
  "target": 1,
  "coins": 10,
  "order": 90,
  "on": true
 },
 {
  "id": "d_combo3",
  "period": "daily",
  "kind": "combo3",
  "target": 1,
  "coins": 10,
  "order": 100,
  "on": true
 },
 {
  "id": "d_number1",
  "period": "daily",
  "kind": "numberCleared",
  "target": 1,
  "coins": 15,
  "order": 110,
  "on": true,
  "requires": "number_mode"
 },
 {
  "id": "d_auto1",
  "period": "daily",
  "kind": "autoUsed",
  "target": 1,
  "coins": 10,
  "order": 120,
  "on": true
 },
 {
  "id": "d_clear10",
  "period": "daily",
  "kind": "cleared",
  "target": 10,
  "coins": 30,
  "order": 130,
  "on": false
 },
 {
  "id": "d_combo8",
  "period": "daily",
  "kind": "combo8",
  "target": 1,
  "coins": 20,
  "order": 140,
  "on": false
 },
 {
  "id": "d_todayFinish",
  "period": "daily",
  "kind": "dailyFinished",
  "target": 1,
  "coins": 15,
  "order": 150,
  "on": false
 },
 {
  "id": "d_todayPerfect",
  "period": "daily",
  "kind": "dailyPerfect",
  "target": 1,
  "coins": 20,
  "order": 160,
  "on": false
 },
 {
  "id": "d_number3",
  "period": "daily",
  "kind": "numberCleared",
  "target": 3,
  "coins": 25,
  "order": 170,
  "on": false,
  "requires": "number_mode"
 },
 {
  "id": "d_fast3",
  "period": "daily",
  "kind": "fastClear",
  "target": 3,
  "coins": 30,
  "order": 180,
  "on": false
 },
 {
  "id": "d_score3000",
  "period": "daily",
  "kind": "scoreGained",
  "target": 3000,
  "coins": 15,
  "order": 190,
  "on": false
 },
 {
  "id": "d_ad3",
  "period": "daily",
  "kind": "adWatched",
  "target": 3,
  "coins": 30,
  "order": 200,
  "on": false
 },
 {
  "id": "d_share1",
  "period": "daily",
  "kind": "shared",
  "target": 1,
  "coins": 10,
  "order": 210,
  "on": false
 },
 {
  "id": "d_shop1",
  "period": "daily",
  "kind": "shopBought",
  "target": 1,
  "coins": 10,
  "order": 220,
  "on": false
 },
 {
  "id": "w_clear50",
  "period": "weekly",
  "kind": "cleared",
  "target": 50,
  "coins": 70,
  "order": 10,
  "on": true
 },
 {
  "id": "w_score40k",
  "period": "weekly",
  "kind": "scoreGained",
  "target": 40000,
  "coins": 70,
  "order": 20,
  "on": true
 },
 {
  "id": "w_attend5",
  "period": "weekly",
  "kind": "attended",
  "target": 5,
  "coins": 50,
  "order": 30,
  "on": true
 },
 {
  "id": "w_combo8",
  "period": "weekly",
  "kind": "combo8",
  "target": 1,
  "coins": 50,
  "order": 40,
  "on": true
 },
 {
  "id": "w_daily3",
  "period": "weekly",
  "kind": "dailyCleared",
  "target": 3,
  "coins": 50,
  "order": 50,
  "on": true
 },
 {
  "id": "w_versus5",
  "period": "weekly",
  "kind": "versusPlayed",
  "target": 5,
  "coins": 50,
  "order": 60,
  "on": false
 },
 {
  "id": "w_versusWin3",
  "period": "weekly",
  "kind": "versusWon",
  "target": 3,
  "coins": 50,
  "order": 70,
  "on": false
 },
 {
  "id": "w_coop1",
  "period": "weekly",
  "kind": "coopPlayed",
  "target": 1,
  "coins": 50,
  "order": 80,
  "on": false
 },
 {
  "id": "w_clear100",
  "period": "weekly",
  "kind": "cleared",
  "target": 100,
  "coins": 100,
  "order": 90,
  "on": true
 },
 {
  "id": "w_score100k",
  "period": "weekly",
  "kind": "scoreGained",
  "target": 100000,
  "coins": 100,
  "order": 100,
  "on": true
 },
 {
  "id": "w_attend7",
  "period": "weekly",
  "kind": "attended",
  "target": 7,
  "coins": 70,
  "order": 110,
  "on": true
 },
 {
  "id": "w_number10",
  "period": "weekly",
  "kind": "numberCleared",
  "target": 10,
  "coins": 70,
  "order": 120,
  "on": true,
  "requires": "number_mode"
 },
 {
  "id": "w_allDaily3",
  "period": "weekly",
  "kind": "allDailyDays",
  "target": 3,
  "coins": 70,
  "order": 130,
  "on": true
 },
 {
  "id": "w_perfect10",
  "period": "weekly",
  "kind": "perfect",
  "target": 10,
  "coins": 70,
  "order": 140,
  "on": true
 },
 {
  "id": "w_walk1",
  "period": "weekly",
  "kind": "walkJoined",
  "target": 1,
  "coins": 50,
  "order": 150,
  "on": true,
  "requires": "live_event"
 },
 {
  "id": "w_today5",
  "period": "weekly",
  "kind": "dailyCleared",
  "target": 5,
  "coins": 70,
  "order": 160,
  "on": false
 },
 {
  "id": "w_todayPerfect3",
  "period": "weekly",
  "kind": "dailyPerfect",
  "target": 3,
  "coins": 70,
  "order": 170,
  "on": false
 },
 {
  "id": "w_number30",
  "period": "weekly",
  "kind": "numberCleared",
  "target": 30,
  "coins": 100,
  "order": 180,
  "on": false,
  "requires": "number_mode"
 },
 {
  "id": "w_fast20",
  "period": "weekly",
  "kind": "fastClear",
  "target": 20,
  "coins": 80,
  "order": 190,
  "on": false
 },
 {
  "id": "w_combo5x10",
  "period": "weekly",
  "kind": "combo5",
  "target": 10,
  "coins": 70,
  "order": 200,
  "on": false
 },
 {
  "id": "w_ad10",
  "period": "weekly",
  "kind": "adWatched",
  "target": 10,
  "coins": 100,
  "order": 210,
  "on": false
 },
 {
  "id": "w_share3",
  "period": "weekly",
  "kind": "shared",
  "target": 3,
  "coins": 50,
  "order": 220,
  "on": false
 },
 {
  "id": "w_hint5",
  "period": "weekly",
  "kind": "hintUsed",
  "target": 5,
  "coins": 50,
  "order": 230,
  "on": false
 },
 {
  "id": "w_bigNumber5",
  "period": "weekly",
  "kind": "numberBigCleared",
  "target": 5,
  "coins": 70,
  "order": 240,
  "on": false,
  "requires": "number_mode"
 },
 {
  "id": "w_top10",
  "period": "weekly",
  "kind": "todayTop10",
  "target": 1,
  "coins": 100,
  "order": 250,
  "on": false
 },
 {
  "id": "m_clear200",
  "period": "monthly",
  "kind": "cleared",
  "target": 200,
  "coins": 300,
  "order": 10,
  "on": true
 },
 {
  "id": "m_attend20",
  "period": "monthly",
  "kind": "attended",
  "target": 20,
  "coins": 300,
  "order": 20,
  "on": true
 },
 {
  "id": "m_today15",
  "period": "monthly",
  "kind": "dailyCleared",
  "target": 15,
  "coins": 250,
  "order": 30,
  "on": true
 },
 {
  "id": "m_allWeekly2",
  "period": "monthly",
  "kind": "allWeeklyWeeks",
  "target": 2,
  "coins": 300,
  "order": 40,
  "on": true
 },
 {
  "id": "m_score500k",
  "period": "monthly",
  "kind": "scoreGained",
  "target": 500000,
  "coins": 300,
  "order": 50,
  "on": true
 },
 {
  "id": "m_number50",
  "period": "monthly",
  "kind": "numberCleared",
  "target": 50,
  "coins": 250,
  "order": 60,
  "on": false,
  "requires": "number_mode"
 },
 {
  "id": "m_perfect50",
  "period": "monthly",
  "kind": "perfect",
  "target": 50,
  "coins": 250,
  "order": 70,
  "on": false
 },
 {
  "id": "m_ad30",
  "period": "monthly",
  "kind": "adWatched",
  "target": 30,
  "coins": 300,
  "order": 80,
  "on": false
 },
 {
  "id": "m_walk20",
  "period": "monthly",
  "kind": "walkBoards",
  "target": 20,
  "coins": 200,
  "order": 90,
  "on": false,
  "requires": "live_event"
 }
];
export const MISSION_KINDS = ["cleared", "combo3", "combo5", "combo8", "fastClear", "adWatched", "perfect", "versusPlayed", "versusWon", "coopPlayed", "scoreGained", "attended", "dailyCleared", "hintUsed", "autoUsed", "numberCleared", "numberBigCleared", "dailyFinished", "dailyPerfect", "shared", "shopBought", "allDailyDays", "allWeeklyWeeks", "walkJoined", "walkBoards", "todayTop10"];
