/**
 * R6 Suspect Check UI.
 * The analysis rules live server-side in lib/analyze.js and are exposed by /api/v1/analyze.
 */
const CURRENT_SEASON_NUM = 18;
const MIN_LEVEL_FOR_RANKED = 50;

const form = document.getElementById('stats-form');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');
const formError = document.getElementById('form-error');

let pendingSavePayload = null;

function buildSeasonCheckboxes() {
  const grid = document.getElementById('season-grid');
  if (!grid) return;

  for (let i = 1; i <= CURRENT_SEASON_NUM; i++) {
    const wrap = document.createElement('label');
    wrap.className = 'season-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'season';
    input.value = String(i);

    const text = document.createElement('span');
    text.textContent =
      i === CURRENT_SEASON_NUM ? `Season ${i} (current)` : `Season ${i}`;

    wrap.appendChild(input);
    wrap.appendChild(text);
    grid.appendChild(wrap);
  }
}

function getPlayedSeasons() {
  const checked = document.querySelectorAll('input[name="season"]:checked');
  const nums = Array.from(checked).map((el) => parseInt(el.value, 10));
  return nums.filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}

function hideFormError() {
  formError.textContent = '';
  formError.classList.add('hidden');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setFormLoading(isLoading) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Analyzing...' : 'Analyze profile';
}

function readFormPayload() {
  const level = parseInt(document.getElementById('level').value, 10);
  if (!Number.isFinite(level) || level < MIN_LEVEL_FOR_RANKED) {
    throw new Error(
      `Ranked is only available from level ${MIN_LEVEL_FOR_RANKED} in-game. Add a level of ${MIN_LEVEL_FOR_RANKED} or higher, or this ranked profile is not usable here.`
    );
  }

  const playedSeasons = getPlayedSeasons();
  if (playedSeasons.length === 0) {
    throw new Error('Tick at least one ranked season this account has played.');
  }

  const kd = parseFloat(document.getElementById('kd').value) || 0;
  const winrateRaw = document.getElementById('winrate').value;
  const winrate = winrateRaw === '' ? null : parseFloat(winrateRaw);
  const ranked = parseInt(document.getElementById('ranked').value, 10) || 0;
  const rankKey = document.getElementById('rank').value;

  return {
    pseudo: document.getElementById('pseudo').value.trim() || null,
    kd,
    winrate: Number.isNaN(winrate) ? null : winrate,
    ranked,
    level,
    rankKey: rankKey || null,
    playedSeasons,
  };
}

function buildSavePayload(input, analysis) {
  return {
    ...input,
    verdict: analysis.verdict,
    verdictLabel: analysis.verdictLabel,
    cheatScore: analysis.cheatScore,
    smurfScore: analysis.smurfScore,
    finalScore: analysis.finalScore,
    confidence: analysis.confidence,
    classification: analysis.classification,
    analysis: analysis.analysis,
    reasons: analysis.reasons,
  };
}

function displayResult(analysis) {
  const {
    verdictLabel,
    verdictClass,
    cheatScore,
    smurfScore,
    finalScore,
    confidence,
    classification,
    reasons,
  } = analysis;

  const finalVal =
    typeof finalScore === 'number'
      ? Math.round(finalScore)
      : Math.max(cheatScore, smurfScore);
  const confLabel = confidence || '—';
  const classLabel = classification || '—';

  resultContent.innerHTML = `
    <div class="verdict ${escapeHtml(verdictClass || 'uncertain')}">${escapeHtml(verdictLabel)}</div>
    <p class="result-meta"><strong>Classification:</strong> ${escapeHtml(classLabel)} · <strong>Confidence:</strong> ${escapeHtml(confLabel)} · <strong>Final suspicion:</strong> ${finalVal}/100</p>
    <p class="result-meta hint">Scale: 0 normal · ~50 suspicious · 75+ very suspicious · 90+ highly abnormal.</p>
    <p><strong>Cheat axis:</strong> ${Math.round(cheatScore)}%</p>
    <div class="score-bar"><div class="score-fill suspect" style="width: ${Math.round(cheatScore)}%"></div></div>
    <p><strong>Smurf axis:</strong> ${Math.round(smurfScore)}%</p>
    <div class="score-bar"><div class="score-fill smurf" style="width: ${Math.round(smurfScore)}%"></div></div>
    ${
      reasons && reasons.length
        ? `<ul class="reasons">${reasons.map((r) => `<li class="${escapeHtml(r.type || '')}">${escapeHtml(r.text)}</li>`).join('')}</ul>`
        : ''
    }
    <div class="save-db-block">
      <p class="hint save-db-hint">Optional: save this check to PostgreSQL (works when the site is deployed with <code>DATABASE_URL</code>, e.g. on Vercel).</p>
      <div class="save-db-row">
        <input type="password" id="save-key-input" class="save-key-input" placeholder="Save key (only if server uses SAVE_API_KEY)" autocomplete="off" />
        <button type="button" class="btn-save-db js-save-submission">Save to database</button>
        <button type="button" class="btn-save-db js-copy-report">Copy report</button>
      </div>
      <p id="save-db-feedback" class="save-db-feedback hidden" role="status"></p>
    </div>
  `;
}

async function copyShareableReport() {
  const feedback = document.getElementById('save-db-feedback');
  if (!pendingSavePayload || !feedback) return;

  feedback.classList.add('hidden');
  feedback.classList.remove('save-db-feedback--ok', 'save-db-feedback--err');

  try {
    await navigator.clipboard.writeText(window.R6Report.buildShareableReport(pendingSavePayload));
    feedback.textContent = 'Report copied to clipboard.';
    feedback.classList.add('save-db-feedback--ok');
  } catch {
    feedback.textContent = 'Clipboard is unavailable in this browser. Select and copy the result manually.';
    feedback.classList.add('save-db-feedback--err');
  }
  feedback.classList.remove('hidden');
}

async function submitSaveToDb() {
  const feedback = document.getElementById('save-db-feedback');
  const btn = resultContent.querySelector('.js-save-submission');
  const keyInput = document.getElementById('save-key-input');
  if (!pendingSavePayload || !btn) return;

  feedback.classList.add('hidden');
  feedback.classList.remove('save-db-feedback--ok', 'save-db-feedback--err');
  btn.disabled = true;

  const key = keyInput && keyInput.value ? keyInput.value.trim() : '';

  try {
    await window.R6Api.saveSubmission(pendingSavePayload, key);
    feedback.textContent = 'Saved to database.';
    feedback.classList.remove('hidden');
    feedback.classList.add('save-db-feedback--ok');
    btn.textContent = 'Saved';
    btn.disabled = true;
  } catch (err) {
    feedback.textContent =
      err.message ||
      'Could not reach the API. Use a local server with Vercel (`vercel dev`) or deploy to Vercel with DATABASE_URL.';
    feedback.classList.remove('hidden');
    feedback.classList.add('save-db-feedback--err');
    btn.disabled = false;
  }
}

resultSection.addEventListener('click', (e) => {
  if (e.target.closest('.js-save-submission')) {
    void submitSaveToDb();
  }
  if (e.target.closest('.js-copy-report')) {
    void copyShareableReport();
  }
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  hideFormError();
  resultSection.classList.add('hidden');

  let input;
  try {
    input = readFormPayload();
  } catch (err) {
    showFormError(err.message);
    return;
  }

  setFormLoading(true);
  try {
    const response = await window.R6Api.analyzeProfile(input);
    const analysis = response.data;
    pendingSavePayload = buildSavePayload(input, analysis);
    displayResult(analysis);
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showFormError(
      err.message ||
        'Could not analyze the profile. Start the local server with npm run dev or use the deployed app.'
    );
  } finally {
    setFormLoading(false);
  }
});

buildSeasonCheckboxes();

/** Low-volume ambience (autoplay blocked — user must use the toggle). */
(function initAmbienceAudio() {
  const audio = document.getElementById('bg-audio');
  const toggle = document.getElementById('audio-toggle');
  if (!audio || !toggle) return;

  const LOW_VOLUME = 0.14;
  audio.volume = LOW_VOLUME;

  function setPlaying(playing) {
    toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
    toggle.textContent = playing ? '♪ On' : '♪ Ambience';
  }

  toggle.addEventListener('click', () => {
    if (audio.paused) {
      audio.volume = LOW_VOLUME;
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  });

  audio.addEventListener('ended', () => setPlaying(false));
})();
