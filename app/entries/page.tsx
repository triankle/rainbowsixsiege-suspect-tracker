export const dynamic = 'force-static';

export default function EntriesPage() {
  return (
    <main>
      <meta httpEquiv="refresh" content="0; url=/entries.html" />
      <p>
        Loading stored entries.{' '}
        <a href="/entries.html">Open stored entries</a>.
      </p>
    </main>
  );
}
