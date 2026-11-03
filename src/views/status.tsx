import type { NightCounts } from '../digest/types.js';
import type { Status } from '../status.js';

function nightCounts(c: NightCounts): string {
  const parts = [`ok ${c.ok}`, `retry ${c.retry}`, `fail ${c.fail}`];
  if (c.badLines > 0) parts.push(`bad ${c.badLines}`);
  return parts.join(' · ');
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map(({ night, counts }) => (
            <li>
              <a href={`/digest/${night}`}>{night}</a> {counts ? nightCounts(counts) : '—'}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
