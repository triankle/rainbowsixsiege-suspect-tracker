import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatReasonsPreview(reasonsJson: unknown): string {
  if (!Array.isArray(reasonsJson) || reasonsJson.length === 0) return '—';
  const first = reasonsJson.slice(0, 2).map((r) => {
    if (r && typeof r === 'object' && 'text' in r && typeof (r as { text: unknown }).text === 'string') {
      return (r as { text: string }).text;
    }
    return JSON.stringify(r);
  });
  const more = reasonsJson.length > 2 ? ` (+${reasonsJson.length - 2})` : '';
  return first.join(' · ') + more;
}

export default async function Page() {
  let rows: Awaited<ReturnType<typeof prisma.suspectSubmission.findMany>> = [];
  let error: string | null = null;

  try {
    rows = await prisma.suspectSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : 'Impossible de lire la base (DATABASE_URL / réseau).';
  }

  return (
    <div className="page">
      <h1>Historique des sauvegardes</h1>
      <p className="sub">
        Données lues depuis PostgreSQL via Prisma (table{' '}
        <code>suspect_submissions</code>). Pour analyser un joueur, utilise l’outil
        statique avec <code>npm run dev</code> (port 3000, racine <code>/</code>) ou{' '}
        <code>npm run next:dev</code> puis <code>/index.html</code> (port 3001). Fichiers
        source : <code>public/index.html</code>
      </p>

      {error ? (
        <div className="banner banner--err" role="alert">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="banner">Aucune ligne enregistrée pour l’instant.</div>
      ) : (
        <div className="table-wrap">
          <table>
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
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">
                    {row.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td>{row.pseudo ?? '—'}</td>
                  <td className="mono">{Number(row.kd).toFixed(2)}</td>
                  <td className="mono">
                    {row.winrate != null ? Number(row.winrate).toFixed(1) : '—'}
                  </td>
                  <td className="mono">{row.rankedMatches}</td>
                  <td className="mono">{row.accountLevel}</td>
                  <td>{row.rankKey ?? '—'}</td>
                  <td className="mono">{row.seasonsPlayed.join(', ')}</td>
                  <td>
                    <strong>{row.verdict}</strong>
                    <br />
                    <span className="reasons-preview">{row.verdictLabel}</span>
                  </td>
                  <td className="mono">{Number(row.cheatScore).toFixed(0)}</td>
                  <td className="mono">{Number(row.smurfScore).toFixed(0)}</td>
                  <td className="reasons-preview">{formatReasonsPreview(row.reasonsJson)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
