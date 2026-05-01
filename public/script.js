/**
 * R6 Suspect Check — ranked-only heuristics for “cheat-like” vs “smurf-like” profiles.
 * Bump this when a new ranked season starts (highest index = current).
 */
const CURRENT_SEASON_NUM = 18;

const MIN_LEVEL_FOR_RANKED = 50;
/** Gap between two played season numbers → “skipped” seasons; >= this suggests smurf breaks. */
const SMURF_GAP_SEASONS = 4;

const RANK_ORDER = {
  copper: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
  emerald: 6,
  diamond: 7,
  champion: 8,
};

const form = document.getElementById('stats-form');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');
const formError = document.getElementById('form-error');

/** Snapshot for optional POST /api/submissions after analysis */
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

/** Match volume → confidence in scores (prompt: <100 unreliable, 100–300 medium, >300 high). */
function matchConfidence(ranked) {
  if (ranked < 100) {
    return {
      label: 'low',
      cheatMult: 0.72,
      smurfMult: 1.18,
      unreliableBoost: 14,
    };
  }
  if (ranked <= 300) {
    return { label: 'medium', cheatMult: 1, smurfMult: 1, unreliableBoost: 0 };
  }
  return { label: 'high', cheatMult: 1.06, smurfMult: 0.94, unreliableBoost: 0 };
}

/** Base K/D suspicion (cheat axis) before rank context. */
function kdBaseCheat(kd) {
  if (kd < 1.0) return 0;
  if (kd < 1.4) return 10;
  if (kd < 1.8) return 34;
  if (kd < 2.2) return 58;
  return 84;
}

/**
 * High rank: same K/D is harder to sustain legit → cheat weight ↑.
 * Low rank (silver/gold…): strong K/D often reads as smurf / good aim, not wallhacks → cheat weight ↓.
 */
function rankKdCheatMultiplier(rankStep) {
  if (rankStep >= RANK_ORDER.champion) return 1.22;
  if (rankStep >= RANK_ORDER.diamond) return 1.18;
  if (rankStep >= RANK_ORDER.emerald) return 1.12;
  if (rankStep >= RANK_ORDER.platinum) return 1.05;
  if (rankStep >= RANK_ORDER.gold) return 0.88;
  if (rankStep >= RANK_ORDER.silver) return 0.82;
  if (rankStep > 0) return 0.78;
  return 0.9;
}

/** Extra smurf signal when K/D is strong but lobby rank is low (mechanical smurf / alt). */
function rankKdSmurfBoost(kd, rankStep) {
  if (kd < 1.35 || rankStep <= 0) return 0;
  if (rankStep <= RANK_ORDER.gold) {
    return Math.min(38, (kd - 1.35) * 48);
  }
  if (rankStep === RANK_ORDER.platinum && kd >= 1.5 && kd < 2.0) {
    return Math.min(18, (kd - 1.45) * 28);
  }
  return 0;
}

function winrateCheatContribution(winrate, hasWinrate) {
  if (!hasWinrate) return 0;
  if (winrate < 45) return 0;
  if (winrate <= 55) return 0;
  if (winrate <= 60) return 10;
  if (winrate <= 65) return 26;
  if (winrate <= 75) return 44;
  return 64;
}

function largestSeasonGap(sortedSeasons) {
  if (sortedSeasons.length < 2) return 0;
  let maxGap = 0;
  for (let i = 0; i < sortedSeasons.length - 1; i++) {
    const skipped = sortedSeasons[i + 1] - sortedSeasons[i] - 1;
    if (skipped > maxGap) maxGap = skipped;
  }
  return maxGap;
}

function onlyCurrentSeasonPlayed(sortedSeasons) {
  return (
    sortedSeasons.length === 1 && sortedSeasons[0] === CURRENT_SEASON_NUM
  );
}

function analyzeProfile(input) {
  const reasons = [];
  let cheatRaw = 0;
  let smurfRaw = 0;

  const {
    kd,
    winrate,
    ranked,
    level,
    rankStep,
    rankKey,
    playedSeasons,
  } = input;

  const hasWinrate = winrate !== undefined && !Number.isNaN(winrate);
  const conf = matchConfidence(ranked);
  const rankLabel = rankKey || 'not set';

  reasons.push({
    text: `Confidence: ${conf.label} (${ranked} ranked matches — ${ranked < 100 ? 'sample unreliable for strong conclusions' : ranked <= 300 ? 'medium statistical weight' : 'high statistical weight'}).`,
    type: '',
  });

  // --- K/D (tier + rank context) ---
  const kdCheatBase = kdBaseCheat(kd);
  const rankMult = rankKdCheatMultiplier(rankStep);
  let kdCheat = kdCheatBase * rankMult;
  const smurfFromKdRank = rankKdSmurfBoost(kd, rankStep);
  smurfRaw += smurfFromKdRank;

  if (rankStep >= RANK_ORDER.emerald && kd >= 1.4 && kd < 1.8) {
    reasons.push({
      text: `K/D ${kd} in ${rankLabel} lobbies: very strong for rank — shifts toward cheat-style suspicion more than in low ranks.`,
      type: 'negative',
    });
  } else if (
    rankStep > 0 &&
    rankStep <= RANK_ORDER.gold &&
    kd >= 1.4 &&
    kd < 1.85
  ) {
    reasons.push({
      text: `K/D ${kd} in ${rankLabel}: often reads as smurf or very strong player; less cheat-likely than the same K/D in Emerald+.`,
      type: 'negative',
    });
  }

  cheatRaw += kdCheat;

  reasons.push({
    text: `K/D ${kd} → base cheat weight ${Math.round(kdCheatBase)}, rank multiplier ×${rankMult.toFixed(2)} (${rankLabel}) → ${Math.round(kdCheat)} toward cheat axis.`,
    type: kdCheat >= 35 ? 'negative' : 'positive',
  });

  if (smurfFromKdRank > 0) {
    reasons.push({
      text: `Rank context adds +${Math.round(smurfFromKdRank)} smurf-style (strong stats in lower lobby / plat gate).`,
      type: 'negative',
    });
  }

  // --- Win rate ---
  const wrCheat = winrateCheatContribution(winrate, hasWinrate);
  cheatRaw += wrCheat;
  if (wrCheat > 0) {
    reasons.push({
      text: `Win rate ${hasWinrate ? `${winrate}%` : 'n/a'} → +${wrCheat} toward cheat (${winrate > 75 ? 'extremely suspicious band' : winrate > 65 ? 'suspicious' : 'elevated'}).`,
      type: 'negative',
    });
  }
  if (hasWinrate && winrate >= 45 && winrate <= 55 && ranked >= 150) {
    cheatRaw -= 8;
    reasons.push({
      text: `Win rate ${winrate}% in normal band (45–55%) with enough games — lowers cheat noise.`,
      type: 'positive',
    });
  }

  if (conf.unreliableBoost > 0) {
    smurfRaw += conf.unreliableBoost;
    reasons.push({
      text: `Few matches: +${conf.unreliableBoost} smurf-style (boost / alt / unreliable sample). Cheat/smurf axes scaled by confidence after all rules.`,
      type: 'negative',
    });
  }

  // --- Account level ---
  if (level < 80 && (kd >= 1.5 || (hasWinrate && winrate > 60))) {
    smurfRaw += 24;
    reasons.push({
      text: `Level ${level} with strong combat stats → strong smurf / alt signal (prompt: <80 + strong stats).`,
      type: 'negative',
    });
  }
  if (level < 120 && kd >= 1.8) {
    cheatRaw += 12;
    smurfRaw += 14;
    reasons.push({
      text: `Level ${level} with very high K/D (${kd}) → suspicious; split between smurf and cheat risk.`,
      type: 'negative',
    });
  }
  if (level > 150) {
    smurfRaw -= 14;
    cheatRaw -= 10;
    reasons.push({
      text: `Level ${level} → more credible main (reduces smurf/cheat noise).`,
      type: 'positive',
    });
  }

  // --- Seasons played ---
  const nSeasons = playedSeasons.length;
  if (nSeasons <= 2) {
    smurfRaw += 20;
    reasons.push({
      text: `Only ${nSeasons} ranked season(s) ticked → smurf indicator (1–2 seasons).`,
      type: 'negative',
    });
  } else if (nSeasons >= 3 && nSeasons <= 5) {
    reasons.push({
      text: `${nSeasons} seasons → normal “active account” band.`,
      type: 'positive',
    });
  } else if (nSeasons > 6) {
    smurfRaw -= 14;
    cheatRaw -= 6;
    reasons.push({
      text: `${nSeasons} seasons → established account (reduces smurf prior).`,
      type: 'positive',
    });
  }

  // --- Season pattern extras ---
  if (onlyCurrentSeasonPlayed(playedSeasons)) {
    cheatRaw += 22;
    smurfRaw += 18;
    reasons.push({
      text: 'Only current season ranked — new account / boost / volatile pattern.',
      type: 'negative',
    });
  }

  const bigGap = largestSeasonGap(playedSeasons);
  if (bigGap >= SMURF_GAP_SEASONS) {
    smurfRaw += Math.min(36, 10 + bigGap * 2.5);
    reasons.push({
      text: `Large season gap (${bigGap} skipped) — sporadic alt pattern.`,
      type: 'negative',
    });
  }

  if (nSeasons >= 6 && bigGap < SMURF_GAP_SEASONS) {
    smurfRaw -= 12;
    cheatRaw -= 6;
    reasons.push({
      text: 'Many seasons without long breaks — looks like a main.',
      type: 'positive',
    });
  }

  // --- Consistency: high K/D + many matches → cheat; high K/D + low level → smurf ---
  if (ranked > 300 && kd >= 1.8) {
    cheatRaw += 16;
    reasons.push({
      text: 'High K/D sustained over 300+ ranked matches → cheat suspicion increases (consistency rule).',
      type: 'negative',
    });
  }
  if (level < 100 && kd >= 1.5) {
    smurfRaw += 16;
    reasons.push({
      text: 'High K/D with account level under 100 → smurf suspicion increases (consistency rule).',
      type: 'negative',
    });
  }

  cheatRaw *= conf.cheatMult;
  smurfRaw *= conf.smurfMult;

  let cheatScore = Math.max(0, Math.min(100, Math.round(cheatRaw)));
  let smurfScore = Math.max(0, Math.min(100, Math.round(smurfRaw)));

  const baseMax = Math.max(cheatScore, smurfScore);
  let finalScore = baseMax;
  if (conf.label === 'low') {
    finalScore = Math.min(100, Math.round(baseMax * 0.86));
  } else if (conf.label === 'high' && ranked > 300 && kd >= 1.75) {
    finalScore = Math.min(100, Math.round(baseMax * 1.04));
  }

  let classification = 'mixed — manual review';
  if (finalScore < 38 && cheatScore < 36 && smurfScore < 38) {
    classification = 'legit';
  } else if (smurfScore >= cheatScore + 14 && smurfScore >= 42) {
    classification = 'smurf';
  } else if (cheatScore >= smurfScore + 14 && cheatScore >= 42) {
    classification = 'possible cheater';
  } else if (finalScore >= 72) {
    classification =
      cheatScore >= smurfScore ? 'possible cheater' : 'smurf';
  } else if (finalScore >= 55 && (cheatScore >= 50 || smurfScore >= 50)) {
    classification =
      cheatScore > smurfScore ? 'possible cheater' : 'smurf';
  }

  const analysis = `Classification: ${classification}. Confidence ${conf.label}. Final suspicion ${finalScore}/100 (50≈suspicious, 75+ very suspicious, 90+ highly abnormal). Cheat axis ${cheatScore}, smurf axis ${smurfScore}.`;

  reasons.push({
    text: analysis,
    type:
      classification === 'legit'
        ? 'positive'
        : classification.includes('cheater')
          ? 'negative'
          : 'negative',
  });

  let verdict = 'uncertain';
  let verdictLabel = 'Inconclusive';
  let verdictClass = 'uncertain';

  if (classification === 'legit') {
    verdict = 'clean';
    verdictLabel = 'Legit — within normal competitive ranges';
    verdictClass = 'clean';
  } else if (classification === 'smurf') {
    verdict = 'smurf';
    verdictLabel = 'Smurf / alt — pattern fits secondary account';
    verdictClass = 'smurf';
  } else if (classification === 'possible cheater') {
    verdict = 'suspect';
    verdictLabel = 'Possible cheater — stats warrant scrutiny (not proof)';
    verdictClass = 'suspect';
  } else if (finalScore >= 50) {
    verdict = 'uncertain';
    verdictLabel = `Elevated suspicion (${finalScore}/100) — mixed smurf/cheat signals`;
    verdictClass = 'uncertain';
  } else {
    verdictLabel = 'Mixed / low confidence — manual review';
    verdictClass = 'uncertain';
  }

  return {
    verdict,
    verdictLabel,
    verdictClass,
    cheatScore,
    smurfScore,
    finalScore,
    confidence: conf.label,
    classification,
    analysis,
    reasons,
  };
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
  const s = String(text);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    typeof finalScore === 'number' ? Math.round(finalScore) : Math.max(cheatScore, smurfScore);
  const confLabel = confidence || '—';
  const classLabel = classification || '—';

  resultContent.innerHTML = `
    <div class="verdict ${verdictClass}">${escapeHtml(verdictLabel)}</div>
    <p class="result-meta"><strong>Classification:</strong> ${escapeHtml(classLabel)} · <strong>Confidence:</strong> ${escapeHtml(confLabel)} · <strong>Final suspicion:</strong> ${finalVal}/100</p>
    <p class="result-meta hint">Scale: 0 normal · ~50 suspicious · 75+ very suspicious · 90+ highly abnormal.</p>
    <p><strong>Cheat axis:</strong> ${Math.round(cheatScore)}%</p>
    <div class="score-bar"><div class="score-fill suspect" style="width: ${Math.round(cheatScore)}%"></div></div>
    <p><strong>Smurf axis:</strong> ${Math.round(smurfScore)}%</p>
    <div class="score-bar"><div class="score-fill smurf" style="width: ${Math.round(smurfScore)}%"></div></div>
    ${
      reasons.length
        ? `<ul class="reasons">${reasons.map((r) => `<li class="${escapeHtml(r.type || '')}">${escapeHtml(r.text)}</li>`).join('')}</ul>`
        : ''
    }
    <div class="save-db-block">
      <p class="hint save-db-hint">Optional: save this check to PostgreSQL (works when the site is deployed with <code>DATABASE_URL</code>, e.g. on Vercel).</p>
      <div class="save-db-row">
        <input type="password" id="save-key-input" class="save-key-input" placeholder="Save key (only if server uses SAVE_API_KEY)" autocomplete="off" />
        <button type="button" class="btn-save-db js-save-submission">Save to database</button>
      </div>
      <p id="save-db-feedback" class="save-db-feedback hidden" role="status"></p>
    </div>
  `;
}

async function submitSaveToDb() {
  const feedback = document.getElementById('save-db-feedback');
  const btn = resultContent.querySelector('.js-save-submission');
  const keyInput = document.getElementById('save-key-input');
  if (!pendingSavePayload || !btn) return;

  feedback.classList.add('hidden');
  feedback.classList.remove('save-db-feedback--ok', 'save-db-feedback--err');
  btn.disabled = true;

  const headers = { 'Content-Type': 'application/json' };
  const key = keyInput && keyInput.value ? keyInput.value.trim() : '';
  if (key) headers['x-save-key'] = key;

  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify(pendingSavePayload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Save failed (${res.status})`);
    }
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
});

form.addEventListener('submit', function (e) {
  e.preventDefault();
  hideFormError();

  const level = parseInt(document.getElementById('level').value, 10);
  if (!Number.isFinite(level) || level < MIN_LEVEL_FOR_RANKED) {
    showFormError(
      `Ranked is only available from level ${MIN_LEVEL_FOR_RANKED} in-game. Add a level of ${MIN_LEVEL_FOR_RANKED} or higher, or this ranked profile is not usable here.`
    );
    resultSection.classList.add('hidden');
    return;
  }

  const playedSeasons = getPlayedSeasons();
  if (playedSeasons.length === 0) {
    showFormError('Tick at least one ranked season this account has played.');
    resultSection.classList.add('hidden');
    return;
  }

  const kd = parseFloat(document.getElementById('kd').value) || 0;
  const winrateRaw = document.getElementById('winrate').value;
  const winrate =
    winrateRaw === '' ? NaN : parseFloat(winrateRaw);
  const ranked = parseInt(document.getElementById('ranked').value, 10) || 0;
  const rankKey = document.getElementById('rank').value;
  const rankStep = rankKey ? RANK_ORDER[rankKey] || 0 : 0;

  const analysis = analyzeProfile({
    kd,
    winrate,
    ranked,
    level,
    rankStep,
    rankKey,
    playedSeasons,
  });

  pendingSavePayload = {
    pseudo: document.getElementById('pseudo').value.trim() || null,
    kd,
    winrate: Number.isNaN(winrate) ? null : winrate,
    ranked,
    level,
    rankKey: rankKey || null,
    playedSeasons,
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

  displayResult(analysis);
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

buildSeasonCheckboxes();

/** ===== Database viewer (GET /api/submissions) ===== */
const dbLoadBtn = document.getElementById('db-load-btn');
const dbRefreshBtn = document.getElementById('db-refresh-btn');
const dbHideBtn = document.getElementById('db-hide-btn');
const dbContent = document.getElementById('db-content');
const dbFeedback = document.getElementById('db-feedback');

function setDbFeedback(message, kind) {
  if (!dbFeedback) return;
  if (!message) {
    dbFeedback.textContent = '';
    dbFeedback.classList.add('hidden');
    dbFeedback.classList.remove('db-feedback--ok', 'db-feedback--err');
    return;
  }
  dbFeedback.textContent = message;
  dbFeedback.classList.remove('hidden', 'db-feedback--ok', 'db-feedback--err');
  if (kind === 'ok') dbFeedback.classList.add('db-feedback--ok');
  if (kind === 'err') dbFeedback.classList.add('db-feedback--err');
}

function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return String(value);
  }
}

function formatReasons(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return '—';
  const head = reasons.slice(0, 2).map((r) => {
    if (r && typeof r === 'object' && typeof r.text === 'string') return r.text;
    return JSON.stringify(r);
  });
  const more = reasons.length > 2 ? ` (+${reasons.length - 2})` : '';
  return head.join(' · ') + more;
}

function renderDbRows(rows) {
  if (!dbContent) return;
  if (!rows || rows.length === 0) {
    dbContent.innerHTML = '<p class="hint">Aucune ligne enregistrée pour l’instant.</p>';
    dbContent.classList.remove('hidden');
    return;
  }

  const head = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Pseudo</th>
        <th>K/D</th>
        <th>WR%</th>
        <th>Ranked</th>
        <th>Niv.</th>
        <th>Rang</th>
        <th>Saisons</th>
        <th>Verdict</th>
        <th>Cheat%</th>
        <th>Smurf%</th>
        <th>Raisons (aperçu)</th>
      </tr>
    </thead>`;

  const body = rows
    .map((row) => {
      const seasons = Array.isArray(row.seasonsPlayed)
        ? row.seasonsPlayed.join(', ')
        : '—';
      return `<tr>
        <td class="mono">${escapeHtml(formatDate(row.createdAt))}</td>
        <td>${escapeHtml(row.pseudo ?? '—')}</td>
        <td class="mono">${row.kd != null ? Number(row.kd).toFixed(2) : '—'}</td>
        <td class="mono">${row.winrate != null ? Number(row.winrate).toFixed(1) : '—'}</td>
        <td class="mono">${row.rankedMatches ?? '—'}</td>
        <td class="mono">${row.accountLevel ?? '—'}</td>
        <td>${escapeHtml(row.rankKey ?? '—')}</td>
        <td class="mono">${escapeHtml(seasons)}</td>
        <td><strong>${escapeHtml(row.verdict ?? '—')}</strong><br><span class="reasons-preview">${escapeHtml(row.verdictLabel ?? '')}</span></td>
        <td class="mono">${row.cheatScore != null ? Number(row.cheatScore).toFixed(0) : '—'}</td>
        <td class="mono">${row.smurfScore != null ? Number(row.smurfScore).toFixed(0) : '—'}</td>
        <td class="reasons-preview">${escapeHtml(formatReasons(row.reasonsJson))}</td>
      </tr>`;
    })
    .join('');

  dbContent.innerHTML = `<div class="db-table-wrap"><table class="db-table">${head}<tbody>${body}</tbody></table></div>`;
  dbContent.classList.remove('hidden');
}

async function loadDbRows() {
  if (!dbLoadBtn) return;
  setDbFeedback('Chargement en cours…', '');
  dbLoadBtn.disabled = true;
  if (dbRefreshBtn) dbRefreshBtn.disabled = true;

  try {
    const res = await fetch('/api/submissions', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Lecture impossible (${res.status})`);
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    renderDbRows(rows);
    setDbFeedback(
      rows.length
        ? `${rows.length} ligne(s) chargée(s).`
        : 'Connexion OK — aucune ligne.',
      'ok'
    );
    if (dbRefreshBtn) dbRefreshBtn.classList.remove('hidden');
    if (dbHideBtn) dbHideBtn.classList.remove('hidden');
    dbLoadBtn.classList.add('hidden');
  } catch (err) {
    setDbFeedback(
      err.message ||
        'Impossible de joindre l’API. Lance `npm run dev` ou vérifie DATABASE_URL.',
      'err'
    );
  } finally {
    dbLoadBtn.disabled = false;
    if (dbRefreshBtn) dbRefreshBtn.disabled = false;
  }
}

function hideDbRows() {
  if (!dbContent) return;
  dbContent.classList.add('hidden');
  dbContent.innerHTML = '';
  setDbFeedback('', '');
  if (dbRefreshBtn) dbRefreshBtn.classList.add('hidden');
  if (dbHideBtn) dbHideBtn.classList.add('hidden');
  if (dbLoadBtn) dbLoadBtn.classList.remove('hidden');
}

if (dbLoadBtn) dbLoadBtn.addEventListener('click', () => void loadDbRows());
if (dbRefreshBtn) dbRefreshBtn.addEventListener('click', () => void loadDbRows());
if (dbHideBtn) dbHideBtn.addEventListener('click', hideDbRows);

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
