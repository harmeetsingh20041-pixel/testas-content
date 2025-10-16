import { subscribeToAuthChanges } from './auth.js';

const moduleGuards = new Map();
const guardTargets = new Map();
let currentRole = 'guest';

function normaliseRoles(roles) {
  return roles.map((role) => String(role).toLowerCase());
}

function registerModuleGuard(code, roles, message) {
  moduleGuards.set(code, {
    roles: normaliseRoles(roles),
    message,
  });
  updateGuardForCode(code);
}

function attachGuardTarget(code, element) {
  if (!guardTargets.has(code)) {
    guardTargets.set(code, new Set());
  }
  guardTargets.get(code).add(element);
  updateGuardForCode(code, element);
}

function updateGuardForCode(code, singleTarget) {
  const guard = moduleGuards.get(code);
  if (!guard) return;
  const targets = singleTarget ? [singleTarget] : Array.from(guardTargets.get(code) ?? []);
  const allowed = guard.roles.includes(currentRole);
  targets.forEach((target) => {
    target.classList.toggle('tile-locked', !allowed);
    target.dataset.locked = allowed ? 'false' : 'true';
    target.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    if (!allowed && guard.message) {
      target.title = guard.message;
    } else {
      target.removeAttribute('title');
    }
  });
}

function updateAllGuards() {
  moduleGuards.forEach((_guard, code) => updateGuardForCode(code));
}

function canAccessModule(code) {
  const guard = moduleGuards.get(code);
  if (!guard) return true;
  return guard.roles.includes(currentRole);
}

function guardMessage(code) {
  return moduleGuards.get(code)?.message ?? 'This module is restricted.';
}

registerModuleGuard(
  'CORE-FIG',
  ['admin', 'staff', 'member'],
  'Sign in with a member, staff, or admin account to unlock figural sequences.'
);

subscribeToAuthChanges((state) => {
  currentRole = (state.profile?.role ?? 'guest').toLowerCase();
  updateAllGuards();
});

const URLS = {
  modules: './data/modules.json',
  core: {
    'CORE-FIG': './data/core/fig.json',
    'CORE-MATH': './data/core/math.json',
    'CORE-LAT': './data/core/latin.json',
  },
  subjects: {
    ECON: './data/subjects/econ.json',
  },
};

const elCore = document.getElementById('core-grid');
const elSubj = document.getElementById('subject-grid');
const btnStartCore = document.getElementById('btn-start-core');
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const fetchJSON = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed: ${url}`);
  return response.json();
};

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const modules = await fetchJSON(URLS.modules);

modules.core.subtests
  .sort((a, b) => a.order - b.order)
  .forEach((sub) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile core';
    tile.dataset.moduleCode = sub.code;
    tile.textContent = `${sub.order}. ${sub.name}`;
    tile.addEventListener('click', (event) => {
      event.preventDefault();
      startCore(sub.code);
    });
    elCore?.appendChild(tile);
    attachGuardTarget(sub.code, tile);
  });

modules.subjects.forEach((subject) => {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile subject';
  tile.dataset.moduleCode = subject.code;
  tile.textContent = subject.name;
  tile.addEventListener('click', () => startSubject(subject.code));
  elSubj?.appendChild(tile);
});

if (btnStartCore && modules.core.subtests.length) {
  btnStartCore.addEventListener('click', () => {
    const firstCode = modules.core.subtests[0].code;
    startCore(firstCode);
  });
}

function ensureAccessOrNotify(code) {
  if (canAccessModule(code)) return true;
  alert(guardMessage(code));
  return false;
}

async function startCore(code) {
  if (!ensureAccessOrNotify(code)) return;

  if (code === 'CORE-FIG') {
    window.location.href = './core/figural/';
    return;
  }
  if (code === 'CORE-MATH') {
    window.location.href = './core/math/';
    return;
  }
  if (code === 'CORE-LAT') {
    window.location.href = './core/latin/';
    return;
  }

  const url = URLS.core[code];
  if (!url) {
    alert('Subtest not set up yet.');
    return;
  }
  const data = await fetchJSON(url);
  runQuiz(data.subtest, data.questions, { mode: 'core' });
}

async function startSubject(code) {
  if (code === 'MED') {
    window.location.href = './subjects/medicine/';
    return;
  }
  const url = URLS.subjects[code];
  if (!url) {
    alert('Subject not set up yet.');
    return;
  }
  const data = await fetchJSON(url);
  const questions = shuffle(data.questions);
  runQuiz(data.subject, questions, { mode: 'subject' });
}

function runQuiz(title, questions, opts) {
  const container = document.querySelector('.page');
  if (!container) return;
  container.innerHTML = `
    <div class="wrap">
      <header style="display:flex;align-items:center;gap:12px;margin:30px 0 10px 0;">
        <span class="dot" style="width:12px;height:12px;border-radius:50%;background:var(--sf-red);"></span>
        <div class="brand" style="font-weight:700;font-size:18px;">
          Study Feeds • TestAS Practice
        </div>
        <span class="tag" style="margin-left:auto;background:var(--sf-red);color:#fff;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;">
          ${opts.mode === 'core' ? 'Core' : 'Subject'}
        </span>
      </header>
    </div>
    <section class="wrap hero" style="margin-bottom:30px;">
      <div class="hero-content">
        <h1 style="font-size:32px;">${title.replace('CORE-', '')}</h1>
        <p class="muted" style="color:var(--sf-muted);">Question <span id="p-count">1</span> / ${questions.length}</p>
        <div class="hero-actions">
          <button class="btn" id="btn-back">← Back to Modules</button>
        </div>
      </div>
      <div class="hero-visual" style="justify-content:center;">
        <div class="stat" style="background:#fff;border-radius:16px;padding:22px 24px;box-shadow:var(--shadow-soft);">
          <strong style="font-size:28px;color:var(--sf-dark);">Stay focused</strong>
          <span>Work through one task at a time and review the explanation afterwards.</span>
        </div>
      </div>
    </section>
    <section class="wrap section" style="margin-top:0;">
      <div class="module-panel" style="box-shadow:var(--shadow-soft);">
        <div id="quiz"></div>
      </div>
    </section>
    <footer style="margin:60px 0 30px;text-align:center;font-size:13px;color:var(--sf-muted);">
      © ${new Date().getFullYear()} Study Feeds Practice
    </footer>
  `;
  document.getElementById('btn-back').onclick = () => (window.location.href = './');

  let index = 0;
  let correct = 0;
  const review = [];
  const mount = document.getElementById('quiz');
  renderQuestion();

  function renderQuestion(showExplanation = false) {
    const question = questions[index];
    document.getElementById('p-count').textContent = index + 1;
    mount.innerHTML = `
      <p style="font-weight:600;margin:0 0 8px 0;">${question.stem}</p>
      ${question.image_url ? `<img src="${question.image_url}" alt="" style="max-width:100%;border:1px solid #eee;border-radius:12px;margin:12px 0;">` : ''}
      <div style="display:grid;gap:12px;">
        ${question.choices
          .map(
            (choice) => `
              <button class="btn" data-choice="${choice.label}">
                ${choice.label ? `<strong>${choice.label}.</strong> ` : ''}${choice.text}
              </button>
            `
          )
          .join('')}
      </div>
      ${
        showExplanation
          ? `
        <div class="feature-card" style="margin-top:16px;background:#fff4f4;border:1px solid rgba(227,6,19,.18);">
          <strong>Explanation</strong><br>${question.explanation || '—'}
        </div>`
          : ''
      }
    `;

    mount.querySelectorAll('button[data-choice]').forEach((button) => {
      button.onclick = () => {
        const choice = question.choices.find((item) => item.label === button.dataset.choice);
        const isCorrect = Boolean(choice?.is_correct);
        if (isCorrect) correct += 1;
        review.push({
          stem: question.stem,
          choice: choice?.label,
          ok: isCorrect,
          explanation: question.explanation,
        });
        renderQuestion(true);
        setTimeout(() => {
          index += 1;
          if (index >= questions.length) {
            renderResults();
          } else {
            renderQuestion();
          }
        }, 750);
      };
    });
  }

  function renderResults() {
    mount.innerHTML = `
      <div style="text-align:center;display:grid;gap:18px;">
        <div>
          <h3 style="margin:0 0 6px 0;">Result</h3>
          <p style="margin:0;">You answered <strong>${correct}</strong> out of ${questions.length} correctly.</p>
        </div>
        <div class="hero-actions" style="justify-content:center;">
          <button class="btn btn-primary" id="btn-review">Review explanations</button>
          <button class="btn" id="btn-home">Back to Modules</button>
        </div>
      </div>
    `;
    document.getElementById('btn-home').onclick = () => (window.location.href = './');
    document.getElementById('btn-review').onclick = () => {
      mount.innerHTML = `
        ${review
          .map(
            (entry) => `
              <div class="feature-card" style="margin-bottom:12px;">
                <p style="margin:0 0 6px 0;">${entry.stem}</p>
                <p class="muted" style="margin:0 0 6px 0;color:${entry.ok ? '#0f5132' : '#842029'};">
                  ${entry.ok ? '✅ Correct' : '❌ Wrong'} — Your choice: ${entry.choice ?? '—'}
                </p>
                <div>${entry.explanation || '—'}</div>
              </div>
            `
          )
          .join('')}
        <div class="hero-actions" style="margin-top:16px;">
          <button class="btn" onclick="location.href='./'">Back to Modules</button>
        </div>
      `;
    };
  }
}
