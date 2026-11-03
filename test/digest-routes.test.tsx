import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { Night } from '../src/digest/types.js';

// Nights are written into a temp dir; runs/ is a read-only set of real nights.
const DATA_NIGHT = '2026-10-28';
const EMPTY_NIGHT = '2026-10-29';
const MISSING_NIGHT = '2026-01-01';

// Out of order on purpose (the page and the JSON must sort by job), with one bad line.
const DATA_LINES = [
  '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-10-28T23:00:07+01:00","job":"notes/backup","status":"fail","owner":"rook","error":"quota exceeded"}',
  'not json at all',
  '{"at":"2026-10-28T23:00:02+01:00","job":"digest/render","status":"ok","owner":null}',
  '{"at":"2026-10-28T23:00:03+01:00","job":"fixtures/refresh","status":"retry","owner":"lane-07"}',
  '{"at":"2026-10-28T23:10:03+01:00","job":"fixtures/refresh","status":"ok","owner":"lane-07"}',
];

const EXPECTED_JOBS = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'];

type JsonError = { error: string; night: string };

// Job names in the order the page lists them: the first cell of each body row.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
}

describe('digest routes', () => {
  let runsDir: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    runsDir = mkdtempSync(path.join(tmpdir(), 'rig-runs-'));
    writeFileSync(path.join(runsDir, `${DATA_NIGHT}.jsonl`), `${DATA_LINES.join('\n')}\n`);
    writeFileSync(path.join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
    const config: RigConfig = {
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir,
    };
    app = createApp(config);
  });

  afterAll(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  it('renders a night with data as a page that lists its jobs', async () => {
    const res = await app.request(`/digest/${DATA_NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageJobs(html)).toEqual(EXPECTED_JOBS);
  });

  it('serves the same night as JSON rows, with the bad line counted', async () => {
    const res = await app.request(`/api/digest/${DATA_NIGHT}`);
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe(DATA_NIGHT);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(EXPECTED_JOBS);
    expect(body.rows.find((r) => r.job === 'fixtures/refresh')).toMatchObject({
      runs: 2,
      retries: 1,
      lastStatus: 'ok',
    });
  });

  it('shows the bad-line notice on the page', async () => {
    const html = await (await app.request(`/digest/${DATA_NIGHT}`)).text();
    expect(html).toContain('1 bad line skipped');
  });

  it('lists the page and the JSON jobs in the same order', async () => {
    const html = await (await app.request(`/digest/${DATA_NIGHT}`)).text();
    const body = (await (await app.request(`/api/digest/${DATA_NIGHT}`)).json()) as Night;
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });

  it('returns 404 for a night with no file, on both routes', async () => {
    const page = await app.request(`/digest/${MISSING_NIGHT}`);
    expect(page.status).toBe(404);
    expect(await page.text()).toContain('no run log for that night');

    const json = await app.request(`/api/digest/${MISSING_NIGHT}`);
    expect(json.status).toBe(404);
    expect(await json.json()).toEqual({ error: 'no run log for this night', night: MISSING_NIGHT } satisfies JsonError);
  });

  it('renders an empty night as "nothing ran" with no rows', async () => {
    const html = await (await app.request(`/digest/${EMPTY_NIGHT}`)).text();
    expect(html).toContain('nothing ran');

    const res = await app.request(`/api/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY_NIGHT, rows: [], badLines: 0 });
  });
});
