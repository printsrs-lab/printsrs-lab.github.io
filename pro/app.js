
// --- HTML / attribute escaping helpers (security + robustness) ---
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s) {
  // Same as escapeHtml; kept separate for clarity where used in attributes
  return escapeHtml(s);
}
/* Print SRS Lite Pro (Nodeなし / IndexedDB)
   2026-02-19 build:
   - Pro: まとめ印刷（複数選択→一括）をPro限定
   - 無料: 単体印刷は可能（A4/A3 選択OK）※透かしFree
   - Pro: 印刷物右下に小さな Licensed ID: XXXX（uid必須）
   - Pro URLは /pro/ 配下想定。?uid=XXXX が無い場合はPro機能停止＆案内表示。
   - 既存仕様（SRS/教科シート/任意学習/バックアップ/復元/iframe印刷）を維持
*/

const CFG = {
  maxW: 1600,
  jpegQ: 0.82,
  longPressMs: 350,
  toastMs: 2500,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const now = () => Date.now();
const dayMs = 24 * 60 * 60 * 1000;

function formatIntervalHint(ms, rating){
  // もう一度は UI 上「＜10分」に固定表示
  if (rating === "again") return "＜10分";

  const min = 60*1000;
  const hour = 60*min;
  const day = dayMs;

  if (ms < hour) {
    const m = Math.max(1, Math.round(ms/min));
    return `${m}分後`;
  }
  if (ms < day) {
    const h = Math.max(1, Math.round(ms/hour));
    return `${h}時間後`;
  }

  const d = Math.max(1, Math.round(ms/day));
  if (d < 60) return `${d}日後`;

  const mo = Math.max(2, Math.round(d/30));
  if (mo < 24) return `${mo}ヶ月後`;

  const y = Math.max(2, Math.round(mo/12));
  return `${y}年後`;
}

function applyRateHintsForGroup(gid){
  // 表示専用：クリック前に「選ぶといつになるか」を見せる（保存しない）
  const prev = cache.srs.find(s => s.groupId === gid) || initSrsState(gid);
  const labels = { again:"もう一度", hard:"難しい", good:"正解", easy:"簡単" };

  Object.keys(labels).forEach((rating) => {
    const btn = document.querySelector(`[data-review-rate="${rating}"]`);
    if (!btn) return;
    const next = updateSrs(prev, rating); // プレビュー計算
    const ms = Math.max(0, next.nextDueAt - now());
    const hint = formatIntervalHint(ms, rating);

    // ボタン内表示を「上：予告 / 下：ラベル」に置換
    btn.innerHTML = `<span class="rateHint">${hint}</span><span class="rateLabel">${labels[rating]}</span>`;
  });
}

async function showYellowHintOnce(){
  // 初回だけ「黄色枠＝今回の復習範囲」を強調表示（数秒で自動消去）
  try{
    const rec = await get("ui", "yellowHintDone");
    if (rec?.value) return;
  }catch{}

  let el = document.querySelector("#yellowHintToast");
  if (!el){
    el = document.createElement("div");
    el.id = "yellowHintToast";
    el.className = "toastHint hidden";
    el.setAttribute("role","status");
    el.innerHTML = `<div class="toastHint__title">黄色枠が今回の復習範囲</div>
                    <div class="toastHint__body">黒塗りをタップすると答えが見えます</div>`;
    document.body.appendChild(el);
  }

  el.classList.remove("hidden");
  // small pop
  requestAnimationFrame(()=> el.classList.add("toastHint--show"));

  // auto hide
  setTimeout(()=>{
    el.classList.remove("toastHint--show");
    setTimeout(()=> el.classList.add("hidden"), 300);
  }, 2600);

  try{
    await put("ui", { key:"yellowHintDone", value:true, updatedAt: now() });
  }catch{}
}
function uid() {
  return Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function clamp01(v){ return clamp(v, 0, 1); }
function toDateStr(ms){ return new Date(ms).toLocaleString(); }

/* ========= Pro判定（/pro/配下 かつ uid 必須） ========= */
const PRO_CFG = {
  proPathHint: "/pro/",     // Pro版はこのパス配下で運用する想定
  uidParam: "uid",          // 購入者に渡す識別子
  buyInfoText: "Pro（まとめ印刷・透かしなし）をご利用の方は、購入時に案内されたURL（?uid=XXXX付き）を開いてください。",
};

function getQueryParam(name){
  try{
    return new URLSearchParams(location.search).get(name);
  }catch{
    return null;
  }
}
function isProPath(){
  return (location.pathname || "").includes(PRO_CFG.proPathHint);
}
function getLicensedId(){
  const v = (getQueryParam(PRO_CFG.uidParam) || "").trim();
  return v || null;
}
const PRO = {
  isProPath: isProPath(),
  licensedId: getLicensedId(),
  // Pro機能を有効にする条件：/pro/ 配下で、uidがある
  enabled: false,
};
PRO.enabled = !!(PRO.isProPath && PRO.licensedId);

function renderProGateBanner(){
  const el = $("#proGateBanner");
  if (!el) return;

  if (PRO.isProPath && !PRO.licensedId){
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden","false");
    el.innerHTML = `
      <b>Proの購入ID（uid）が見つかりません。</b><br>
      ${escapeHtml(PRO_CFG.buyInfoText)}<br>
      <span class="muted small">例： .../pro/?uid=AB123</span>
    `;
  }else{
    el.classList.add("hidden");
    el.setAttribute("aria-hidden","true");
    el.innerHTML = "";
  }
}

/* ========= Licensed ID badge（画面右下） ========= */
function renderLicensedBadge(){
  const el = $("#licensedBadge");
  if (!el) return;
  if (PRO.enabled && PRO.licensedId){
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden","false");
    el.textContent = `Licensed ID: ${PRO.licensedId}`;
  } else {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden","true");
    el.textContent = "";
  }
}

/* ========= チュートリアル（スポットライト方式 / 画面別） ========= */
const TOUR_SETS = {
  home: [
    { sel: '[data-nav="add"]',   title: "① プリントを追加", body: "「プリント追加」から画像（JPEG/PNG/HEIC）を取り込みます。取り込み後は自動で編集画面へ移動します。" },
    { sel: '[data-nav="today"]', title: "② 今日の復習",     body: "期限が来たQがここに出ます。タップで復習を開始します。" },
    { sel: '#btnBackup',         title: "③ バックアップ（重要）", body: "端末内保存なので、定期的にバックアップ(JSON)を保存しておくと安心です。" },
    { sel: '#btnRestore',        title: "④ 復元",           body: "バックアップJSONを読み込むと、現在データは上書きされます。必要な時だけ実行してください。" },
    { sel: '#btnBatchPrint',     title: "⑤ まとめ印刷（Pro）", body: "複数プリントをまとめて印刷する機能はPro限定です（/pro/?uid=XXXX で有効化）。" },
    { sel: '#btnOpenTerms',      title: "⑥ 利用規約",       body: "共有・再配布禁止など、利用条件はこちらで確認できます。" },
  ],
  add: [
    { sel: '#addTitle',          title: "① タイトル", body: "プリント名を入力します（例：算数プリント 2/16）。後で編集も可能です。" },
    { sel: '#btnPickAddSubject', title: "② 教科を選ぶ", body: "教科を選ぶと、ホーム一覧が教科ごとに整理されます。「その他」は自由記載できます。" },
    { sel: '#addFile',           title: "③ 画像ファイルを選ぶ", body: "JPEG/PNG/HEIC に対応。写真から取り込んでもOKです。" },
    { sel: '#btnCreatePrint',    title: "④ 取り込み & 追加", body: "変換/圧縮して保存します。完了後、自動で編集画面へ移動します。" },
    { sel: '[data-nav="home"]',  title: "⑤ ホームへ戻る", body: "戻って一覧を確認できます。バックアップ/復元はホーム右上です。" },
  ],
  edit: [
    { sel: '#btnNewGroup',       title: "① 新規Q", body: "Q（復習単位）を追加します。QごとにSRSが進みます。" },
    { sel: '#stage',             title: "② 黒塗りを作る", body: "プリント上でドラッグすると黒塗り（マスク）を追加できます。消したい文字も隠せます。" },
    { sel: '#btnRenameGroup',    title: "③ Q名変更", body: "Qのラベルを『問5』『単語②』などに変更できます。" },
    { sel: '#btnEditDone',       title: "④ 編集完了", body: "編集を終えたらここ。作ったQは「今日の復習」に出ます。" },
  ],
  today: [
    { sel: '#btnTodayFilter',    title: "① 教科で絞り込み", body: "教科ごとに復習を絞り込めます。" },
    { sel: '#todayList',         title: "② 期限のQ一覧", body: "期限が来たQが並びます。『復習』で開始します。" },
  ],
  review: [
    { sel: '#reviewStage',       title: "① 透過タップ", body: "黒塗りをタップすると、その部分だけ一時的に透過して答えが見えます（もう一度で戻る）。" },
    { sel: '[data-review-rate="good"]', title: "② 評価してSRS更新", body: "『正解/簡単/難しい/もう一度』で次回の出題間隔が変わります。" },
    { sel: '#btnSkipToday',      title: "③ 今日はスキップ", body: "そのQだけ明日以降に回したいときに使えます。" },
    { sel: '#btnOpenEditFromReview', title: "④ すぐ編集", body: "マスクやQを直したいときはここから編集へ。" },
  ],
};

const TOUR2 = { steps: [], i: 0 };

function detectTourKey(){
  // main route
  const r = state.route || "home";
  // today内のサブビュー判定
  if (!$("#view-review")?.classList.contains("hidden")) return "review";
  if (r === "add") return "add";
  if (r === "edit") return "edit";
  if (r === "today") return "today";
  return "home";
}

function openTour2(forceKey=null){
  const ov = $("#tourOverlay");
  if (!ov) return;

  const key = forceKey || detectTourKey();
  TOUR2.steps = (TOUR_SETS[key] || TOUR_SETS.home).slice();
  TOUR2.i = 0;

  ov.classList.remove("hidden");
  ov.setAttribute("aria-hidden","false");
  positionTour2();
  window.addEventListener("resize", positionTour2);
  window.addEventListener("scroll", positionTour2, true);
}

function closeTour2(markDone){
  const ov = $("#tourOverlay");
  if (!ov) return;
  ov.classList.add("hidden");
  ov.setAttribute("aria-hidden","true");
  window.removeEventListener("resize", positionTour2);
  window.removeEventListener("scroll", positionTour2, true);
  if (markDone) put("ui", { key: "tutorialDone", value: true, updatedAt: now() }).catch(()=>{});
}

function currentTourTarget(){
  const step = TOUR2.steps[clamp(TOUR2.i, 0, TOUR2.steps.length-1)];
  const el = step ? document.querySelector(step.sel) : null;
  return { step, el };
}

function positionTour2(){
  const ov = $("#tourOverlay");
  const spot = $("#tourSpot");
  const tip = $("#tourTip");
  if (!ov || !spot || !tip) return;

  const total = TOUR2.steps.length || 1;
  const { step, el } = currentTourTarget();
  if (!step) return;

  $("#tourStepNo") && ($("#tourStepNo").textContent = String(TOUR2.i + 1));
  $("#tourStepTotal") && ($("#tourStepTotal").textContent = String(total));
  $("#tourTitle") && ($("#tourTitle").textContent = step.title);
  $("#tourBody") && ($("#tourBody").textContent = step.body);

  $("#tourPrev") && ($("#tourPrev").disabled = TOUR2.i === 0);
  const nextBtn = $("#tourNext");
  if (nextBtn) nextBtn.textContent = (TOUR2.i === total - 1) ? "完了" : "次へ";

  // if element not found (e.g. hidden), spotlight center screen
  let rect;
  if (el && el.getClientRects().length) rect = el.getBoundingClientRect();
  else rect = { left: window.innerWidth*0.20, top: window.innerHeight*0.35, width: window.innerWidth*0.60, height: 56 };

  const pad = 8;
  const left = Math.max(8, rect.left - pad);
  const top = Math.max(8, rect.top - pad);
  const width = Math.min(window.innerWidth - 16, rect.width + pad*2);
  const height = Math.min(window.innerHeight - 16, rect.height + pad*2);

  spot.style.left = `${left}px`;
  spot.style.top = `${top}px`;
  spot.style.width = `${Math.max(44, width)}px`;
  spot.style.height = `${Math.max(44, height)}px`;

  // tooltip position: prefer below, else above
  const tipW = Math.min(420, window.innerWidth - 16);
  tip.style.width = `${tipW}px`;

  const belowY = top + height + 12;
  const aboveY = top - 12;
  let tipTop = belowY;
  if (belowY + tip.offsetHeight > window.innerHeight - 8) {
    tipTop = Math.max(8, aboveY - tip.offsetHeight);
  }
  let tipLeft = clamp(left, 8, window.innerWidth - tipW - 8);
  tip.style.left = `${tipLeft}px`;
  tip.style.top = `${tipTop}px`;
}

$("#btnOpenTutorial")?.addEventListener("click", () => openTour2());

$("#tourSkip")?.addEventListener("click", () => closeTour2(true));
$("#tourPrev")?.addEventListener("click", () => { TOUR2.i = Math.max(0, TOUR2.i - 1); positionTour2(); });
$("#tourNext")?.addEventListener("click", () => {
  const total = TOUR2.steps.length;
  if (TOUR2.i >= total - 1) { closeTour2(true); return; }
  TOUR2.i = Math.min(total - 1, TOUR2.i + 1);
  positionTour2();
});

// ESC closes
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const ov = $("#tourOverlay");
    if (ov && !ov.classList.contains("hidden")) closeTour2(true);
  }
});

/* ========= 利用規約（アプリ内ビュー） ========= */
function openTerms(){
  $("#termsModal")?.classList.remove("hidden");
  $("#termsModal")?.setAttribute("aria-hidden","false");
}
function closeTerms(){
  $("#termsModal")?.classList.add("hidden");
  $("#termsModal")?.setAttribute("aria-hidden","true");
}
$("#btnOpenTerms")?.addEventListener("click", openTerms);
$("#termsClose")?.addEventListener("click", closeTerms);
$("#termsBackdrop")?.addEventListener("click", closeTerms);
$("#termsLinkCopy")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("Proの方は、購入時に案内されたURL（/pro/?uid=XXXX）を開くと有効化されます。");
});

function openTutorial(openedByUser=false){
  TOUR.openedByUser = openedByUser;
  TOUR.i = 0;
  renderTutorialStep();
  $("#tutorialModal")?.classList.remove("hidden");
  $("#tutorialModal")?.setAttribute("aria-hidden","false");
}
function closeTutorial(markDone){
  $("#tutorialModal")?.classList.add("hidden");
  $("#tutorialModal")?.setAttribute("aria-hidden","true");
  if (markDone) {
    put("ui", { key: "tutorialDone", value: true, updatedAt: now() }).catch(()=>{});
  }
}
function renderTutorialStep(){
  const total = TOUR.steps.length;
  const step = TOUR.steps[clamp(TOUR.i, 0, total-1)];
  $("#tourStepNo") && ($("#tourStepNo").textContent = String(TOUR.i + 1));
  $("#tourStepTotal") && ($("#tourStepTotal").textContent = String(total));
  $("#tourTitle") && ($("#tourTitle").textContent = step.title);
  $("#tourBody") && ($("#tourBody").innerHTML = step.body);

  const prev = $("#tourPrev");
  const next = $("#tourNext");
  if (prev) prev.disabled = TOUR.i === 0;

  if (next) next.textContent = (TOUR.i === total - 1) ? "完了" : "次へ";
}

$("#btnOpenTutorial")?.addEventListener("click", () => openTutorial(true));
$("#tutorialClose")?.addEventListener("click", () => closeTutorial(false));
$("#tutorialBackdrop")?.addEventListener("click", () => closeTutorial(false));
$("#tourSkip")?.addEventListener("click", () => closeTutorial(true));
$("#tourPrev")?.addEventListener("click", () => { TOUR.i = Math.max(0, TOUR.i - 1); renderTutorialStep(); });
$("#tourNext")?.addEventListener("click", () => {
  const total = TOUR.steps.length;
  if (TOUR.i >= total - 1) { closeTutorial(true); return; }
  TOUR.i = Math.min(total - 1, TOUR.i + 1);
  renderTutorialStep();
});



/* ========= 教科 ========= */
const SUBJECT_ORDER = ["算数","国語","英語","理科","社会","その他"];
function normSubject(s){
  const t = (s || "その他").trim();
  if (!t) return "その他";
  if (SUBJECT_ORDER.includes(t)) return t;
  return t;
}
function subjectClass(s){
  const t = normSubject(s);
  if (t === "算数") return "subj-math";
  if (t === "国語") return "subj-jpn";
  if (t === "英語") return "subj-eng";
  if (t === "理科") return "subj-sci";
  if (t === "社会") return "subj-soc";
  return "subj-oth";
}

/* ========= IndexedDB ========= */
const DB_NAME = "print_srs_lite_pro_db";
const DB_VER = 2;
let dbp = null;

function openDB(){
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("prints")) db.createObjectStore("prints", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages", { keyPath: "id" });
      if (!db.objectStoreNames.contains("groups")) db.createObjectStore("groups", { keyPath: "id" });
      if (!db.objectStoreNames.contains("masks")) db.createObjectStore("masks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("srs")) db.createObjectStore("srs", { keyPath: "groupId" });
      if (!db.objectStoreNames.contains("reviews")) db.createObjectStore("reviews", { keyPath: "id" });
      if (!db.objectStoreNames.contains("skips")) db.createObjectStore("skips", { keyPath: "groupId" });
      if (!db.objectStoreNames.contains("ui")) db.createObjectStore("ui", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(storeNames, mode, fn){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    const stores = {};
    storeNames.forEach(n => stores[n] = t.objectStore(n));
    Promise.resolve(fn(stores))
      .then(res => {
        t.oncomplete = () => resolve(res);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
      .catch(reject);
  });
}
async function put(store, value){ return tx([store], "readwrite", (s) => s[store].put(value)); }
async function del(store, key){ return tx([store], "readwrite", (s) => s[store].delete(key)); }
async function get(store, key){
  return tx([store], "readonly", (s) => new Promise((res, rej) => {
    const r = s[store].get(key);
    r.onsuccess = () => res(r.result ?? null);
    r.onerror = () => rej(r.error);
  }));
}
async function getAll(store){
  return tx([store], "readonly", (s) => new Promise((res, rej) => {
    const r = s[store].getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  }));
}

/* ========= SRS ========= */
function initSrsState(groupId){
  const t = now();
  return {
    groupId,
    difficulty: 5.0,
    stability: 1.0,
    lastReviewedAt: null,
    nextDueAt: t,
    reviewCount: 0,
    lapseCount: 0,
    updatedAt: t,
  };
}
function updateSrs(prev, rating){
  const t = now();
  const d = prev.difficulty;
  const s = prev.stability;

  const dDelta =
    rating === "again" ? +1.2 :
    rating === "hard"  ? +0.6 :
    rating === "good"  ? -0.1 :
                         -0.5;

  const newD = clamp(d + dDelta, 1.0, 10.0);
  const diffFactor = 1.0 - (newD - 1.0) / 20.0;

  let newS = s;
  if (rating === "again") newS = Math.max(0.5, s * 0.35);
  else if (rating === "hard") newS = Math.max(0.8, s * (1.25 * diffFactor));
  else if (rating === "good") newS = Math.max(1.0, s * (1.9 * diffFactor));
  else newS = Math.max(2.0, s * (2.6 * diffFactor));

  const intervalDays =
    rating === "again" ? 1 :
    rating === "hard"  ? Math.max(2, Math.round(newS * 0.7)) :
    rating === "good"  ? Math.max(3, Math.round(newS)) :
                         Math.max(7, Math.round(newS * 1.4));

  // 「もう一度」は短時間で再提示したいので、10分固定（表示も＜10分）
  const intervalMs =
    rating === "again" ? 10 * 60 * 1000 :
    intervalDays * dayMs;

  return {
    ...prev,
    difficulty: newD,
    stability: newS,
    lastReviewedAt: t,
    nextDueAt: t + intervalMs,
    reviewCount: prev.reviewCount + 1,
    lapseCount: prev.lapseCount + (rating === "again" ? 1 : 0),
    updatedAt: t,
  };
}

/* ========= Image load / HEIC / compress ========= */
function isHeicLike(file){
  const name = (file.name || "").toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}
async function fileToBitmap(file){
  if (isHeicLike(file)) {
    if (!window.heic2any) throw new Error("heic2anyが読み込めません（ネット接続確認）");
    try {
      const jpegBlob = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
      return await createImageBitmap(jpegBlob);
    } catch {
      throw new Error("HEIC変換に失敗（非対応の可能性）。PNG/JPEGでお願いします。");
    }
  }
  return await createImageBitmap(file);
}
async function compressBitmapToJpegBlob(bitmap){
  const scale = Math.min(1, CFG.maxW / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cctx = c.getContext("2d");
  cctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", CFG.jpegQ));
  return { blob, width: w, height: h };
}

/* ========= State & Cache ========= */
const state = {
  route: "home",
  currentPrintId: null,
  currentGroupId: null,
  selectedMaskIds: new Set(),
  selectedPrintIds: new Set(),

  zoom: 1,
  panX: 0,
  panY: 0,

  revealedMaskIds: new Set(),

  reviewQueue: [],
  reviewIndex: -1,
  doneTodayCount: 0,

  collapsedSubjects: new Set(),
  toastTimer: null,

  todaySubjectFilter: null,

  // 任意学習（HOME→Q選択→開始）中は、今日の復習一覧を混ぜない
  practiceMode: false,

  picker: {
    open: false,
    printId: null,
    page: null,
    bitmap: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedGroupIds: new Set(),
  },

  // 印刷設定
  print: {
    mode: null,            // "single" | "batch"
    targets: [],           // print objects [{id,title,subject}]
    paper: "A4",           // "A4" | "A3"
    orientation: "portrait"// "portrait" | "landscape"
  }
};

let cache = { prints:[], pages:[], groups:[], masks:[], srs:[], reviews:[], skips:[], ui:[] };

async function refreshCache(){
  const [prints, pages, groups, masks, srs, reviews, skips, ui] = await Promise.all([
    getAll("prints"), getAll("pages"), getAll("groups"), getAll("masks"),
    getAll("srs"), getAll("reviews"), getAll("skips"),
    getAll("ui"),
  ]);
  cache = { prints, pages, groups, masks, srs, reviews, skips, ui };
}

/* ========= View show/hide ========= */
function show(viewId){
  const MAIN_VIEWS = ["#view-home","#view-add","#view-edit","#view-today"];
  const TODAY_SUBVIEWS = ["#view-review","#view-done"];

  // hide all main views
  MAIN_VIEWS.forEach(id => $(id)?.classList.add("hidden"));
  // hide today subviews (they are nested inside #view-today in HTML)
  TODAY_SUBVIEWS.forEach(id => $(id)?.classList.add("hidden"));

  // If showing a today-subview, keep #view-today visible.
  if (TODAY_SUBVIEWS.includes(viewId)) {
    $("#view-today")?.classList.remove("hidden");
  }

  $(viewId)?.classList.remove("hidden");
}

/* ========= Router ========= */
async function nav(to){
  state.route = to;
  try {
    if (to === "home") { state.currentPrintId = null; await renderHome(); }
    else if (to === "add") renderAdd();
    else if (to === "edit") await renderEdit();
    else if (to === "today") { state.practiceMode = false; await renderToday(); }
  } catch (e) {
    console.error("nav error:", e);
    alert("画面更新中にエラーが出ました。コンソール(DevTools)に詳細があります。");
  }
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-nav]");
  if (!btn) return;
  const to = btn.getAttribute("data-nav");
  nav(to);
});

/* ========= UI: Toast ========= */
function showHomeToast(msg){
  const el = $("#homeToast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.add("hidden"), CFG.toastMs);
}

/* ========= UI: Collapsed subjects persistence ========= */
async function loadCollapsedSubjects(){
  try {
    const rec = await get("ui", "collapsedSubjects");
    if (rec && rec.value && Array.isArray(rec.value)) {
      state.collapsedSubjects = new Set(rec.value);
    }
  } catch {}
}
async function saveCollapsedSubjects(){
  try {
    await put("ui", { key: "collapsedSubjects", value: Array.from(state.collapsedSubjects), updatedAt: now() });
  } catch {}
}

/* ========= Due + skip ========= */
function startOfTomorrowMs(){
  const d = new Date();
  d.setHours(24,0,0,0);
  return d.getTime();
}
function isSkipped(groupId){
  const s = cache.skips.find((x) => x.groupId === groupId);
  if (!s) return false;
  return s.skipUntil && s.skipUntil > now();
}
function computeDueGroups(){
  const t = now();
  const srsMap = new Map(cache.srs.map((s) => [s.groupId, s]));
  return cache.groups
    .filter((g) => g.isActive)
    .map((g) => ({ g, s: srsMap.get(g.id) }))
    .filter((x) => x.s && x.s.nextDueAt != null && x.s.nextDueAt <= t)
    .filter((x) => !isSkipped(x.g.id))
    .sort((a, b) => a.s.nextDueAt - b.s.nextDueAt);
}
async function skipToday(groupId){
  const until = startOfTomorrowMs();
  await put("skips", { groupId, skipUntil: until });
  await refreshCache();
}

/* ========= Delete (cascade) ========= */
async function deletePrintCascade(printId){
  await refreshCache();
  const pages = cache.pages.filter((p) => p.printId === printId);
  const groups = cache.groups.filter((g) => g.printId === printId);
  const masks = cache.masks.filter((m) => m.printId === printId);
  const groupIds = new Set(groups.map((g) => g.id));
  const reviews = cache.reviews.filter((r) => groupIds.has(r.groupId));
  const srs = cache.srs.filter((s) => groupIds.has(s.groupId));
  const skips = cache.skips.filter((x) => groupIds.has(x.groupId));

  await tx(["prints","pages","groups","masks","srs","reviews","skips"], "readwrite", (st) => {
    st.prints.delete(printId);
    pages.forEach((x) => st.pages.delete(x.id));
    groups.forEach((x) => st.groups.delete(x.id));
    masks.forEach((x) => st.masks.delete(x.id));
    srs.forEach((x) => st.srs.delete(x.groupId));
    reviews.forEach((x) => st.reviews.delete(x.id));
    skips.forEach((x) => st.skips.delete(x.groupId));
  });
}
async function deletePrintsCascade(printIds){
  for (const id of printIds) await deletePrintCascade(id);
}

/* ========= HOME selection UI ========= */
function updateHomeSelectionUI(){
  const n = state.selectedPrintIds.size;

  const btnDel = $("#btnDeleteSelected");
  const btnMove = $("#btnMoveSelected");
  const btnBatch = $("#btnBatchPrint");

  if (btnDel) {
    btnDel.disabled = n === 0;
    btnDel.textContent = n === 0 ? "選択したプリントを削除" : `選択したプリントを削除（${n}件）`;
  }
  if (btnMove) {
    btnMove.disabled = n === 0;
    btnMove.textContent = n === 0 ? "選択プリントを移動" : `選択プリントを移動（${n}件）`;
  }
  if (btnBatch) {
    btnBatch.disabled = n === 0;
    btnBatch.textContent = n === 0 ? "選択をまとめて印刷（Pro）" : `選択をまとめて印刷（Pro）（${n}件）`;
  }

  const hint = $("#proHintHome");
  if (hint) {
    if (PRO.enabled) {
      hint.textContent = `Pro有効：Licensed ID: ${PRO.licensedId}（まとめ印刷が使えます）`;
    } else if (PRO.isProPath && !PRO.licensedId) {
      hint.textContent = "Proページですが購入ID(uid)がありません。購入時URLで開いてください。";
    } else {
      hint.textContent = "無料版：単体印刷（A4/A3）は使えます。まとめ印刷はPro限定です。";
    }
  }
}

/* ========= HOME render ========= */
function getAllSubjectsFromPrints(){
  const set = new Set();
  cache.prints.forEach(p => set.add(normSubject(p.subject)));
  SUBJECT_ORDER.forEach(s => set.add(s));
  const std = SUBJECT_ORDER.slice();
  const custom = Array.from(set).filter(s => !SUBJECT_ORDER.includes(s)).sort((a,b)=>a.localeCompare(b,'ja'));
  return std.concat(custom);
}
function groupPrintsBySubject(prints){
  const map = new Map();
  for (const p of prints) {
    const subj = normSubject(p.subject);
    if (!map.has(subj)) map.set(subj, []);
    map.get(subj).push(p);
  }
  for (const [k, arr] of map.entries()) {
    arr.sort((a,b) => b.createdAt - a.createdAt);
  }
  return map;
}

function renderOnePrintItem(p){
  const gCount = cache.groups.filter((g) => g.printId === p.id).length;
  const mCount = cache.masks.filter((m) => m.printId === p.id).length;
  const checked = state.selectedPrintIds.has(p.id);

  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <div class="row space wrap">
      <div class="row wrap" style="align-items:flex-start; gap:10px;">
        <input class="checkbox" type="checkbox" data-print-check="${p.id}" ${checked ? "checked" : ""}/>
        <div>
          <div class="itemTitle">${escapeHtml(p.title)}</div>
          <div class="muted small">${escapeHtml(normSubject(p.subject))} / ${new Date(p.createdAt).toLocaleDateString()} / Q:${gCount} / mask:${mCount}</div>
        </div>
      </div>
      <div class="row wrap">
        <button class="btn" data-open-edit="${p.id}">編集</button>
        <button class="btn" data-open-print-one="${p.id}">単体印刷</button>
        <button class="btn primary" data-open-practice="${p.id}">このプリントを復習</button>
        <button class="btn danger" data-del-print="${p.id}">削除</button>
      </div>
    </div>
  `;

  el.querySelector(`[data-print-check="${p.id}"]`)?.addEventListener("change", (ev) => {
    const on = ev.target.checked;
    if (on) state.selectedPrintIds.add(p.id);
    else state.selectedPrintIds.delete(p.id);
    updateHomeSelectionUI();
  });

  el.querySelector("[data-open-edit]")?.addEventListener("click", () => {
    state.currentPrintId = p.id;
    state.currentGroupId = null;
    state.selectedMaskIds.clear();
    nav("edit");
  });

  el.querySelector("[data-open-print-one]")?.addEventListener("click", async () => {
    await openPrintSheetSingle(p.id);
  });

  el.querySelector("[data-open-practice]")?.addEventListener("click", async () => {
    await openPracticePicker(p.id);
  });

  el.querySelector("[data-del-print]")?.addEventListener("click", async () => {
    if (!confirm(`「${p.title}」を削除します（関連データも全部消えます）`)) return;
    await deletePrintCascade(p.id);
    state.selectedPrintIds.delete(p.id);
    await renderHome();
  });

  return el;
}

async function renderHome(){
  await refreshCache();
  show("#view-home");
  renderProGateBanner();
  renderLicensedBadge();

  const due = computeDueGroups();
  $("#dueCount") && ($("#dueCount").textContent = String(due.length));

  updateHomeSelectionUI();

  const list = $("#printList");
  if (!list) return;
  list.innerHTML = "";

  const prints = cache.prints.slice().sort((a,b)=>b.createdAt-a.createdAt);
  if (prints.length === 0) {
    list.innerHTML = `<div class="item muted">まだプリントがありません</div>`;
    return;
  }

  const bySubj = groupPrintsBySubject(prints);
  const subjects = getAllSubjectsFromPrints();

  for (const subj of subjects) {
    const arr = bySubj.get(subj);
    if (!arr || arr.length === 0) continue;

    const collapsed = state.collapsedSubjects.has(subj);

    const header = document.createElement("div");
    header.className = `subjectHeader ${subjectClass(subj)}`;
    header.innerHTML = `
      <div class="left">
        <div class="bar"></div>
        <div>
          <div class="title">${escapeHtml(subj)}</div>
          <div class="meta">プリント ${arr.length} 件</div>
        </div>
      </div>
      <div class="chev">${collapsed ? "▶" : "▼"}</div>
    `;
    header.addEventListener("click", async () => {
      if (state.collapsedSubjects.has(subj)) state.collapsedSubjects.delete(subj);
      else state.collapsedSubjects.add(subj);
      await saveCollapsedSubjects();
      await renderHome();
    });
    list.appendChild(header);

    if (!collapsed) {
      const box = document.createElement("div");
      box.className = "subjectBox";
      for (const p of arr) {
        box.appendChild(renderOnePrintItem(p));
      }
      list.appendChild(box);
    }
  }
}

/* ========= HOME controls ========= */
$("#btnSelectAll")?.addEventListener("click", async () => {
  await refreshCache();
  cache.prints.forEach(p => state.selectedPrintIds.add(p.id));
  await renderHome();
});
$("#btnClearSelect")?.addEventListener("click", async () => {
  state.selectedPrintIds.clear();
  await renderHome();
});
$("#btnDeleteSelected")?.addEventListener("click", async () => {
  const ids = Array.from(state.selectedPrintIds);
  if (ids.length === 0) return;
  if (!confirm(`選択したプリント ${ids.length} 件を削除します（関連データも全部消えます）`)) return;
  await deletePrintsCascade(ids);
  state.selectedPrintIds.clear();
  await renderHome();
});

/* ========= Subject Sheet (bottom sheet) ========= */
const subjectSheet = $("#subjectSheet");
const subjectSheetList = $("#subjectSheetList");
const subjectOtherWrap = $("#subjectOtherWrap");
const subjectOtherInput = $("#subjectOtherInput");
const subjectSheetTitle = $("#subjectSheetTitle");
const subjectSheetSub = $("#subjectSheetSub");

let subjectSheetCtx = null;

function openSubjectSheet(ctx){
  subjectSheetCtx = ctx;
  if (subjectSheetTitle) subjectSheetTitle.textContent = ctx.title || "教科を選択";
  if (subjectSheetSub) subjectSheetSub.textContent = ctx.subtitle || (ctx.mode === "multi" ? "複数選択できます" : "1つ選んでください");

  if (!subjectSheetList) return;
  subjectSheetList.innerHTML = "";

  const selected = new Set(ctx.initial ? Array.from(ctx.initial) : []);
  let otherText = "";

  if (ctx.mode === "single") {
    const only = Array.from(selected)[0] || "";
    if (only && !SUBJECT_ORDER.includes(only)) {
      otherText = only;
      selected.clear();
      selected.add("その他");
    }
  }

  function render(){
    const isOtherSelected = selected.has("その他") && ctx.allowOtherFreeText;
    if (subjectOtherWrap) subjectOtherWrap.classList.toggle("hidden", !isOtherSelected);
    if (subjectOtherInput && isOtherSelected && otherText) subjectOtherInput.value = otherText;
    if (subjectOtherInput && !isOtherSelected) subjectOtherInput.value = "";
  }

  const subjects = ctx.subjects || SUBJECT_ORDER;
  subjects.forEach((s) => {
    const item = document.createElement("div");
    item.className = "sheetItem";
    item.setAttribute("data-subj", s);
    const on = selected.has(s);
    if (on) item.classList.add("on");
    item.innerHTML = `
      <div>${escapeHtml(s)}</div>
      <div style="font-weight:900; opacity:${on?1:0};">✓</div>
    `;
    item.addEventListener("click", () => {
      if (ctx.mode === "single") {
        selected.clear();
        selected.add(s);
      } else {
        if (selected.has(s)) selected.delete(s);
        else selected.add(s);
      }
      if (!selected.has("その他")) otherText = "";
      $$(".sheetItem").forEach((x) => x.classList.remove("on"));
      $$(".sheetItem").forEach((x) => {
        const ss = x.getAttribute("data-subj");
        if (selected.has(ss)) x.classList.add("on");
        x.lastElementChild.style.opacity = selected.has(ss) ? "1" : "0";
      });
      render();
    });
    subjectSheetList.appendChild(item);
  });

  if (subjectOtherInput) {
    subjectOtherInput.value = otherText || "";
    subjectOtherInput.oninput = () => {
      otherText = subjectOtherInput.value || "";
    };
  }

  render();

  subjectSheet?.classList.remove("hidden");
  subjectSheet?.setAttribute("aria-hidden", "false");
}
function closeSubjectSheet(){
  subjectSheet?.classList.add("hidden");
  subjectSheet?.setAttribute("aria-hidden", "true");
  subjectSheetCtx = null;
  if (subjectOtherInput) subjectOtherInput.value = "";
  if (subjectOtherWrap) subjectOtherWrap.classList.add("hidden");
}
$("#subjectSheetClose")?.addEventListener("click", () => {
  subjectSheetCtx?.onCancel?.();
  closeSubjectSheet();
});
$("#subjectSheetCancel")?.addEventListener("click", () => {
  subjectSheetCtx?.onCancel?.();
  closeSubjectSheet();
});
$(".sheetBackdrop")?.addEventListener("click", () => {
  subjectSheetCtx?.onCancel?.();
  closeSubjectSheet();
});
$("#subjectSheetOk")?.addEventListener("click", () => {
  if (!subjectSheetCtx) return;

  const selectedEls = $$(".sheetItem.on");
  const selected = new Set(selectedEls.map(el => el.getAttribute("data-subj")));
  let otherText = (subjectOtherInput?.value || "").trim();

  if (subjectSheetCtx.allowOtherFreeText && selected.has("その他")) {
    if (otherText) {
      if (subjectSheetCtx.mode === "single") {
        selected.clear();
        selected.add(otherText);
      } else {
        selected.delete("その他");
        selected.add(otherText);
      }
    } else {
      if (subjectSheetCtx.mode === "single") {
        selected.clear();
        selected.add("その他");
      }
    }
  }

  subjectSheetCtx.onOk?.(selected, otherText);
  closeSubjectSheet();
});

/* ========= ADD ========= */
function renderAdd(){
  show("#view-add");
  $("#addStatus") && ($("#addStatus").textContent = "");
  $("#addTitle") && ($("#addTitle").value = `プリント ${new Date().toLocaleDateString()}`);
  $("#addSubject") && ($("#addSubject").value = "算数");
  $("#addFile") && ($("#addFile").value = "");
}
$("#btnPickAddSubject")?.addEventListener("click", async () => {
  await refreshCache();
  const subjects = getAllSubjectsFromPrints();
  const current = normSubject($("#addSubject")?.value || "算数");
  openSubjectSheet({
    mode: "single",
    title: "教科を選択（プリント追加）",
    subtitle: "「その他」は自由記載できます",
    subjects,
    initial: new Set([current]),
    allowOtherFreeText: true,
    onOk: (sel) => {
      const v = Array.from(sel)[0] || "その他";
      $("#addSubject") && ($("#addSubject").value = v);
    },
    onCancel: () => {}
  });
});

$("#btnCreatePrint")?.addEventListener("click", async () => {
  const title = ($("#addTitle")?.value || "").trim() || `プリント ${new Date().toLocaleDateString()}`;
  const subject = normSubject($("#addSubject")?.value || "その他");
  const file = $("#addFile")?.files && $("#addFile").files[0];
  if (!file) { $("#addStatus") && ($("#addStatus").textContent = "画像ファイルを選んでください。"); return; }

  $("#addStatus") && ($("#addStatus").textContent = "取り込み中（変換/圧縮）...");
  try {
    const bitmap = await fileToBitmap(file);
    const { blob, width, height } = await compressBitmapToJpegBlob(bitmap);

    const printId = uid();
    const pageId = uid();
    const t = now();
    const print = { id: printId, title, subject, createdAt: t };
    const page = { id: pageId, printId, pageIndex: 0, image: blob, width, height };

    const groupId = uid();
    const group = { id: groupId, printId, pageIndex: 0, label: "Q1", orderIndex: 0, isActive: true, createdAt: t };
    const srs = initSrsState(groupId);

    await tx(["prints","pages","groups","srs"], "readwrite", (s) => {
      s.prints.put(print);
      s.pages.put(page);
      s.groups.put(group);
      s.srs.put(srs);
    });

    state.currentPrintId = printId;
    state.currentGroupId = groupId;
    state.selectedMaskIds.clear();

    $("#addStatus") && ($("#addStatus").textContent = "追加しました。編集画面へ移動します…");
    await nav("edit");
  } catch (err) {
    console.error(err);
    $("#addStatus") && ($("#addStatus").textContent = `失敗：${err.message || err}`);
  }
});

/* ========= EDIT ========= */
const canvas = $("#canvas");
const ctx = canvas?.getContext("2d");
let editImgBitmap = null;
let editPage = null;

const pointersEdit = new Map();
let longPressTimer = null;
let longPressActive = false;

let drag = {
  mode: "none",
  sx: 0, sy: 0,
  ex: 0, ey: 0,
  startPanX: 0, startPanY: 0,
  movingMaskId: null,
  maskStart: null,
  worldStart: null,
};

function getCanvasPoint(cvs, e){
  const rect = cvs.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function clearLongPress(){
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressActive = false;
}
function screenToWorld(x, y){
  return { x: (x - state.panX) / state.zoom, y: (y - state.panY) / state.zoom };
}
function fitToStage(stageSel, cvs, page){
  const stage = $(stageSel);
  if (!stage || !page) return;
  const sw = stage.clientWidth;
  const sh = stage.clientHeight;
  const zx = sw / page.width;
  const zy = sh / page.height;
  state.zoom = Math.min(zx, zy);
  state.panX = (sw - page.width * state.zoom) / 2;
  state.panY = (sh - page.height * state.zoom) / 2;
}

function hitTestMaskEdit(sx, sy){
  if (!editPage) return null;
  const w = screenToWorld(sx, sy);
  const nx = w.x / editPage.width;
  const ny = w.y / editPage.height;

  const masks = cache.masks.filter((m) => m.printId === state.currentPrintId);
  for (let i = masks.length - 1; i >= 0; i--) {
    const m = masks[i];
    if (nx >= m.x && nx <= m.x + m.w && ny >= m.y && ny <= m.y + m.h) return m;
  }
  return null;
}
function drawMaskLabel(ctx2d, label, x, y, zoomScale){
  if (!label) return;
  ctx2d.save();
  ctx2d.font = `${12 / zoomScale}px sans-serif`;
  ctx2d.fillStyle = "rgba(255,255,255,0.95)";
  ctx2d.strokeStyle = "rgba(0,0,0,0.7)";
  ctx2d.lineWidth = 3 / zoomScale;
  ctx2d.strokeText(label, x, y);
  ctx2d.fillText(label, x, y);
  ctx2d.restore();
}

function drawEdit(){
  if (!ctx || !editImgBitmap || !editPage) return;
  const stage = $("#stage");
  if (!stage) return;

  const w = stage.clientWidth;
  const h = stage.clientHeight;
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const gMap = new Map(cache.groups.map(g => [g.id, g]));

  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);
  ctx.drawImage(editImgBitmap, 0, 0);

  const masks = cache.masks.filter((m) => m.printId === state.currentPrintId);
  masks.forEach((m) => {
    const isCur = m.groupId === state.currentGroupId;
    const isSel = state.selectedMaskIds.has(m.id);

    const rx = m.x * editPage.width;
    const ry = m.y * editPage.height;
    const rw = m.w * editPage.width;
    const rh = m.h * editPage.height;

    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(rx, ry, rw, rh);

    const gl = gMap.get(m.groupId)?.label || "";
    if (gl) drawMaskLabel(ctx, gl, rx + 4 / state.zoom, ry + 14 / state.zoom, state.zoom);

    if (isCur) {
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = (isSel ? 4 : 2) / state.zoom;
      ctx.strokeRect(rx, ry, rw, rh);
    }
    if (isSel) {
      ctx.strokeStyle = "#ffd34d";
      ctx.lineWidth = 6 / state.zoom;
      ctx.strokeRect(rx, ry, rw, rh);
    }
    ctx.restore();
  });

  ctx.restore();

  if (drag.mode === "draw") {
    const x1 = Math.min(drag.sx, drag.ex);
    const y1 = Math.min(drag.sy, drag.ey);
    const x2 = Math.max(drag.sx, drag.ex);
    const y2 = Math.max(drag.sy, drag.ey);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffd34d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.restore();
  }
}

async function ensureEditLoaded(){
  if (!state.currentPrintId) throw new Error("printIdがありません");
  await refreshCache();

  editPage = cache.pages.find((p) => p.printId === state.currentPrintId && p.pageIndex === 0);
  if (!editPage) throw new Error("ページが見つかりません");
  editImgBitmap = await createImageBitmap(editPage.image);

  const groups = cache.groups.filter((g) => g.printId === state.currentPrintId).sort((a,b)=>a.orderIndex-b.orderIndex);
  if (!groups[0]) {
    await createGroup();
    await refreshCache();
  }
  const groups2 = cache.groups.filter((g) => g.printId === state.currentPrintId).sort((a,b)=>a.orderIndex-b.orderIndex);
  if (!state.currentGroupId) state.currentGroupId = groups2[0]?.id || null;
}

async function renderEdit(){
  await ensureEditLoaded();
  show("#view-edit");
  renderProGateBanner();
  renderLicensedBadge();

  await refreshCache();
  updateEditHeaderClickable();

  await renderEditSidebar();
  state.selectedMaskIds.clear();
  updateSelUI();

  requestAnimationFrame(() => {
    fitToStage("#stage", canvas, editPage);
    drawEdit();
  });
}

async function renderEditSidebar(){
  await refreshCache();
  const printId = state.currentPrintId;
  const groups = cache.groups.filter((g) => g.printId === printId).sort((a,b)=>a.orderIndex-b.orderIndex);
  const masks = cache.masks.filter((m) => m.printId === printId);

  const list = $("#groupList");
  if (!list) return;
  list.innerHTML = "";

  groups.forEach((g, idx) => {
    const count = masks.filter((m) => m.groupId === g.id).length;
    const active = g.id === state.currentGroupId;

    const el = document.createElement("div");
    el.className = "item";
    el.setAttribute("data-due-item", g.id);
    el.style.borderColor = active ? "rgba(63,124,255,.7)" : "";
    el.innerHTML = `
      <div class="row space wrap">
        <div>
          <div class="itemTitle">${escapeHtml(g.label || "(ラベルなし)")}</div>
          <div class="muted small">マスク ${count}</div>
        </div>
        <div class="qctl">
          <button class="qbtn" data-q-up="${g.id}" ${idx===0?"disabled":""}>↑</button>
          <button class="qbtn" data-q-down="${g.id}" ${idx===groups.length-1?"disabled":""}>↓</button>
          <button class="btn" data-sel-group="${g.id}">選択</button>
        </div>
      </div>
    `;

    el.querySelector("[data-sel-group]")?.addEventListener("click", () => {
      state.currentGroupId = g.id;
      state.selectedMaskIds.clear();
      updateSelUI();
      renderEditSidebar();
      drawEdit();
    });
    el.querySelector("[data-q-up]")?.addEventListener("click", async () => { await moveGroupOrder(g.id, -1); });
    el.querySelector("[data-q-down]")?.addEventListener("click", async () => { await moveGroupOrder(g.id, +1); });

    list.appendChild(el);
  });

  const cur = groups.find((g) => g.id === state.currentGroupId);
  $("#currentGroupLabel") && ($("#currentGroupLabel").textContent = cur?.label || "(未選択)");
  $("#currentGroupMaskCount") && ($("#currentGroupMaskCount").textContent = String(masks.filter((m) => m.groupId === state.currentGroupId).length));

  $("#btnRenameGroup") && ($("#btnRenameGroup").disabled = !state.currentGroupId);
  $("#btnDeleteGroup") && ($("#btnDeleteGroup").disabled = !state.currentGroupId);
}

async function moveGroupOrder(groupId, delta){
  await refreshCache();
  const printId = state.currentPrintId;
  const groups = cache.groups.filter((g) => g.printId === printId).sort((a,b)=>a.orderIndex-b.orderIndex);
  const i = groups.findIndex((g) => g.id === groupId);
  if (i < 0) return;
  const j = i + delta;
  if (j < 0 || j >= groups.length) return;

  const a = groups[i];
  const b = groups[j];
  const tmp = a.orderIndex;
  a.orderIndex = b.orderIndex;
  b.orderIndex = tmp;

  await tx(["groups"], "readwrite", (s) => { s.groups.put(a); s.groups.put(b); });
  await renderEditSidebar();
  drawEdit();
}

function updateSelUI(){
  $("#selCount") && ($("#selCount").textContent = String(state.selectedMaskIds.size));
  $("#btnMoveSel") && ($("#btnMoveSel").disabled = !state.currentGroupId || state.selectedMaskIds.size === 0);
  $("#btnDeleteSel") && ($("#btnDeleteSel").disabled = state.selectedMaskIds.size === 0);
  $("#btnClearSel") && ($("#btnClearSel").disabled = state.selectedMaskIds.size === 0);
}

async function createGroup(){
  const printId = state.currentPrintId;
  const groups = cache.groups.filter((g) => g.printId === printId).sort((a,b)=>a.orderIndex-b.orderIndex);
  const idx = groups.length;
  const groupId = uid();
  const t = now();
  const g = { id: groupId, printId, pageIndex: 0, label: `Q${idx + 1}`, orderIndex: idx, isActive: true, createdAt: t };
  await tx(["groups","srs"], "readwrite", (s) => {
    s.groups.put(g);
    s.srs.put(initSrsState(groupId));
  });
  state.currentGroupId = groupId;
}

async function renameCurrentPrint(){
  await refreshCache();
  const p = cache.prints.find(x => x.id === state.currentPrintId);
  if (!p) return;

  const v = window.prompt("プリント名を変更", p.title || "");
  if (v === null) return;
  p.title = v.trim() || p.title;
  await put("prints", p);
  await refreshCache();
  updateEditHeaderClickable();
}
async function changeCurrentSubjectSheet(){
  await refreshCache();
  const p = cache.prints.find(x => x.id === state.currentPrintId);
  if (!p) return;

  const subjects = getAllSubjectsFromPrints();
  const current = normSubject(p.subject);

  openSubjectSheet({
    mode: "single",
    title: "教科を変更",
    subtitle: "「その他」は自由記載できます",
    subjects,
    initial: new Set([current]),
    allowOtherFreeText: true,
    onOk: async (sel) => {
      const v = Array.from(sel)[0] || "その他";
      p.subject = normSubject(v);
      await put("prints", p);
      await refreshCache();
      updateEditHeaderClickable();
    },
    onCancel: () => {}
  });
}

function updateEditHeaderClickable(){
  const p = cache.prints.find((x) => x.id === state.currentPrintId);
  const titleEl = $("#editTitle");
  const metaEl = $("#editMeta");
  if (titleEl) {
    titleEl.innerHTML = `編集：${escapeHtml(p ? p.title : "")} <span class="hint">✏️ タップで名前変更</span>`;
    titleEl.style.cursor = "pointer";
  }
  if (metaEl) {
    metaEl.innerHTML = `${escapeHtml(p ? normSubject(p.subject) : "")} / ${p ? new Date(p.createdAt).toLocaleDateString() : ""} <span class="hint">✏️ タップで教科変更</span>`;
    metaEl.style.cursor = "pointer";
  }
  if (titleEl) titleEl.onclick = () => renameCurrentPrint();
  if (metaEl) metaEl.onclick = () => changeCurrentSubjectSheet();
}

$("#btnFit")?.addEventListener("click", () => { fitToStage("#stage", canvas, editPage); drawEdit(); });
$("#btnZoomIn")?.addEventListener("click", () => { state.zoom = Math.min(6, state.zoom * 1.25); drawEdit(); });
$("#btnZoomOut")?.addEventListener("click", () => { state.zoom = Math.max(0.2, state.zoom / 1.25); drawEdit(); });

$("#btnNewGroup")?.addEventListener("click", async () => {
  await ensureEditLoaded();
  await createGroup();
  await renderEditSidebar();
  drawEdit();
});
$("#btnRenameGroup")?.addEventListener("click", async () => {
  const g = cache.groups.find((x) => x.id === state.currentGroupId);
  if (!g) return;
  const label = window.prompt("Qラベル（例：Q3 / 問5 / 単語②）", g.label || "");
  if (label === null) return;
  g.label = label;
  await put("groups", g);
  await refreshCache();
  await renderEditSidebar();
  drawEdit();
});
$("#btnDeleteGroup")?.addEventListener("click", async () => {
  const g = cache.groups.find((x) => x.id === state.currentGroupId);
  if (!g) return;
  if (!confirm(`${g.label || "このQ"} を削除します（マスクも消えます）`)) return;

  const masks = cache.masks.filter((m) => m.groupId === g.id);
  await tx(["groups","masks","srs","reviews","skips"], "readwrite", (s) => {
    s.groups.delete(g.id);
    s.srs.delete(g.id);
    s.skips.delete(g.id);
    cache.reviews.filter((r) => r.groupId === g.id).forEach((r) => s.reviews.delete(r.id));
    masks.forEach((m) => s.masks.delete(m.id));
  });

  state.currentGroupId = null;
  state.selectedMaskIds.clear();
  await refreshCache();

  const gg = cache.groups.filter((x) => x.printId === state.currentPrintId).sort((a,b)=>a.orderIndex-b.orderIndex);
  state.currentGroupId = gg[0]?.id || null;

  await renderEditSidebar();
  drawEdit();
});

$("#btnClearSel")?.addEventListener("click", () => {
  state.selectedMaskIds.clear();
  updateSelUI();
  drawEdit();
});
$("#btnDeleteSel")?.addEventListener("click", async () => {
  const ids = Array.from(state.selectedMaskIds);
  if (ids.length === 0) return;
  if (!confirm(`選択マスク ${ids.length} 件を削除します`)) return;

  await tx(["masks"], "readwrite", (s) => { ids.forEach((id) => s.masks.delete(id)); });
  state.selectedMaskIds.clear();
  await refreshCache();
  await renderEditSidebar();
  updateSelUI();
  drawEdit();
});
$("#btnMoveSel")?.addEventListener("click", async () => {
  const gid = state.currentGroupId;
  if (!gid) return;
  const ids = Array.from(state.selectedMaskIds);
  if (ids.length === 0) return;

  await tx(["masks"], "readwrite", (s) => {
    ids.forEach((id) => {
      const m = cache.masks.find((x) => x.id === id);
      if (!m) return;
      m.groupId = gid;
      s.masks.put(m);
    });
  });

  state.selectedMaskIds.clear();
  await refreshCache();
  await renderEditSidebar();
  updateSelUI();
  drawEdit();
});

$("#btnEditDone")?.addEventListener("click", async () => {
  await put("ui", { key: "lastToast", value: "編集完了しました", updatedAt: now() });
  await nav("home");
  const rec = await get("ui", "lastToast");
  if (rec?.value) {
    showHomeToast(String(rec.value));
    await del("ui", "lastToast");
  }
});

/* ---- Edit pointer handling ---- */
canvas?.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = getCanvasPoint(canvas, e);
  pointersEdit.set(e.pointerId, p);

  clearLongPress();
  longPressTimer = setTimeout(() => {
    longPressActive = true;
    drag.mode = "pan";
    drag.sx = p.x; drag.sy = p.y;
    drag.startPanX = state.panX;
    drag.startPanY = state.panY;
  }, CFG.longPressMs);

  if (e.shiftKey) {
    clearLongPress();
    drag.mode = "pan";
    drag.sx = p.x; drag.sy = p.y;
    drag.startPanX = state.panX;
    drag.startPanY = state.panY;
    return;
  }

  const hit = hitTestMaskEdit(p.x, p.y);
  if (hit) {
    clearLongPress();
    state.selectedMaskIds.clear();
    state.selectedMaskIds.add(hit.id);
    updateSelUI();

    drag.mode = "moveMask";
    drag.movingMaskId = hit.id;
    drag.maskStart = { x: hit.x, y: hit.y };
    const w = screenToWorld(p.x, p.y);
    drag.worldStart = { x: w.x, y: w.y };
    drawEdit();
    return;
  }

  drag.mode = "draw";
  drag.sx = p.x; drag.sy = p.y;
  drag.ex = p.x; drag.ey = p.y;
  drawEdit();
});

canvas?.addEventListener("pointermove", (e) => {
  if (!pointersEdit.has(e.pointerId)) return;
  const p = getCanvasPoint(canvas, e);
  pointersEdit.set(e.pointerId, p);

  if (longPressTimer && !longPressActive) {
    const dx = p.x - drag.sx, dy = p.y - drag.sy;
    if (Math.hypot(dx, dy) > 6) clearLongPress();
  }

  if (drag.mode === "pan") {
    state.panX = drag.startPanX + (p.x - drag.sx);
    state.panY = drag.startPanY + (p.y - drag.sy);
    drawEdit();
    return;
  }

  if (drag.mode === "moveMask") {
    const id = drag.movingMaskId;
    const m = cache.masks.find((x) => x.id === id);
    if (!m || !editPage) return;

    const w = screenToWorld(p.x, p.y);
    const dx = (w.x - drag.worldStart.x) / editPage.width;
    const dy = (w.y - drag.worldStart.y) / editPage.height;

    m.x = clamp(drag.maskStart.x + dx, 0, 1 - m.w);
    m.y = clamp(drag.maskStart.y + dy, 0, 1 - m.h);
    drawEdit();
    return;
  }

  if (drag.mode === "draw") {
    drag.ex = p.x; drag.ey = p.y;
    drawEdit();
  }
});

canvas?.addEventListener("pointerup", async (e) => {
  pointersEdit.delete(e.pointerId);
  clearLongPress();

  if (drag.mode === "pan") { drag.mode = "none"; return; }

  if (drag.mode === "moveMask") {
    const id = drag.movingMaskId;
    drag.mode = "none";
    drag.movingMaskId = null;
    const m = cache.masks.find((x) => x.id === id);
    if (m) {
      await put("masks", m);
      await refreshCache();
      await renderEditSidebar();
      drawEdit();
    }
    return;
  }

  if (drag.mode !== "draw") { drag.mode = "none"; return; }
  drag.mode = "none";

  const p = getCanvasPoint(canvas, e);
  const x1 = Math.min(drag.sx, p.x);
  const y1 = Math.min(drag.sy, p.y);
  const x2 = Math.max(drag.sx, p.x);
  const y2 = Math.max(drag.sy, p.y);

  if (Math.abs(x2 - x1) < 8 || Math.abs(y2 - y1) < 8) { drawEdit(); return; }

  if (!state.currentGroupId) { await createGroup(); await refreshCache(); await renderEditSidebar(); }
  if (!editPage) return;

  const w1 = screenToWorld(x1, y1);
  const w2 = screenToWorld(x2, y2);

  const nx = clamp01(w1.x / editPage.width);
  const ny = clamp01(w1.y / editPage.height);
  const nw = clamp01((w2.x - w1.x) / editPage.width);
  const nh = clamp01((w2.y - w1.y) / editPage.height);

  const m = {
    id: uid(),
    groupId: state.currentGroupId,
    printId: state.currentPrintId,
    pageIndex: 0,
    x: clamp(nx, 0, 1),
    y: clamp(ny, 0, 1),
    w: clamp(nw, 0.0005, 1),
    h: clamp(nh, 0.0005, 1),
    createdAt: now(),
  };
  m.x = clamp(m.x, 0, 1 - m.w);
  m.y = clamp(m.y, 0, 1 - m.h);

  await put("masks", m);
  await refreshCache();
  await renderEditSidebar();
  drawEdit();
});

/* ========= TODAY / REVIEW / PICKER（HTML対応版） ========= */

const reviewCanvas = $("#reviewCanvas");
const reviewCtx = reviewCanvas?.getContext("2d");

const pickerModal = $("#pickerModal");
const pickerCanvas = $("#pickerCanvas");
const pickerCtx = pickerCanvas?.getContext("2d");

let reviewPage = null;
let reviewBmp = null;
let pickerPage = null;
let pickerBmp = null;

// review/picker の pan/zoom（最小）
const vz = {
  review: { zoom: 1, panX: 0, panY: 0 },
  // 任意学習（HOME→Q選択→開始）中は、今日の復習一覧を混ぜない
  practiceMode: false,

  picker: { zoom: 1, panX: 0, panY: 0 },
};

function fitCanvasToStage(stageEl, cvs, page, vzObj){
  if (!stageEl || !cvs || !page) return;
  const sw = stageEl.clientWidth;
  const sh = stageEl.clientHeight;
  cvs.width = Math.max(1, Math.floor(sw));
  cvs.height = Math.max(1, Math.floor(sh));
  const zx = sw / page.width;
  const zy = sh / page.height;
  vzObj.zoom = Math.min(zx, zy);
  vzObj.panX = (sw - page.width * vzObj.zoom) / 2;
  vzObj.panY = (sh - page.height * vzObj.zoom) / 2;
}

function screenToWorld2(sx, sy, vzObj){
  return { x: (sx - vzObj.panX) / vzObj.zoom, y: (sy - vzObj.panY) / vzObj.zoom };
}

function getCanvasPoint2(cvs, e){
  const r = cvs.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function drawImageWithMasks(ctx2d, cvs, page, bmp, masks, revealedSet, vzObj, opt={}){
  if (!ctx2d || !cvs || !page || !bmp) return;

  ctx2d.clearRect(0,0,cvs.width,cvs.height);
  ctx2d.save();
  ctx2d.translate(vzObj.panX, vzObj.panY);
  ctx2d.scale(vzObj.zoom, vzObj.zoom);

  ctx2d.drawImage(bmp, 0, 0);

  // mask
  ctx2d.fillStyle = "#000";
  masks.forEach(m => {
    if (revealedSet && revealedSet.has(m.id)) return;
    ctx2d.fillRect(m.x * page.width, m.y * page.height, m.w * page.width, m.h * page.height);
  });

// review用：対象Qのマスクを黄色枠で強調（複数Qがあるときに迷わない）
if (opt.highlightGroupId) {
  ctx2d.save();
  ctx2d.strokeStyle = "#ffd34d";
  ctx2d.lineWidth = 7 / vzObj.zoom;
  ctx2d.shadowColor = "rgba(255,211,77,0.90)";
  ctx2d.shadowBlur = 18 / vzObj.zoom;
  masks.forEach(m => {
    if (m.groupId !== opt.highlightGroupId) return;
    ctx2d.strokeRect(m.x * page.width, m.y * page.height, m.w * page.width, m.h * page.height);
  });
  ctx2d.restore();
}

  // picker用：グループラベル表示（任意）
  if (opt.showLabels) {
    const gMap = new Map(cache.groups.map(g => [g.id, g]));
    ctx2d.save();
    ctx2d.font = `${12 / vzObj.zoom}px sans-serif`;
    ctx2d.fillStyle = "rgba(255,255,255,0.95)";
    ctx2d.strokeStyle = "rgba(0,0,0,0.7)";
    ctx2d.lineWidth = 3 / vzObj.zoom;

    masks.forEach(m => {
      const gl = gMap.get(m.groupId)?.label || "";
      if (!gl) return;
      const x = m.x * page.width + 4 / vzObj.zoom;
      const y = m.y * page.height + 14 / vzObj.zoom;
      ctx2d.strokeText(gl, x, y);
      ctx2d.fillText(gl, x, y);
    });
    ctx2d.restore();
  }

  // picker用：選択しているgroupは枠で強調
  if (opt.selectedGroupIds && opt.selectedGroupIds.size) {
    ctx2d.save();
    ctx2d.strokeStyle = "#ffd34d";
    ctx2d.lineWidth = 4 / vzObj.zoom;
    masks.forEach(m => {
      if (!opt.selectedGroupIds.has(m.groupId)) return;
      ctx2d.strokeRect(m.x * page.width, m.y * page.height, m.w * page.width, m.h * page.height);
    });
    ctx2d.restore();
  }

  ctx2d.restore();
}

/* --- TODAY: 一覧 --- */
async function renderToday(){
  await refreshCache();
  show("#view-today");
  $("#todayMeta") && ($("#todayMeta").textContent = "");
  renderProGateBanner();
  renderLicensedBadge();

  let due = computeDueGroups(); // [{g,s}]

  // 教科フィルタ
  if (state.todaySubjectFilter) {
    const f = normSubject(state.todaySubjectFilter);
    due = due.filter(x => {
      const p = cache.prints.find(pp => pp.id === x.g.printId);
      return normSubject(p?.subject) === f;
    });
  }

  const list = $("#todayList");
  if (!list) return;
  list.innerHTML = "";

// 任意学習モード中は、今日の復習一覧を表示しない（混乱防止）
if (state.practiceMode) {
  list.innerHTML = `<div class="item muted">任意学習中のため、「今日の復習」一覧は非表示です。<br><span class="small muted">（HOMEの「このプリントを復習」から開始した場合）</span></div>`;
  return;
}

  if (due.length === 0) {
    list.innerHTML = `<div class="item muted">今日の復習はありません 🎉</div>`;
    return;
  }

  $("#todayMeta") && ($("#todayMeta").textContent = `期限のQ：${due.length} 件`);

  for (const x of due) {
    const g = x.g;
    const p = cache.prints.find(pp => pp.id === g.printId);
    const title = p?.title || "(不明)";
    const subj = normSubject(p?.subject);

    const el = document.createElement("div");
    el.className = "item";
    el.setAttribute("data-due-item", g.id);
    el.innerHTML = `
      <div class="row space wrap">
        <div>
          <div class="itemTitle">${escapeHtml(title)}</div>
          <div class="muted small">${escapeHtml(subj)} / ${escapeHtml(g.label || "")}</div>
        </div>
        <div class="row wrap">
          <button class="btn primary" data-start-review="${g.id}">復習</button>
        </div>
      </div>
    `;
    el.querySelector(`[data-start-review="${g.id}"]`)?.addEventListener("click", async () => {
      await startReviewQueue([g.id]);
    });
    list.appendChild(el);
  }
}

/* 教科フィルタ（HTMLは btnTodayFilter だけあるので、シートで絞り込み） */
$("#btnTodayFilter")?.addEventListener("click", async () => {
  await refreshCache();
  const subjects = getAllSubjectsFromPrints();
  const current = state.todaySubjectFilter ? normSubject(state.todaySubjectFilter) : "";

  openSubjectSheet({
    mode: "single",
    title: "教科で絞り込み",
    subtitle: "「すべて」を選ぶと解除できます",
    subjects: ["すべて"].concat(subjects),
    initial: new Set([current || "すべて"]),
    allowOtherFreeText: false,
    onOk: async (sel) => {
      const v = Array.from(sel)[0] || "すべて";
      state.todaySubjectFilter = (v === "すべて") ? null : v;
      await renderToday();
    },
    onCancel: () => {}
  });
});

/* --- 任意学習：ピッカーでQ選択（HTMLの pickerModal を使う） --- */
async function openPracticePicker(printId){
  await refreshCache();
  const p = cache.prints.find(x => x.id === printId);
  if (!p) return;

  const page = cache.pages.find(x => x.printId === printId && x.pageIndex === 0);
  if (!page) { alert("ページが見つかりません"); return; }

  const groups = cache.groups.filter(g => g.printId === printId && g.isActive).sort((a,b)=>a.orderIndex-b.orderIndex);
  if (groups.length === 0) { alert("このプリントにはQがありません（編集でQを作ってください）"); return; }

  pickerPage = page;
  pickerBmp = await createImageBitmap(page.image);

  state.picker.open = true;
  state.picker.printId = printId;
  state.picker.selectedGroupIds = new Set(); // 選択したQ
  $("#pickerSelCount") && ($("#pickerSelCount").textContent = "0");
  $("#pickerStart") && ($("#pickerStart").disabled = true);

  pickerModal?.classList.remove("hidden");
  pickerModal?.setAttribute("aria-hidden","false");

  // canvas fit
  const stage = $("#pickerStage");
  fitCanvasToStage(stage, pickerCanvas, pickerPage, vz.picker);

  drawPicker();
}

function closePicker(){
  state.picker.open = false;
  pickerModal?.classList.add("hidden");
  pickerModal?.setAttribute("aria-hidden","true");
}

function drawPicker(){
  if (!pickerCtx || !pickerCanvas || !pickerPage || !pickerBmp) return;
  const masks = cache.masks.filter(m => m.printId === state.picker.printId);
  drawImageWithMasks(pickerCtx, pickerCanvas, pickerPage, pickerBmp, masks, null, vz.picker, {
    showLabels: true,
    selectedGroupIds: state.picker.selectedGroupIds
  });
}

pickerCanvas?.addEventListener("click", async (e) => {
  if (!state.picker.open) return;
  await refreshCache();

  const pt = getCanvasPoint2(pickerCanvas, e);
  const w = screenToWorld2(pt.x, pt.y, vz.picker);
  const nx = w.x / pickerPage.width;
  const ny = w.y / pickerPage.height;

  const masks = cache.masks.filter(m => m.printId === state.picker.printId);
  const hit = masks.find(m => nx >= m.x && nx <= m.x + m.w && ny >= m.y && ny <= m.y + m.h);
  if (!hit) return;

  if (state.picker.selectedGroupIds.has(hit.groupId)) state.picker.selectedGroupIds.delete(hit.groupId);
  else state.picker.selectedGroupIds.add(hit.groupId);

  $("#pickerSelCount") && ($("#pickerSelCount").textContent = String(state.picker.selectedGroupIds.size));
  $("#pickerStart") && ($("#pickerStart").disabled = state.picker.selectedGroupIds.size === 0);

  drawPicker();
});

$("#pickerCancel")?.addEventListener("click", closePicker);
$("#pickerStart")?.addEventListener("click", async () => {
  const ids = Array.from(state.picker.selectedGroupIds);
  if (ids.length === 0) return;
  // 任意学習モード開始：今日の復習一覧は出さない
  state.practiceMode = true;
  const tl = $("#todayList");
  if (tl) tl.innerHTML = `<div class="item muted">任意学習中のため、「今日の復習」一覧は非表示です。</div>`;
  $("#todayMeta") && ($("#todayMeta").textContent = `任意学習：選択したQ ${ids.length} 問（対象Qは黄色枠）`);

  closePicker();
  await startReviewQueue(ids);
});

/* --- REVIEW（透過タップ：押したmaskだけ一時表示） --- */
async function startReviewQueue(groupIds){
  await refreshCache();
  state.reviewQueue = groupIds.slice();
  state.reviewIndex = 0;
  state.revealedMaskIds = new Set();
  state.doneTodayCount = 0;
  await renderReview();
}

function currentReviewGroupId(){
  return state.reviewQueue[state.reviewIndex] || null;
}

async function ensureReviewLoaded(groupId){
  await refreshCache();
  const g = cache.groups.find(x => x.id === groupId);
  const p = cache.prints.find(x => x.id === g?.printId);
  const page = cache.pages.find(x => x.printId === g?.printId && x.pageIndex === 0);
  if (!g || !p || !page) throw new Error("review data missing");
  reviewPage = page;
  reviewBmp = await createImageBitmap(page.image);
  return { g, p, page };
}

async function renderReview(){
  const gid = currentReviewGroupId();
  // 今日の復習リストから即時に消す（完了した項目はボタンごと消える）
  document.querySelector(`[data-due-item="${gid}"]`)?.remove();
  if (!gid) { await renderDone(); return; }

  show("#view-review");
  renderProGateBanner();
  renderLicensedBadge();
  await refreshCache();

  const { g, p, page } = await ensureReviewLoaded(gid);
  applyRateHintsForGroup(gid);
  showYellowHintOnce();

  $("#reviewTitle") && ($("#reviewTitle").textContent = p.title || "復習");
  $("#reviewMeta") && ($("#reviewMeta").textContent = `${normSubject(p.subject)} / ${g.label || ""}`);
  $("#reviewRemaining") && ($("#reviewRemaining").textContent = String(state.reviewQueue.length - state.reviewIndex));

  const stage = $("#reviewStage");
  const allMasks = cache.masks.filter(m => m.printId === p.id);
  const masksThisQ = allMasks.filter(m => m.groupId === gid);

  // iPad/Safariで表示直後にstageサイズが0になることがあるため、1フレーム待ってからfit+描画
  requestAnimationFrame(() => {
    fitCanvasToStage(stage, reviewCanvas, page, vz.review);
    drawImageWithMasks(reviewCtx, reviewCanvas, page, reviewBmp, allMasks, state.revealedMaskIds, vz.review, { highlightGroupId: gid });
  });

  $("#btnBackToToday")?.addEventListener("click", async () => { await renderToday(); }, { once:true });

  $("#btnOpenEditFromReview")?.addEventListener("click", async () => {
    state.currentPrintId = p.id;
    state.currentGroupId = gid;
    state.selectedMaskIds.clear();
    await nav("edit");
  }, { once:true });

  $("#btnSkipToday")?.addEventListener("click", async () => {
    await skipToday(gid);
    state.reviewIndex++;
    state.revealedMaskIds = new Set();
    await renderReview();
  }, { once:true });

  $$("[data-review-rate]").forEach(btn => {
    btn.onclick = async () => {
      const r = btn.getAttribute("data-review-rate");
      await gradeReview(r);
    };
  });

  reviewCanvas.onclick = (ev) => {
    const pt = getCanvasPoint2(reviewCanvas, ev);
    const w = screenToWorld2(pt.x, pt.y, vz.review);
    const nx = w.x / reviewPage.width;
    const ny = w.y / reviewPage.height;

    const hit = masksThisQ.find(m => nx >= m.x && nx <= m.x + m.w && ny >= m.y && ny <= m.y + m.h);
    if (!hit) return;

    if (state.revealedMaskIds.has(hit.id)) state.revealedMaskIds.delete(hit.id);
    else state.revealedMaskIds.add(hit.id);

    drawImageWithMasks(reviewCtx, reviewCanvas, reviewPage, reviewBmp, allMasks, state.revealedMaskIds, vz.review, { highlightGroupId: gid });
  };
}

async function gradeReview(rating){
  await refreshCache();
  const gid = currentReviewGroupId();
  // 今日の復習リストから即時に消す（完了した項目はボタンごと消える）
  document.querySelector(`[data-due-item="${gid}"]`)?.remove();
  if (!gid) return;

  const prev = cache.srs.find(s => s.groupId === gid) || initSrsState(gid);
  const next = updateSrs(prev, rating);

  const rec = { id: uid(), groupId: gid, rated: rating, at: now() };

  await tx(["srs","reviews"], "readwrite", (st) => {
    st.srs.put(next);
    st.reviews.put(rec);
  });

  state.doneTodayCount++;
  state.reviewIndex++;
  state.revealedMaskIds = new Set();
  await renderReview();
}

async function renderDone(){
  show("#view-done");
  state.practiceMode = false;
  $("#doneCount") && ($("#doneCount").textContent = String(state.doneTodayCount));
}


/* ========= 利用規約 同意（初回のみ） ========= */
const TERMS_VERSION = "2026-02-20";
const TERMS_KEY = "psrs_terms_accepted_v";

function hasAcceptedTerms() {
  try { return localStorage.getItem(TERMS_KEY) === TERMS_VERSION; } catch(_) { return false; }
}

function openConsent() {
  const m = $("#consentModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden","false");
}

function closeConsent() {
  const m = $("#consentModal");
  if (!m) return;
  m.classList.add("hidden");
  m.setAttribute("aria-hidden","true");
}

function requireTermsConsent() {
  if (hasAcceptedTerms()) return;
  openConsent();
}

$("#consentShowTerms")?.addEventListener("click", (e) => {
  e.preventDefault();
  openTerms();
});

$("#consentAccept")?.addEventListener("click", () => {
  try { localStorage.setItem(TERMS_KEY, TERMS_VERSION); } catch(_) {}
  closeConsent();
});

// 初回（規約未同意）ならブロック
requireTermsConsent();

/* ========= 印刷（単体/まとめ, A4/A3, Pro/Free透かし） ========= */

const printSheet = $("#printSheet");
const printSheetTitle = $("#printSheetTitle");
const printSheetSub = $("#printSheetSub");
const printSheetInfo = $("#printSheetInfo");
const printSheetFoot = $("#printSheetFoot");

function openPrintSheet(){
  printSheet?.classList.remove("hidden");
  printSheet?.setAttribute("aria-hidden","false");
}
function closePrintSheet(){
  printSheet?.classList.add("hidden");
  printSheet?.setAttribute("aria-hidden","true");
  state.print.mode = null;
  state.print.targets = [];
}

function setPrintButtonsUI(){
  const a4 = $("#btnPaperA4"), a3 = $("#btnPaperA3");
  const p = $("#btnOriP"), l = $("#btnOriL");
  if (a4) a4.classList.toggle("primary", state.print.paper === "A4");
  if (a3) a3.classList.toggle("primary", state.print.paper === "A3");
  if (p) p.classList.toggle("primary", state.print.orientation === "portrait");
  if (l) l.classList.toggle("primary", state.print.orientation === "landscape");
}

$("#printSheetClose")?.addEventListener("click", closePrintSheet);
$("#printSheetBackdrop")?.addEventListener("click", closePrintSheet);
$("#printSheetCancel")?.addEventListener("click", closePrintSheet);

$("#btnPaperA4")?.addEventListener("click", () => { state.print.paper = "A4"; setPrintButtonsUI(); });
$("#btnPaperA3")?.addEventListener("click", () => { state.print.paper = "A3"; setPrintButtonsUI(); });
$("#btnOriP")?.addEventListener("click", () => { state.print.orientation = "portrait"; setPrintButtonsUI(); });
$("#btnOriL")?.addEventListener("click", () => { state.print.orientation = "landscape"; setPrintButtonsUI(); });

function showProUpsellForBatch(){
  alert(
`まとめ印刷（複数を1つのPDFに）はPro限定です。

無料版：単体印刷（A4/A3）は使えます。
Pro：まとめ印刷 + 透かしなし + A3対応（さらに高画質など）

Proをご利用の方は、購入時に案内されたURL（/pro/?uid=XXXX）を開いてください。`
  );
}

async function openPrintSheetSingle(printId){
  await refreshCache();
  const p = cache.prints.find(x => x.id === printId);
  if (!p) return;

  state.print.mode = "single";
  state.print.targets = [{ id: p.id, title: p.title, subject: normSubject(p.subject) }];
  state.print.paper = "A4";
  state.print.orientation = "portrait";

  if (printSheetTitle) printSheetTitle.textContent = "単体印刷";
  if (printSheetSub) printSheetSub.textContent = "A4/A3・縦横を選べます";
  if (printSheetInfo) {
    printSheetInfo.textContent = PRO.enabled
      ? `Pro有効：印刷物右下に Licensed ID: ${PRO.licensedId} を表示します`
      : "無料版：印刷物に「FREE」透かしを入れます";
  }
  if (printSheetFoot) {
    printSheetFoot.textContent = "※iPadは印刷開始まで少し時間がかかることがあります。";
  }

  setPrintButtonsUI();
  openPrintSheet();
}

$("#btnBatchPrint")?.addEventListener("click", async () => {
  const ids = Array.from(state.selectedPrintIds);
  if (ids.length === 0) return;

  if (!PRO.enabled) {
    showProUpsellForBatch();
    return;
  }

  await refreshCache();
  const targets = ids.map(id => cache.prints.find(p => p.id === id)).filter(Boolean);
  if (targets.length === 0) return;

  state.print.mode = "batch";
  state.print.targets = targets.map(p => ({ id: p.id, title: p.title, subject: normSubject(p.subject) }));
  state.print.paper = "A4";
  state.print.orientation = "portrait";

  if (printSheetTitle) printSheetTitle.textContent = "まとめ印刷（Pro）";
  if (printSheetSub) printSheetSub.textContent = "複数プリントを1つの印刷にまとめます";
  if (printSheetInfo) printSheetInfo.textContent = `Pro有効：印刷物右下に Licensed ID: ${PRO.licensedId} を表示します`;
  if (printSheetFoot) printSheetFoot.textContent = "※枚数が多いと印刷開始まで時間がかかることがあります。";

  setPrintButtonsUI();
  openPrintSheet();
});

async function renderMaskedDataUrlForPrint(printId){
  await refreshCache();
  const page = cache.pages.find(p => p.printId === printId && p.pageIndex === 0);
  if (!page) throw new Error("ページが見つかりません");
  const bitmap = await createImageBitmap(page.image);

  const off = document.createElement("canvas");
  off.width = page.width;
  off.height = page.height;
  const octx = off.getContext("2d");
  octx.drawImage(bitmap, 0, 0);

  const masks = cache.masks.filter(m => m.printId === printId);
  masks.forEach(m => {
    octx.fillStyle = "#000";
    octx.fillRect(
      m.x * page.width,
      m.y * page.height,
      m.w * page.width,
      m.h * page.height
    );
  });

  return off.toDataURL("image/jpeg", 0.92);
}

function buildPrintHtml(pages, opt){
  const safe = pages.map(p => ({
    title: escapeHtml(p.title),
    subject: escapeHtml(p.subject),
    dataUrl: p.dataUrl
  }));
  const paper = opt?.paper || "A4";
  const orientation = opt?.orientation || "portrait";
  const proEnabled = !!opt?.proEnabled;
  const licensedId = (opt?.licensedId || "").trim();

  const freeWatermarkHtml = proEnabled ? "" : `
    <svg class="wmFreeSvg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <pattern id="p" patternUnits="userSpaceOnUse" width="420" height="240" patternTransform="rotate(-25)">
      <text x="20" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="84" font-weight="800"
            fill="rgb(120,180,255)" fill-opacity="0.22">FREE</text>
      <text x="210" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="84" font-weight="800"
            fill="rgb(120,180,255)" fill-opacity="0.22">FREE</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#p)"/>
</svg>
  `;
  const proLicenseHtml = (proEnabled && licensedId) ? `
    <div class="wmLic">Licensed ID: ${escapeHtml(licensedId)}</div>
  ` : "";

  const body = safe.map((p) => `
    <section class="page">
      <div class="meta">
        <div class="t">${p.title}</div>
        <div class="s">${p.subject}</div>
      </div>
      <div class="sheet">
        <div class="sheetInner">
          <img src="${p.dataUrl}" />
          ${freeWatermarkHtml}
          ${proLicenseHtml}
        </div>
      </div>
    </section>
  `).join("\n");

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Print</title>
<style>
  @page { size: ${paper} ${orientation}; margin: 8mm; }
  html, body { margin:0; padding:0; }
  *{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { page-break-after: always; }
  .meta { font-family: system-ui, -apple-system, sans-serif; margin: 0 0 6mm; }
  .t { font-size: 12pt; font-weight: 700; }
  .s { font-size: 10pt; opacity: 0.75; margin-top: 2mm; }
  .sheet { width: 100%; display:flex; align-items:center; justify-content:center; }
  .sheetInner { position: relative; width: 100%; display:flex; align-items:center; justify-content:center; }
  img { position: relative; z-index: 1; max-width: 100%; max-height: 265mm; object-fit: contain; }

  



.wmFreeSvg{
  position:absolute;
  inset:0;
  z-index: 6;
  pointer-events:none;
  user-select:none;
  width: 100%;
  height: 100%;
}

  .wmLic{
    z-index: 8;
    position:absolute;
    right: 6mm;
    bottom: 6mm;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 9pt;
    color: rgba(0,0,0,0.35);
    user-select:none;
    pointer-events:none;
  }
</style>
</head>
<body>
${body}
<script>
  window.onload = () => {
    setTimeout(() => {  }, 60);
  };
<\/script>
</body>
</html>
  `;
}

async function printHtmlViaIframe(html){
  const frame = $("#printFrame");
  if (!frame) throw new Error("printFrameが見つかりません");

  // 二重起動防止
  if (state.print?.isPrinting) return;
  state.print.isPrinting = true;

  frame.classList.remove("hidden");
  frame.srcdoc = html;

  await new Promise((res) => {
    frame.onload = () => { frame.onload = null; res(); };
    // Safari等でonloadが取りづらい保険
    setTimeout(res, 400);
  });

  try {
    const w = frame.contentWindow;
    if (!w) throw new Error("printFrameのcontentWindowがありません");

    // 印刷後にクリーンアップ（キャンセルでも発火することが多い）
    w.onafterprint = () => {
      try{
        frame.srcdoc = "";
        frame.classList.add("hidden");
      }catch{}
      state.print.isPrinting = false;
    };

    w.focus();
    w.print();

    // onafterprint が来ないブラウザ用の保険解除
    setTimeout(() => {
      if (state.print.isPrinting){
        state.print.isPrinting = false;
      }
    }, 8000);

  } catch (e) {
    state.print.isPrinting = false;
    console.warn("iframe print failed:", e);
    alert("印刷の起動に失敗しました。ブラウザのポップアップ/印刷設定をご確認ください。");
  }
}

$("#printSheetDo")?.addEventListener("click", async () => {
  const mode = state.print.mode;
  const targets = state.print.targets || [];
  if (!mode || targets.length === 0) { closePrintSheet(); return; }

  if (mode === "batch" && !PRO.enabled) {
    closePrintSheet();
    showProUpsellForBatch();
    return;
  }

  const msg = mode === "batch"
    ? `選択した ${targets.length} 件をまとめて印刷します。よろしいですか？`
    : `単体印刷を開始します。よろしいですか？`;
  if (!confirm(msg)) return;

  try {
    closePrintSheet();

    const pages = [];
    for (const p of targets) {
      const dataUrl = await renderMaskedDataUrlForPrint(p.id);
      pages.push({ title: p.title, subject: normSubject(p.subject), dataUrl });
    }

    const html = buildPrintHtml(pages, {
      paper: state.print.paper,
      orientation: state.print.orientation,
      mode,
      proEnabled: PRO.enabled,
      licensedId: PRO.enabled ? PRO.licensedId : ""
    });

    await printHtmlViaIframe(html);

    showHomeToast(mode === "batch"
      ? `まとめ印刷を開始しました（${targets.length}件）`
      : "印刷を開始しました"
    );
  } catch (e) {
    console.error(e);
    alert(`印刷に失敗しました：${e.message || e}`);
  }
});

/* ========= HOME: 選択プリント移動 ========= */
$("#btnMoveSelected")?.addEventListener("click", async () => {
  const ids = Array.from(state.selectedPrintIds);
  if (ids.length === 0) return;

  await refreshCache();
  const subjects = getAllSubjectsFromPrints();

  openSubjectSheet({
    mode: "single",
    title: "移動先の教科を選択",
    subtitle: "「その他」は自由記載できます",
    subjects,
    initial: new Set(["算数"]),
    allowOtherFreeText: true,
    onOk: async (sel) => {
      const dest = normSubject(Array.from(sel)[0] || "その他");
      await refreshCache();
      await tx(["prints"], "readwrite", (st) => {
        ids.forEach((pid) => {
          const p = cache.prints.find(x => x.id === pid);
          if (!p) return;
          p.subject = dest;
          st.prints.put(p);
        });
      });
      await refreshCache();
      showHomeToast(`移動しました：${ids.length}件 → ${dest}`);
      await renderHome();
    },
    onCancel: () => {}
  });
});

/* ========= Backup / Restore ========= */
function downloadText(filename, text){
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function arrayBufferToBase64(buffer){
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBlob(b64, type){
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i=0; i<len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || "image/jpeg" });
}

$("#btnBackup")?.addEventListener("click", async () => {
  await refreshCache();
  const payload = {
    meta: {
      app: "Print SRS Lite Pro",
      exportedAt: now(),
      version: "20260219-proprint",
      db: { name: DB_NAME, ver: DB_VER },
    },
    data: {
      prints: cache.prints,
      pages: [],
      groups: cache.groups,
      masks: cache.masks,
      srs: cache.srs,
      reviews: cache.reviews,
      skips: cache.skips,
      ui: cache.ui,
    }
  };

  const pagesPacked = [];
  for (const p of cache.pages) {
    const buf = await p.image.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    pagesPacked.push({ ...p, imageBase64: b64, imageType: p.image.type || "image/jpeg" });
  }
  payload.data.pages = pagesPacked;

  const fname = `print_srs_backup_${new Date().toISOString().slice(0,10)}.json`;
  downloadText(fname, JSON.stringify(payload));
  showHomeToast("バックアップをダウンロードしました");
});

$("#btnRestore")?.addEventListener("click", () => {
  $("#restoreFile")?.click();
});

$("#restoreFile")?.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!confirm("復元すると現在のデータは上書きされます。よろしいですか？")) {
    e.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text);

    if (!json?.data) throw new Error("バックアップ形式が不正です（dataがありません）");

    const prints = Array.isArray(json.data.prints) ? json.data.prints : [];
    const pagesPacked = Array.isArray(json.data.pages) ? json.data.pages : [];
    const groups = Array.isArray(json.data.groups) ? json.data.groups : [];
    const masks = Array.isArray(json.data.masks) ? json.data.masks : [];
    const srs = Array.isArray(json.data.srs) ? json.data.srs : [];
    const reviews = Array.isArray(json.data.reviews) ? json.data.reviews : [];
    const skips = Array.isArray(json.data.skips) ? json.data.skips : [];
    const ui = Array.isArray(json.data.ui) ? json.data.ui : [];

    const pages = pagesPacked.map(p => {
      if (p.imageBase64) {
        const blob = base64ToBlob(p.imageBase64, p.imageType);
        const { imageBase64, imageType, ...rest } = p;
        return { ...rest, image: blob };
      }
      return p;
    });

    await tx(["prints","pages","groups","masks","srs","reviews","skips","ui"], "readwrite", (st) => {
      ["prints","pages","groups","masks","srs","reviews","skips","ui"].forEach(name => {
        st[name].clear();
      });

      prints.forEach(p => { p.subject = normSubject(p.subject); st.prints.put(p); });
      pages.forEach(p => st.pages.put(p));
      groups.forEach(g => st.groups.put(g));
      masks.forEach(m => st.masks.put(m));
      srs.forEach(s => st.srs.put(s));
      reviews.forEach(r => st.reviews.put(r));
      skips.forEach(s => st.skips.put(s));
      ui.forEach(u => st.ui.put(u));
    });

    await refreshCache();
    showHomeToast("復元しました");
    await renderHome();
  } catch (err) {
    console.error(err);
    alert(`復元に失敗：${err.message || err}`);
  } finally {
    e.target.value = "";
  }
});

/* ========= HOME: checkbox safety ========= */
document.addEventListener("change", (e) => {
  if (e.target?.matches?.(".checkbox")) updateHomeSelectionUI();
});

/* ========= 初期起動 ========= */
(async function boot(){
  await loadCollapsedSubjects();
  renderProGateBanner();
  renderLicensedBadge();
  await nav("home");
})();
