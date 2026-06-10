/* Тренажёр фармацевта «Супрадин» — 3D-версия (оркестрация сцены + UI). */
import { PharmacyScene } from "./scene.js";

const POINTS_PER_STEP = 10;
const BEST_KEY = "supradyn_best_score_3d";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

let scene = null;
let state = null;

/* ---------- DOM-узлы ---------- */
const sceneRoot = $("scene-root");
const hud = $("hud");
const dock = $("dock");
const speech = $("speech");
const stepTitle = $("step-title");
const stepQ = $("step-q");
const optionsEl = $("options");
const feedbackEl = $("feedback");
const overlay = $("overlay");
const nameLabel = $("namelabel");

/* ---------- HUD ---------- */
function updateHud() {
  if (!state) return;
  hud.hidden = false;
  $("hud-progress").textContent = state.idx + 1 + " / " + state.scenarios.length;
  $("hud-score").textContent = state.score;
}

/* ---------- стартовый экран ---------- */
function showStart() {
  state = null;
  hud.hidden = true;
  dock.hidden = true;
  nameLabel.hidden = true;
  const best = localStorage.getItem(BEST_KEY);
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="card hero">
      <div class="hero__sun">☀️</div>
      <h1>Тренажёр фармацевта</h1>
      <p class="lead">Вы за стойкой аптеки «Супрадин». К вам подходят посетители
      с разными запросами на витаминную поддержку. Выслушайте, задайте верные
      вопросы и подберите подходящий продукт линейки.</p>
      <div class="howto">
        <h3>Как играть</h3>
        <ol>
          <li>Каждый посетитель — 3 решения: <b>уточнить запрос</b>, <b>порекомендовать продукт</b> и <b>дать совет по приёму</b>.</li>
          <li>За верный выбор — баллы и профессиональный разбор. Посетитель реагирует на ваш ответ.</li>
          <li>Кнопка <b>📖 Справочник</b> вверху — вся линейка под рукой.</li>
        </ol>
      </div>
      ${best ? `<p class="lead">🏆 Ваш рекорд: <b>${best}</b> баллов</p>` : ""}
      <button class="btn btn--primary" id="start-btn">Открыть смену →</button>
      <p class="tip">💡 Совет: для 3D нужен запуск через локальный сервер (см. README).</p>
    </div>`;
  $("start-btn").addEventListener("click", startGame);
}

function ensureScene() {
  if (!scene) {
    scene = new PharmacyScene(sceneRoot);
    requestAnimationFrame(updateNameLabel);
  }
}

async function startGame() {
  ensureScene();
  state = {
    scenarios: shuffle(window.SUPRADYN_SCENARIOS),
    idx: 0,
    step: 0,
    score: 0,
    results: [],
    correct: 0,
  };
  overlay.hidden = true;
  updateHud();
  await runScenario();
}

/* ---------- сценарий ---------- */
async function runScenario() {
  const sc = state.scenarios[state.idx];
  updateHud();

  dock.hidden = true;
  nameLabel.hidden = true;
  await scene.spawnVisitor(sc.customer.look);

  nameLabel.innerHTML = `<b>${sc.customer.name}</b><span>${sc.customer.tag}</span>`;
  nameLabel.hidden = false;

  speakNpc(sc.request);
  dock.hidden = false;
  renderStep();
}

function speakNpc(text) {
  speech.innerHTML = `<span class="speech__who">${currentCustomer().name.split(",")[0]}:</span> ${text}`;
  speech.classList.remove("speech--me");
}
function speakMe(text) {
  speech.innerHTML = `<span class="speech__who">Вы:</span> ${text}`;
  speech.classList.add("speech--me");
}
const currentCustomer = () => state.scenarios[state.idx].customer;

function renderStep() {
  const sc = state.scenarios[state.idx];
  const step = sc.steps[state.step];
  state.stepScored = false;

  stepTitle.textContent = step.title;
  stepQ.textContent = step.q;
  feedbackEl.innerHTML = "";
  optionsEl.innerHTML = "";

  shuffle(step.options.map((_, i) => i)).forEach((i) => {
    const o = step.options[i];
    const b = el("button", "option", o.t);
    b.addEventListener("click", () => onAnswer(i));
    optionsEl.appendChild(b);
  });
}

async function onAnswer(chosen) {
  const sc = state.scenarios[state.idx];
  const step = sc.steps[state.step];
  const opt = step.options[chosen];

  // блокируем и подсвечиваем варианты
  [...optionsEl.children].forEach((btn, order) => {
    btn.disabled = true;
  });
  // сопоставляем кнопки с вариантами по тексту
  [...optionsEl.children].forEach((btn) => {
    const idx = step.options.findIndex((o) => o.t === btn.textContent);
    if (idx === chosen) {
      btn.classList.add(opt.ok ? "option--correct" : "option--wrong");
      btn.innerHTML = (opt.ok ? "✓ " : "✕ ") + btn.innerHTML;
    } else if (step.options[idx].ok) {
      btn.classList.add("option--correct");
      btn.innerHTML = "✓ " + btn.innerHTML;
    } else {
      btn.classList.add("option--dim");
    }
  });

  if (!state.stepScored) {
    if (opt.ok) {
      state.score += POINTS_PER_STEP;
      state.correct += 1;
    }
    state.stepScored = true;
    updateHud();
  }

  speakMe(opt.t);
  // реакция персонажа
  if (opt.ok) scene.reactCorrect();
  else scene.reactWrong();

  // ответная реплика посетителя на верный уточняющий вопрос
  if (opt.ok && opt.reply) {
    setTimeout(() => speakNpc(opt.reply), 700);
  }

  feedbackEl.innerHTML = `
    <div class="feedback feedback--${opt.ok ? "ok" : "no"}">
      <div class="feedback__head">${opt.ok ? "✅ Верно" : "❌ Не лучший выбор"}</div>
      <div>${opt.fb}</div>
      <div class="feedback__actions">
        <button class="btn btn--primary" id="next-btn">Продолжить →</button>
      </div>
    </div>`;
  $("next-btn").addEventListener("click", advance);
}

async function advance() {
  const sc = state.scenarios[state.idx];
  state.step++;

  if (state.step < sc.steps.length) {
    renderStep();
    return;
  }

  // сценарий завершён
  state.results.push({
    name: sc.customer.name,
    correct: state.correct,
    total: sc.steps.length,
  });

  if (sc.closing) {
    speakNpc(sc.closing);
    feedbackEl.innerHTML = "";
    optionsEl.innerHTML = "";
    stepTitle.textContent = "";
    stepQ.textContent = "";
  }
  await sleep(1100);

  state.correct = 0;
  state.step = 0;
  state.idx++;

  await scene.dismissVisitor();

  if (state.idx < state.scenarios.length) {
    await runScenario();
  } else {
    showResult();
  }
}

/* ---------- итог ---------- */
function showResult() {
  dock.hidden = true;
  nameLabel.hidden = true;
  const maxScore = state.scenarios.length * 3 * POINTS_PER_STEP;
  const pct = Math.round((state.score / maxScore) * 100);
  const best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
  const isRecord = state.score > best;
  if (isRecord) localStorage.setItem(BEST_KEY, String(state.score));

  let grade, emoji, msg;
  if (pct >= 90) {
    grade = "Эксперт за стойкой"; emoji = "🏆";
    msg = "Блестящая работа! Вы уверенно ведёте диалог, задаёте верные вопросы и точно подбираете продукты линейки.";
  } else if (pct >= 70) {
    grade = "Уверенный фармацевт"; emoji = "🌟";
    msg = "Хороший результат! Основу держите крепко. Сверьтесь со справочником по спорным кейсам — и будет идеально.";
  } else if (pct >= 50) {
    grade = "Растущий специалист"; emoji = "📈";
    msg = "Неплохое начало. Обратите внимание на возрастные ограничения и «красные флаги» (беременность, высокая температура).";
  } else {
    grade = "Нужна тренировка"; emoji = "📚";
    msg = "Не беда! Откройте справочник, разберите линейку по возрастам и задачам — и пройдите смену ещё раз.";
  }

  const rows = state.results
    .map(
      (r) =>
        `<div class="breakdown__row"><span>${r.name}</span>
         <span class="badge badge--${r.correct}">${r.correct} / ${r.total} ✓</span></div>`
    )
    .join("");

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="card result">
      <div class="result__emoji">${emoji}</div>
      <div class="result__grade">${grade}</div>
      <div class="result__score">${state.score} из ${maxScore} баллов · ${pct}%${isRecord ? "  🎉 новый рекорд!" : ""}</div>
      <div class="scorebar"><div class="scorebar__fill" style="width:0%"></div></div>
      <p class="result__msg">${msg}</p>
      <div class="breakdown"><h3>Разбор по посетителям</h3>${rows}</div>
      <div class="result__actions">
        <button class="btn btn--primary" id="again-btn">Сыграть ещё раз</button>
        <button class="btn btn--ghost" id="ref-btn2">📖 Справочник</button>
      </div>
    </div>`;
  requestAnimationFrame(() => {
    const fill = overlay.querySelector(".scorebar__fill");
    if (fill) fill.style.width = pct + "%";
  });
  $("again-btn").addEventListener("click", startGame);
  $("ref-btn2").addEventListener("click", openReference);
}

/* ---------- плавающая подпись над головой ---------- */
function updateNameLabel() {
  if (scene && !nameLabel.hidden) {
    const p = scene.visitorScreenPos();
    if (p && p.visible) {
      nameLabel.style.transform = `translate(-50%,-100%) translate(${p.x}px, ${p.y}px)`;
      nameLabel.style.opacity = "1";
    } else {
      nameLabel.style.opacity = "0";
    }
  }
  requestAnimationFrame(updateNameLabel);
}

/* ---------- справочник ---------- */
const modal = $("ref-modal");
function buildReference() {
  const body = $("ref-body");
  if (body.childElementCount) return;
  window.SUPRADYN_PRODUCTS.forEach((pr) => {
    const chips = pr.indications.map((s) => `<span class="chip">${s}</span>`).join("");
    body.appendChild(
      el(
        "div",
        "prod",
        `<div class="prod__top"><span class="prod__icon">${pr.icon}</span>
          <div><div class="prod__name">${pr.name}</div>
          <div class="prod__tag">${pr.tagline}</div></div></div>
         <div class="prod__meta">
           <b>Кому:</b> ${pr.audience}<br>
           <b>Форма:</b> ${pr.form}<br>
           <b>Состав:</b> ${pr.composition}<br>
           <b>Приём:</b> ${pr.usage}
         </div>
         <div class="prod__chips">${chips}</div>`
      )
    );
  });
}
function openReference() {
  buildReference();
  modal.hidden = false;
}
function closeReference() {
  modal.hidden = true;
}
$("ref-btn").addEventListener("click", openReference);
modal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeReference();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeReference();
});

/* ---------- запуск ---------- */
showStart();
