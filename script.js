/**
 * R6 Suspect Check — ranked-only heuristics for “cheat-like” vs “smurf-like” profiles.
 * Bump this when a new ranked season starts (highest index = current).
 */
const CURRENT_SEASON_NUM = 18;

const MIN_LEVEL_FOR_RANKED = 50;
/** Below this, K/D is not used for strong cheat signals (sample too small). */
const RANKED_KD_UNCERTAIN_BELOW = 30;
/** From here upward, high K/D counts in full. */
const RANKED_KD_FULL_TRUST = 50;
/** Few seasons + high rank: need at least this many ranked games to call it smurf-like. */
const RANKED_MIN_FOR_SEASON_RANK_SMURF = 30;
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

/**
 * How much we trust K/D for cheat-style scoring: 0 below sample floor, then ramp to 1.
 */
function rankedKdTrust(rankedGames) {
  if (rankedGames < RANKED_KD_UNCERTAIN_BELOW) return 0;
  if (rankedGames >= RANKED_KD_FULL_TRUST) return 1;
  const ramp =
    (rankedGames - RANKED_KD_UNCERTAIN_BELOW) /
    (RANKED_KD_FULL_TRUST - RANKED_KD_UNCERTAIN_BELOW);
  return 0.25 + 0.75 * ramp;
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

/**
 * Cheap account level: very low level + high rank pushes smurf idea.
 */
function levelLooksCheapForRank(level, rankStep) {
  if (level <= 0 || rankStep <= 0) return false;
  if (rankStep >= RANK_ORDER.platinum && level < 70) return true;
  if (rankStep >= RANK_ORDER.diamond && level < 120) return true;
  return false;
}

function analyzeProfile(input) {
  const reasons = [];
  let cheatScore = 0;
  let smurfScore = 0;

  const {
    kd,
    winrate,
    ranked,
    level,
    rankStep,
    rankKey,
    playedSeasons,
  } = input;

  const kdTrust = rankedKdTrust(ranked);
  const hasWinrate = winrate !== undefined && !Number.isNaN(winrate);

  // --- Season pattern (smurf vs one-season blow-up) ---
  if (onlyCurrentSeasonPlayed(playedSeasons)) {
    cheatScore += 28;
    smurfScore += 22;
    reasons.push({
      text: 'Ranked only in the current season — common for new accounts or boosted streaks.',
      type: 'negative',
    });
  }

  const bigGap = largestSeasonGap(playedSeasons);
  if (bigGap >= SMURF_GAP_SEASONS) {
    smurfScore += Math.min(40, 12 + bigGap * 3);
    reasons.push({
      text: `Large gap between ranked seasons (up to ${bigGap} season(s) skipped) — fits a secondary account that comes back sporadically.`,
      type: 'negative',
    });
  }

  if (playedSeasons.length >= 6 && bigGap < SMURF_GAP_SEASONS) {
    smurfScore -= 18;
    cheatScore -= 8;
    reasons.push({
      text: 'Several seasons played without huge breaks — looks like a long-term main account.',
      type: 'positive',
    });
  }

  // --- K/D: stricter tiers (1.40+ suspicious, 1.50+ very); needs enough games ---
  if (ranked > 0 && ranked < RANKED_KD_UNCERTAIN_BELOW && kd >= 1.4) {
    reasons.push({
      text: `Few ranked games (${ranked}) — K/D (${kd}) is not reliable yet; wait for ~${RANKED_KD_UNCERTAIN_BELOW}+ games.`,
      type: 'positive',
    });
  }

  if (kdTrust > 0) {
    if (kd >= 2.0) {
      cheatScore += 48 * kdTrust;
      reasons.push({
        text: `Very high K/D (${kd}) with ${ranked}+ ranked games — strongly unusual at scale.`,
        type: 'negative',
      });
    } else if (kd >= 1.75) {
      cheatScore += 38 * kdTrust;
      reasons.push({
        text: `Extreme K/D (${kd}) for this sample — cheat-style red flag.`,
        type: 'negative',
      });
    } else if (kd >= 1.6) {
      cheatScore += 30 * kdTrust;
      reasons.push({
        text: `K/D (${kd}) is very high — rarely sustained legitimately over many ranked games.`,
        type: 'negative',
      });
    } else if (kd >= 1.5) {
      cheatScore += 22 * kdTrust;
      reasons.push({
        text: `K/D (${kd}) is very suspicious from ~1.50 upward with enough ranked games.`,
        type: 'negative',
      });
    } else if (kd >= 1.4) {
      cheatScore += 14 * kdTrust;
      reasons.push({
        text: `K/D (${kd}) from ~1.40 is already odd in ranked; worth scrutiny with ${ranked} games.`,
        type: 'negative',
      });
    }
  }

  // --- Win rate ---
  if (hasWinrate && ranked >= 60) {
    if (winrate >= 78) {
      cheatScore += 24;
      reasons.push({
        text: `Very high ranked win rate (${winrate}%) over ${ranked} games.`,
        type: 'negative',
      });
    } else if (winrate >= 72) {
      cheatScore += 14;
      reasons.push({
        text: `High ranked win rate (${winrate}%).`,
        type: 'negative',
      });
    }
  }

  if (hasWinrate && winrate >= 52 && winrate <= 60 && ranked >= 200) {
    cheatScore -= 12;
    reasons.push({
      text: `Win rate (${winrate}%) looks normal for a grind account.`,
      type: 'positive',
    });
  }

  // --- Rank + level (smurf shape) ---
  if (rankStep > 0) {
    if (rankStep >= RANK_ORDER.diamond && cheatScore > 20) {
      cheatScore += 10;
      reasons.push({
        text: `High rank (${rankKey}) on top of already strong combat stats.`,
        type: 'negative',
      });
    }
    if (levelLooksCheapForRank(level, rankStep)) {
      smurfScore += 34;
      reasons.push({
        text: `Rank vs account level ${level} is smurf-leaning (e.g. Emerald+ around ~100–120 is suspect).`,
        type: 'negative',
      });
    }
    if (
      rankStep >= RANK_ORDER.platinum &&
      ranked < 60 &&
      playedSeasons.length <= 2
    ) {
      smurfScore += 18;
      reasons.push({
        text: 'Good rank with few ranked games and little season history.',
        type: 'negative',
      });
    }

    // Few seasons (2–3) + Diamond+ ≈ smurf if sample is not tiny
    const fewSeasons =
      playedSeasons.length >= 2 && playedSeasons.length <= 3;
    if (fewSeasons && rankStep >= RANK_ORDER.diamond) {
      if (ranked >= RANKED_MIN_FOR_SEASON_RANK_SMURF) {
        smurfScore += 38;
        reasons.push({
          text: `Only ${playedSeasons.length} ranked season(s) played but ${rankKey} — very smurf-like with ${ranked} games.`,
          type: 'negative',
        });
      } else {
        reasons.push({
          text: `Diamond+ with only ${playedSeasons.length} season(s), but under ${RANKED_MIN_FOR_SEASON_RANK_SMURF} ranked games — inconclusive.`,
          type: 'positive',
        });
      }
    }
  }

  if (level >= 120 && ranked >= 200) {
    smurfScore -= 15;
    reasons.push({
      text: `High account level (${level}) and many ranked games — less “fresh smurf”.`,
      type: 'positive',
    });
  }

  // --- Calm K/D bucket (clean anchor): cap below “bizarre” 1.40 line ---
  if (kd >= 1.05 && kd <= 1.35 && ranked >= 200) {
    cheatScore -= 22;
    reasons.push({
      text: `K/D (${kd}) looks ordinary with hundreds of ranked games.`,
      type: 'positive',
    });
  }

  cheatScore = Math.max(0, Math.min(100, cheatScore));
  smurfScore = Math.max(0, Math.min(100, smurfScore));

  let verdict = 'uncertain';
  let verdictLabel = 'Inconclusive';
  let verdictClass = 'uncertain';

  if (cheatScore >= 52 && cheatScore >= smurfScore + 6) {
    verdict = 'suspect';
    verdictLabel = 'Strong cheat-style signal (stats + context)';
    verdictClass = 'suspect';
  } else if (cheatScore >= 38) {
    verdict = 'suspect';
    verdictLabel = 'Suspicious stats — worth a closer look';
    verdictClass = 'suspect';
  } else if (smurfScore >= 44 && smurfScore >= cheatScore - 5) {
    verdict = 'smurf';
    verdictLabel = 'Likely smurf / alt pattern';
    verdictClass = 'smurf';
  } else if (cheatScore < 26 && smurfScore < 32) {
    verdict = 'clean';
    verdictLabel = 'Looks like a normal long-term profile';
    verdictClass = 'clean';
  } else {
    verdictLabel = 'Mixed signals — weak conclusion';
  }

  return {
    verdict,
    verdictLabel,
    verdictClass,
    cheatScore,
    smurfScore,
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
  const { verdictLabel, verdictClass, cheatScore, smurfScore, reasons } =
    analysis;

  resultContent.innerHTML = `
    <div class="verdict ${verdictClass}">${escapeHtml(verdictLabel)}</div>
    <p><strong>Cheat-style score:</strong> ${Math.round(cheatScore)}%</p>
    <div class="score-bar"><div class="score-fill suspect" style="width: ${Math.round(cheatScore)}%"></div></div>
    <p><strong>Smurf-style score:</strong> ${Math.round(smurfScore)}%</p>
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
    reasons: analysis.reasons,
  };

  displayResult(analysis);
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
