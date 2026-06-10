/* Тренажёр фармацевта «Супрадин» — игровой движок */
(function () {
  "use strict";

  var POINTS_PER_STEP = 10;
  var BEST_KEY = "supradyn_best_score";

  var stage = document.getElementById("stage");
  var hud = document.getElementById("hud");
  var hudProgress = document.getElementById("hud-progress");
  var hudScore = document.getElementById("hud-score");

  var state = null;

  /* ---------- утилиты ---------- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function updateHud() {
    if (!state) return;
    hud.hidden = false;
    hudProgress.textContent = (state.idx + 1) + " / " + state.scenarios.length;
    hudScore.textContent = state.score;
  }

  /* ---------- старт ---------- */
  function renderStart() {
    state = null;
    hud.hidden = true;
    var best = localStorage.getItem(BEST_KEY);

    var p = el("section", "panel hero");
    p.innerHTML =
      '<div class="hero__sun">☀️</div>' +
      "<h1>Тренажёр фармацевта</h1>" +
      '<p class="lead">К вашей стойке подходят посетители с разными запросами на витаминную поддержку. ' +
      "Выслушайте, задайте верные вопросы и подберите подходящий продукт линейки <b>«Супрадин»</b>.</p>" +
      '<div class="howto">' +
      "<h3>Как играть</h3>" +
      "<ol>" +
      "<li>Каждый посетитель — это 3 решения: <b>уточнить запрос</b>, <b>порекомендовать продукт</b> и <b>дать совет по приёму</b>.</li>" +
      "<li>За каждый верный выбор — баллы. После выбора вы увидите профессиональный разбор.</li>" +
      "<li>Загляните в <b>📖 Справочник</b> в любой момент, чтобы свериться с линейкой.</li>" +
      "</ol>" +
      "</div>" +
      (best ? '<p class="lead">🏆 Ваш рекорд: <b>' + best + "</b> баллов</p>" : "") +
      '<button class="btn btn--primary" id="start-btn">Открыть смену →</button>';

    stage.innerHTML = "";
    stage.appendChild(p);
    document.getElementById("start-btn").addEventListener("click", startGame);
  }

  function startGame() {
    state = {
      scenarios: shuffle(window.SUPRADYN_SCENARIOS),
      idx: 0,
      step: 0,
      score: 0,
      results: [],
      chat: [],
    };
    renderScenario();
  }

  /* ---------- сценарий ---------- */
  function renderScenario() {
    var sc = state.scenarios[state.idx];
    updateHud();

    // начинаем диалог с запроса посетителя (один раз на сценарий)
    if (state.step === 0 && state.chat.length === 0) {
      state.chat.push({ who: "npc", text: sc.request });
    }

    var p = el("section", "panel");

    // карточка посетителя
    var head = el("div", "customer");
    head.innerHTML =
      '<div class="customer__avatar">' + sc.customer.avatar + "</div>" +
      "<div><div class=\"customer__name\">" + sc.customer.name + "</div>" +
      '<span class="customer__tag">' + sc.customer.tag + "</span></div>";
    p.appendChild(head);

    // диалог
    var dialog = el("div", "dialog");
    state.chat.forEach(function (m) {
      dialog.appendChild(el("div", "bubble bubble--" + (m.who === "npc" ? "npc" : "me"), m.text));
    });
    p.appendChild(dialog);

    // текущий шаг
    var step = sc.steps[state.step];
    p.appendChild(el("div", "step-title", step.title));
    p.appendChild(el("p", "step-q", step.q));

    var opts = el("div", "options");
    var order = shuffle(step.options.map(function (o, i) { return i; }));
    order.forEach(function (i) {
      var o = step.options[i];
      var b = el("button", "option");
      b.textContent = o.text || o.t;
      b.dataset.i = i;
      b.addEventListener("click", function () { handleAnswer(i, opts, p); });
      opts.appendChild(b);
    });
    p.appendChild(opts);

    stage.innerHTML = "";
    stage.appendChild(p);
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAnswer(chosen, optsEl, panel) {
    var sc = state.scenarios[state.idx];
    var step = sc.steps[state.step];
    var opt = step.options[chosen];

    // блокируем кнопки, подсвечиваем
    Array.prototype.forEach.call(optsEl.children, function (btn) {
      btn.disabled = true;
      var i = +btn.dataset.i;
      if (i === chosen) {
        btn.classList.add(opt.ok ? "option--correct" : "option--wrong");
        btn.insertAdjacentHTML("afterbegin",
          '<span class="option__mark">' + (opt.ok ? "✓ " : "✕ ") + "</span>");
      } else if (step.options[i].ok) {
        btn.classList.add("option--correct");
        btn.insertAdjacentHTML("afterbegin", '<span class="option__mark">✓ </span>');
      } else {
        btn.classList.add("option--dim");
      }
    });

    // счёт
    if (!state.stepScored) {
      if (opt.ok) {
        state.score += POINTS_PER_STEP;
        state.correctThisScenario = (state.correctThisScenario || 0) + 1;
      }
      state.stepScored = true;
    }
    updateHud();

    // фидбэк
    var fb = el("div", "feedback feedback--" + (opt.ok ? "ok" : "no"));
    fb.innerHTML =
      '<div class="feedback__head">' + (opt.ok ? "✅ Верно" : "❌ Не лучший выбор") + "</div>" +
      "<div>" + opt.fb + "</div>" +
      '<div class="feedback__actions"><button class="btn btn--primary" id="next-btn">Продолжить →</button></div>';
    panel.appendChild(fb);
    fb.scrollIntoView({ behavior: "smooth", block: "nearest" });

    document.getElementById("next-btn").addEventListener("click", function () {
      advance(chosen);
    });
  }

  function advance(chosen) {
    var sc = state.scenarios[state.idx];
    var step = sc.steps[state.step];
    var opt = step.options[chosen];

    // фиксируем реплику игрока и (если есть) ответ посетителя на верный уточняющий вопрос
    state.chat.push({ who: "me", text: opt.text || opt.t });
    if (opt.ok && opt.reply) {
      state.chat.push({ who: "npc", text: opt.reply });
    }

    state.stepScored = false;
    state.step++;

    if (state.step < sc.steps.length) {
      renderScenario();
      return;
    }

    // сценарий завершён
    if (sc.closing) state.chat.push({ who: "npc", text: sc.closing });
    state.results.push({
      name: sc.customer.name,
      correct: state.correctThisScenario || 0,
      total: sc.steps.length,
    });
    state.correctThisScenario = 0;
    state.step = 0;
    state.chat = [];
    state.idx++;

    if (state.idx < state.scenarios.length) {
      renderScenario();
    } else {
      renderResult();
    }
  }

  /* ---------- итог ---------- */
  function renderResult() {
    var maxScore = state.scenarios.length * 3 * POINTS_PER_STEP;
    var pct = Math.round((state.score / maxScore) * 100);

    var best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
    var isRecord = state.score > best;
    if (isRecord) localStorage.setItem(BEST_KEY, String(state.score));

    var grade, emoji, msg;
    if (pct >= 90) {
      grade = "Эксперт за стойкой"; emoji = "🏆";
      msg = "Блестящая работа! Вы уверенно ведёте диалог, задаёте верные вопросы и точно подбираете продукты линейки.";
    } else if (pct >= 70) {
      grade = "Уверенный фармацевт"; emoji = "🌟";
      msg = "Хороший результат! Основу вы держите крепко. Сверьтесь со справочником по спорным кейсам — и будет идеально.";
    } else if (pct >= 50) {
      grade = "Растущий специалист"; emoji = "📈";
      msg = "Неплохое начало. Обратите внимание на возрастные ограничения и «красные флаги» (беременность, высокая температура).";
    } else {
      grade = "Нужна тренировка"; emoji = "📚";
      msg = "Не беда! Откройте справочник, разберите линейку по возрастам и задачам — и пройдите смену ещё раз.";
    }

    var p = el("section", "panel result");
    var rows = state.results.map(function (r) {
      var cls = "badge--" + r.correct;
      return '<div class="breakdown__row"><span>' + r.name + "</span>" +
        '<span class="badge ' + cls + '">' + r.correct + " / " + r.total + " ✓</span></div>";
    }).join("");

    p.innerHTML =
      '<div class="result__emoji">' + emoji + "</div>" +
      '<div class="result__grade">' + grade + "</div>" +
      '<div class="result__score">' + state.score + " из " + maxScore + " баллов · " + pct + "%" +
      (isRecord ? "  🎉 новый рекорд!" : "") + "</div>" +
      '<div class="scorebar"><div class="scorebar__fill" style="width:0%"></div></div>' +
      '<p class="result__msg">' + msg + "</p>" +
      '<div class="breakdown"><h3>Разбор по посетителям</h3>' + rows + "</div>" +
      '<div class="result__actions" style="margin-top:20px">' +
      '<button class="btn btn--primary" id="again-btn">Сыграть ещё раз</button>' +
      '<button class="btn btn--ghost" id="ref-btn2">📖 Справочник</button>' +
      "</div>";

    stage.innerHTML = "";
    stage.appendChild(p);
    updateHud();
    // анимация шкалы
    requestAnimationFrame(function () {
      var fill = p.querySelector(".scorebar__fill");
      if (fill) fill.style.width = pct + "%";
    });

    document.getElementById("again-btn").addEventListener("click", startGame);
    document.getElementById("ref-btn2").addEventListener("click", openReference);
  }

  /* ---------- справочник ---------- */
  var modal = document.getElementById("ref-modal");
  function buildReference() {
    var body = document.getElementById("ref-body");
    if (body.childElementCount) return;
    window.SUPRADYN_PRODUCTS.forEach(function (pr) {
      var card = el("div", "prod");
      var chips = pr.indications.map(function (s) {
        return '<span class="chip">' + s + "</span>";
      }).join("");
      card.innerHTML =
        '<div class="prod__top"><span class="prod__icon">' + pr.icon + "</span>" +
        '<div><div class="prod__name">' + pr.name + "</div>" +
        '<div class="prod__tag">' + pr.tagline + "</div></div></div>" +
        '<div class="prod__meta">' +
        "<b>Кому:</b> " + pr.audience + "<br>" +
        "<b>Форма:</b> " + pr.form + "<br>" +
        "<b>Состав:</b> " + pr.composition + "<br>" +
        "<b>Приём:</b> " + pr.usage +
        "</div>" +
        '<div class="prod__chips">' + chips + "</div>";
      body.appendChild(card);
    });
  }
  function openReference() {
    buildReference();
    modal.hidden = false;
  }
  function closeReference() { modal.hidden = true; }

  document.getElementById("ref-btn").addEventListener("click", openReference);
  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeReference();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeReference();
  });

  /* ---------- запуск ---------- */
  renderStart();
})();
