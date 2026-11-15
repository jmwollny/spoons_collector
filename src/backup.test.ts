import { describe, expect, it } from 'vitest';
import { mergeVisits, parseBackup } from './backup';
import { makeVisit } from './test/pubs';

const file = (contents: object) => JSON.stringify(contents);
const visits = [makeVisit(1, '2026-11-01'), makeVisit(2, '2026-10-01')];

describe('parseBackup', () => {
  it('reads a version 3 backup with a crawl, finished crawls and visit notes', () => {
    const crawl = { id: 'crawl-1', stops: [] };
    const crawlHistory = [
      { id: 'c1', date: '2026-11-01', pubCount: 3, totalMiles: 1, mode: 'walk', score: 90, meals: [], treasureHunt: false, revealedCount: 0 },
    ];
    const withNotes = [{ ...visits[0], drink: 'Abbot Ale', company: 'Sam', notes: 'Quiz', hasPhoto: true }];
    expect(parseBackup(file({ app: 'spoons_collector', version: 3, visits: withNotes, crawl, crawlHistory }))).toEqual({
      visits: withNotes,
      crawl,
      crawlHistory,
    });
  });

  it('still reads version 2 and 1 backups', () => {
    const crawl = { id: 'crawl-1', stops: [] };
    expect(parseBackup(file({ app: 'spoons_collector', version: 2, visits, crawl }))).toEqual({
      visits,
      crawl,
      crawlHistory: [],
    });
    expect(parseBackup(file({ app: 'spoons_collector', version: 1, visits }))).toEqual({
      visits,
      crawl: null,
      crawlHistory: [],
    });
  });

  it('rejects visits with notes of the wrong kind', () => {
    const bad = [{ ...visits[0], notes: 42 }];
    expect(() => parseBackup(file({ app: 'spoons_collector', version: 3, visits: bad }))).toThrow('damaged');
    const badPhoto = [{ ...visits[0], hasPhoto: 'yes' }];
    expect(() => parseBackup(file({ app: 'spoons_collector', version: 3, visits: badPhoto }))).toThrow('damaged');
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
