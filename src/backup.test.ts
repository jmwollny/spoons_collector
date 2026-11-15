import { describe, expect, it } from 'vitest';
import { mergeVisits, parseBackup } from './backup';
import { makeVisit } from './test/pubs';

const file = (contents: object) => JSON.stringify(contents);
const visits = [makeVisit(1, '2026-11-01'), makeVisit(2, '2026-10-01')];

describe('parseBackup', () => {
  it('reads a version 2 backup with a crawl', () => {
    const crawl = { id: 'crawl-1', stops: [] };
    expect(parseBackup(file({ app: 'spoons_collector', version: 2, visits, crawl }))).toEqual({
      visits,
      crawl,
    });
  });

  it('still reads a version 1 backup, which has no crawl', () => {
    expect(parseBackup(file({ app: 'spoons_collector', version: 1, visits }))).toEqual({
      visits,
      crawl: null,
    });
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow("isn't a Spoons Collector backup");
    expect(() => parseBackup(file({ app: 'something_else', version: 1, visits }))).toThrow(
      "isn't a Spoons Collector backup",
    );
  });

  it('rejects backups from a newer version of the app', () => {
    expect(() => parseBackup(file({ app: 'spoons_collector', version: 99, visits }))).toThrow(
      'newer version',
    );
  });

  it('rejects damaged visits', () => {
    const damaged = [...visits, { ...visits[0], id: 'x', date: '1st Nov' }];
    expect(() => parseBackup(file({ app: 'spoons_collector', version: 2, visits: damaged }))).toThrow(
      'damaged',
    );
    const badRating = [{ ...visits[0], rating: 5 }];
    expect(() => parseBackup(file({ app: 'spoons_collector', version: 2, visits: badRating }))).toThrow(
      'damaged',
    );
  });
});

describe('mergeVisits', () => {
  it('adds only visits not already present, newest first', () => {
    const extra = makeVisit(3, '2026-12-01');
    const { visits: merged, addedCount } = mergeVisits([visits[1]], [...visits, extra]);
    expect(addedCount).toBe(2);
    expect(merged.map((visit) => visit.date)).toEqual(['2026-12-01', '2026-11-01', '2026-10-01']);
  });

  it('restoring the same backup twice changes nothing', () => {
    expect(mergeVisits(visits, visits).addedCount).toBe(0);
  });
});
