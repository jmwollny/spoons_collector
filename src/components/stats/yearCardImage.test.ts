import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawYearCard, yearCardLines } from './yearCardImage';
import type { YearSummary } from '../../stats';
import { glasgow, leeds1 } from '../../test/fixtures';

const summary: YearSummary = {
  year: 2026,
  visits: 12,
  pubs: 8,
  newPubs: 5,
  regions: 3,
  favourite: { pub: leeds1, visits: 4 },
  bestMonth: { label: 'Mar', visits: 5 },
  rarest: glasgow,
  averageStars: 2.4,
  favouriteDrink: { name: 'Abbot Ale', count: 3 },
};

describe('yearCardLines', () => {
  it("lists the year's highlights", () => {
    expect(yearCardLines(summary)).toEqual([
      ['Favourite', 'The Cuthbert Brodrick, Leeds'],
      ['Rarest', 'The Counting House (Legendary)'],
      ['Best month', 'Mar: 5 visits'],
      ['Drink of the year', 'Abbot Ale'],
      ['Average rating', '★★☆  2.4'],
    ]);
  });

  it('leaves out what the year lacks', () => {
    expect(
      yearCardLines({ ...summary, favourite: null, rarest: null, bestMonth: null, favouriteDrink: null, averageStars: null }),
    ).toEqual([]);
  });
});

describe('drawYearCard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws the card as a PNG', async () => {
    const fillText = vi.fn();
    const png = new Blob(['png'], { type: 'image/png' });
    const context = {
      fillStyle: '',
      font: '',
      fillRect: vi.fn(),
      fillText,
      // Every character is 20px wide
      measureText: (text: string) => ({ width: text.length * 20 }),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (callback: (blob: Blob) => void, type: string) => {
        expect(type).toBe('image/png');
        callback(png);
      },
    };
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );
    expect(await drawYearCard({ ...summary, favourite: { pub: { ...leeds1, name: 'A'.repeat(60) }, visits: 4 } })).toBe(png);
    expect([canvas.width, canvas.height]).toEqual([1080, 1350]);
    const texts = fillText.mock.calls.map(([text]) => text);
    expect(texts).toEqual(expect.arrayContaining(['MY YEAR IN SPOONS', '2026', '8', 'pubs', 'new to me', 'Abbot Ale']));
    // A name too long for the card is shortened
    expect(texts.find((text: string) => text.startsWith('AAA'))).toMatch(/…$/);
  });

  it('gives up where a canvas cannot draw', async () => {
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? ({ getContext: () => null } as unknown as HTMLCanvasElement) : createElement(tag),
    );
    expect(await drawYearCard(summary)).toBeNull();
  });
});
