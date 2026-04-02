/**
 * R6 Suspect Check — Logique d'analyse
 * Basé sur K/D, nombre de parties, classé, saisons, niveau → suspicion triche / smurf
 */

const form = document.getElementById('stats-form');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');

// Rangs avec un "niveau" pour comparaison (plus haut = plus fort)
const RANK_ORDER = {
  copper: 1, bronze: 2, silver: 3, gold: 4, platinum: 5,
  emerald: 6, diamond: 7, champion: 8
};

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const kd = parseFloat(document.getElementById('kd').value) || 0;
  const winrate = parseFloat(document.getElementById('winrate').value);
  const games = parseInt(document.getElementById('games').value, 10) || 0;
  const ranked = parseInt(document.getElementById('ranked').value, 10) || 0;
  const level = parseInt(document.getElementById('level').value, 10) || 0;
  const seasons = parseInt(document.getElementById('seasons').value, 10) || 0;
  const rankKey = document.getElementById('rank').value;

  const rankLevel = rankKey ? RANK_ORDER[rankKey] || 0 : 0;

  const analysis = analyzeProfile({
    kd, winrate, games, ranked, level, seasons, rankLevel, rankKey
  });

  displayResult(analysis);
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/**
 * Analyse le profil et retourne verdict + raisons
 */
function analyzeProfile(data) {
  const reasons = [];
  let suspicionScore = 0; // 0–100, plus haut = plus suspect
  let smurfScore = 0;     // 0–100, plus haut = plus smurf

  const { kd, winrate, games, ranked, level, seasons, rankLevel } = data;

  // —— Triche (stats anormalement hautes pour le volume de jeux) ——
  if (kd >= 2.2 && games < 800) {
    suspicionScore += 35;
    reasons.push({ text: `K/D très élevé (${kd}) avec peu de parties (${games}) — souvent associé à la triche.`, type: 'negative' });
  } else if (kd >= 1.9 && games < 400) {
    suspicionScore += 25;
    reasons.push({ text: `K/D élevé (${kd}) avec très peu de parties (${games}).`, type: 'negative' });
  }

  if (ranked > 0 && kd >= 2.0 && ranked < 300) {
    suspicionScore += 20;
    reasons.push({ text: `K/D classé très haut (${kd}) avec peu de matchs classés (${ranked}).`, type: 'negative' });
  }

  if (winrate >= 75 && games < 500 && winrate !== undefined && !isNaN(winrate)) {
    suspicionScore += 15;
    reasons.push({ text: `Win rate très élevé (${winrate}%) avec peu de parties.`, type: 'negative' });
  }

  // —— Smurf (compte récent / peu joué mais rang ou niveau élevé) ——
  const lowLevel = level > 0 && level < 120;
  const highRank = rankLevel >= 5; // Plat+
  const fewGames = games < 400;
  const fewSeasons = seasons > 0 && seasons <= 3;

  if (highRank && lowLevel) {
    smurfScore += 35;
    reasons.push({ text: `Rang élevé pour un niveau compte bas (niv. ${level}) — profil smurf typique.`, type: 'negative' });
  }

  if (highRank && fewGames) {
    smurfScore += 25;
    reasons.push({ text: `Peu de parties (${games}) pour un rang élevé.`, type: 'negative' });
  }

  if (fewSeasons && highRank) {
    smurfScore += 20;
    reasons.push({ text: `Peu de saisons jouées (${seasons}) avec un bon rang — compte possiblement secondaire.`, type: 'negative' });
  }

  if (games >= 800 && seasons >= 8) {
    suspicionScore -= 15;
    smurfScore -= 15;
    reasons.push({ text: `Beaucoup de parties (${games}) et plusieurs saisons (${seasons}) — profil vétéran cohérent.`, type: 'positive' });
  }

  if (kd >= 0.85 && kd <= 1.4 && games >= 500) {
    suspicionScore -= 10;
    reasons.push({ text: `K/D dans la norme (${kd}) avec un bon volume de jeux.`, type: 'positive' });
  }

  if (ranked >= 500 && rankLevel >= 4) {
    smurfScore -= 15;
    reasons.push({ text: `Beaucoup de matchs classés (${ranked}) — compte principal probable.`, type: 'positive' });
  }

  suspicionScore = Math.max(0, Math.min(100, suspicionScore));
  smurfScore = Math.max(0, Math.min(100, smurfScore));

  // Verdict global
  let verdict = 'uncertain';
  let verdictLabel = 'Incertain';
  let verdictClass = 'uncertain';

  if (suspicionScore >= 50) {
    verdict = 'suspect';
    verdictLabel = 'Profil suspect (triche possible)';
    verdictClass = 'suspect';
  } else if (smurfScore >= 50) {
    verdict = 'smurf';
    verdictLabel = 'Profil type smurf';
    verdictClass = 'smurf';
  } else if (suspicionScore < 25 && smurfScore < 25) {
    verdict = 'clean';
    verdictLabel = 'Profil a priori propre';
    verdictClass = 'clean';
  } else {
    verdictLabel = 'À surveiller (données limites)';
  }

  return {
    verdict,
    verdictLabel,
    verdictClass,
    suspicionScore,
    smurfScore,
    reasons
  };
}

/**
 * Affiche le résultat dans la page
 */
function displayResult(analysis) {
  const { verdictLabel, verdictClass, suspicionScore, smurfScore, reasons } = analysis;

  resultContent.innerHTML = `
    <div class="verdict ${verdictClass}">${verdictLabel}</div>
    <p><strong>Indice suspicion triche :</strong> ${suspicionScore}%</p>
    <div class="score-bar"><div class="score-fill suspect" style="width: ${suspicionScore}%"></div></div>
    <p><strong>Indice smurf :</strong> ${smurfScore}%</p>
    <div class="score-bar"><div class="score-fill smurf" style="width: ${smurfScore}%"></div></div>
    ${reasons.length ? `<ul class="reasons">${reasons.map(r => `<li class="${r.type || ''}">${r.text}</li>`).join('')}</ul>` : ''}
  `;
}
