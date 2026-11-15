import { describe, expect, it } from 'vitest';
import {
  averageStars,
  bestYear,
  favouriteDrink,
  favouritePub,
  furthestFlung,
  monthlyVisits,
  mostRemotePub,
  weeklyStreaks,
  yearInSpoons,
  yearsWithVisits,
} from './stats';
import { makePub, makeVisit, samplePubsById } from './test/fixtures';

let id = 0;
const visit = (pubId: number, date: string, extra = {}) => makeVisit(pubId, date, { id: `v${id++}`, ...extra });

describe('monthlyVisits', () => {
  it('counts visits and first-time pubs in each of the last 12 months', () => {
    const visits = [
      visit(1, '2025-11-30'), // a year and a month ago: too early
      visit(1, '2026-01-05'),
      visit(2, '2026-01-20'),
      visit(1, '2026-11-01'),
      visit(3, '2026-11-14'),
    ];
    const months = monthlyVisits(visits, '2026-11-15');
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ key: '2025-12', label: 'Dec', year: 2025, visits: 0 });
    expect(months[1]).toMatchObject({ key: '2026-01', label: 'Jan', visits: 2, newPubs: 1 });
    expect(months[11]).toMatchObject({ key: '2026-11', label: 'Nov', visits: 2, newPubs: 1 });
  });

  it('crosses year boundaries correctly', () => {
    expect(monthlyVisits([], '2026-02-10', 3).map((month) => month.key)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('bestYear', () => {
  it('is the year with the most different pubs, the later on a tie', () => {
    expect(bestYear([])).toBeNull();
    const visits = [visit(1, '2025-01-01'), visit(2, '2025-02-01'), visit(1, '2026-03-01'), visit(1, '2026-04-01'), visit(3, '2026-05-01')];
    expect(bestYear(visits)).toEqual({ year: 2026, pubs: 2 });
    expect(bestYear(visits.slice(0, 3))).toEqual({ year: 2025, pubs: 2 });
  });
});

describe('weeklyStreaks', () => {
  // 2026-11-09 is a Monday
  it('counts weeks in a row with a visit', () => {
    const visits = ['2026-10-19', '2026-10-28', '2026-11-08', '2026-11-12', '2026-09-01'].map((date) => visit(1, date));
    // Weeks of 19 Oct, 26 Oct, 2 Nov (8th is a Sunday), 9 Nov: 4 in a row
    expect(weeklyStreaks(visits, '2026-11-15')).toEqual({ current: 4, longest: 4 });
  });

  it("isn't broken until a whole week passes without a visit", () => {
    const visits = [visit(1, '2026-11-03'), visit(1, '2026-11-10')];
    expect(weeklyStreaks(visits, '2026-11-17').current).toBe(2);
    expect(weeklyStreaks(visits, '2026-11-24').current).toBe(0);
    expect(weeklyStreaks(visits, '2026-11-24').longest).toBe(2);
  });

  it('is zero with no visits', () => {
    expect(weeklyStreaks([], '2026-11-15')).toEqual({ current: 0, longest: 0 });
  });
});

describe('favouritePub', () => {
  it('is the pub visited most, the most recent on a tie', () => {
    expect(favouritePub([], samplePubsById)).toBeNull();
    const visits = [visit(1, '2026-01-01'), visit(2, '2026-02-01'), visit(2, '2026-03-01'), visit(1, '2026-04-01')];
    expect(favouritePub(visits, samplePubsById)).toEqual({ pub: samplePubsById.get(1), visits: 2 });
    expect(favouritePub([...visits, visit(2, '2026-05-01')], samplePubsById)?.pub.id).toBe(2);
  });

  it('ignores pubs no longer in the data', () => {
    expect(favouritePub([visit(999, '2026-01-01')], samplePubsById)).toBeNull();
  });
});

describe('mostRemotePub', () => {
  it('is the rarest pub visited, then the furthest from others', () => {
    expect(mostRemotePub([1, 2, 3, 4], samplePubsById)?.name).toBe('The Counting House');
    const a = makePub(10, 0, 0, { rarity: 'Rare', secondNeighborMiles: 5 });
    const b = makePub(11, 0, 0, { rarity: 'Rare', secondNeighborMiles: 7 });
    expect(mostRemotePub([10, 11, 999], new Map([[10, a], [11, b]]))).toBe(b);
    expect(mostRemotePub([], samplePubsById)).toBeNull();
  });
});

describe('furthestFlung', () => {
  it('is the pub furthest from the middle of those visited', () => {
    // Leeds twice and York: the patch is Leeds, so Glasgow is furthest
    const visits = [visit(1, '2026-01-01'), visit(2, '2026-01-02'), visit(3, '2026-01-03'), visit(4, '2026-01-04')];
    const result = furthestFlung(visits, samplePubsById);
    expect(result?.pub.name).toBe('The Counting House');
    expect(result?.miles).toBeGreaterThan(150);
  });

  it('needs at least two pubs', () => {
    expect(furthestFlung([visit(1, '2026-01-01'), visit(1, '2026-02-01')], samplePubsById)).toBeNull();
  });
});

describe('averageStars and favouriteDrink', () => {
  it('averages the rated visits, as one to three stars', () => {
    expect(averageStars([])).toBeNull();
    expect(averageStars([visit(1, '2026-01-01', { rating: 2 }), visit(1, '2026-01-02', { rating: 0 }), visit(1, '2026-01-03', { rating: -1 })])).toBe(2);
  });

  it('finds the drink named most, ignoring case', () => {
    expect(favouriteDrink([visit(1, '2026-01-01')])).toBeNull();
    const visits = [
      visit(1, '2026-01-01', { drink: 'Abbot Ale' }),
      visit(1, '2026-01-02', { drink: 'abbot ale ' }),
      visit(1, '2026-01-03', { drink: 'Ruddles' }),
    ];
    expect(favouriteDrink(visits)).toEqual({ name: 'Abbot Ale', count: 2 });
  });
});

describe('yearInSpoons', () => {
  const visits = [
    visit(1, '2025-06-01'),
    visit(1, '2026-03-01', { rating: 2, drink: 'Abbot Ale' }),
    visit(2, '2026-03-10', { rating: 1 }),
    visit(4, '2026-08-01', { drink: 'Abbot Ale' }),
  ];

  it('sums up a year', () => {
    expect(yearInSpoons(2026, visits, samplePubsById)).toEqual({
      year: 2026,
      visits: 3,
      pubs: 3,
      // The Cuthbert Brodrick was first visited in 2025
      newPubs: 2,
      regions: 2,
      favourite: { pub: samplePubsById.get(4), visits: 1 },
      bestMonth: { label: 'Mar', visits: 2 },
      rarest: samplePubsById.get(4),
      // 3, 2 and 3 stars (test visits default to 3)
      averageStars: 8 / 3,
      favouriteDrink: { name: 'Abbot Ale', count: 2 },
    });
  });

  it('lists the years with visits, newest first', () => {
    expect(yearsWithVisits(visits)).toEqual([2026, 2025]);
  });

  it('copes with a year without visits', () => {
    expect(yearInSpoons(2020, visits, samplePubsById)).toMatchObject({ visits: 0, pubs: 0, bestMonth: null, rarest: null });
  });
});
