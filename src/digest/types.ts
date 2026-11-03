// Plan morning-digest. The shapes every part of the digest works against: the reader fills
// them, the page and the JSON render them.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times keep the log's offset.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number;
};

// Run lines per status across a night, plus lines that did not parse.
export type NightCounts = Record<RunStatus, number> & { badLines: number };

// Returns null when runs/<night>.jsonl does not exist. An empty file is a night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
