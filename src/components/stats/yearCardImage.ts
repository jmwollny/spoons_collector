import type { YearSummary } from '../../stats';
import { plural } from '../../utils';

const WIDTH = 1080;
const HEIGHT = 1350;

const starsText = (stars: number) => `${'★'.repeat(Math.round(stars))}${'☆'.repeat(3 - Math.round(stars))}`;

/** The lines under the big numbers, leaving out what the year doesn't have */
export const yearCardLines = (summary: YearSummary) =>
  [
    summary.favourite && ['Favourite', `${summary.favourite.pub.name}, ${summary.favourite.pub.city}`],
    summary.rarest && ['Rarest', `${summary.rarest.name} (${summary.rarest.rarity})`],
    summary.bestMonth && ['Best month', `${summary.bestMonth.label}: ${plural(summary.bestMonth.visits, 'visit')}`],
    summary.favouriteDrink && ['Drink of the year', summary.favouriteDrink.name],
    summary.averageStars !== null && ['Average rating', `${starsText(summary.averageStars)}  ${summary.averageStars.toFixed(1)}`],
  ].filter((line): line is [string, string] => Boolean(line));

// Shortens text with "…" to fit a width
const fit = (context: CanvasRenderingContext2D, text: string, width: number) => {
  if (context.measureText(text).width <= width) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > width) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
};

/** Draws the Year in Spoons card as an image to share. Null if it can't. */
export const drawYearCard = async (summary: YearSummary): Promise<Blob | null> => {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return null;

  // A dark card with an amber (Legendary) border, like the pub cards
  context.fillStyle = '#f59e0b';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = '#1c1c1e';
  context.fillRect(28, 28, WIDTH - 56, HEIGHT - 56);

  const font = (weight: number, size: number) =>
    `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const left = 96;
  const textWidth = WIDTH - left * 2;

  context.fillStyle = '#aeaeaf';
  context.font = font(700, 40);
  context.fillText('MY YEAR IN SPOONS', left, 170);
  context.fillStyle = '#f5f5f7';
  context.font = font(800, 150);
  context.fillText(String(summary.year), left, 320);

  // Four big numbers in a 2 × 2 grid
  const numbers: Array<[number, string]> = [
    [summary.pubs, summary.pubs === 1 ? 'pub' : 'pubs'],
    [summary.visits, summary.visits === 1 ? 'visit' : 'visits'],
    [summary.newPubs, 'new to me'],
    [summary.regions, summary.regions === 1 ? 'region' : 'regions'],
  ];
  numbers.forEach(([value, label], index) => {
    const x = left + (index % 2) * (textWidth / 2);
    const y = 480 + Math.floor(index / 2) * 190;
    context.fillStyle = '#f59e0b';
    context.font = font(800, 110);
    context.fillText(String(value), x, y);
    context.fillStyle = '#aeaeaf';
    context.font = font(600, 38);
    context.fillText(label, x, y + 52);
  });

  yearCardLines(summary).forEach(([label, value], index) => {
    const y = 900 + index * 76;
    context.fillStyle = '#aeaeaf';
    context.font = font(600, 30);
    context.fillText(label.toUpperCase(), left, y);
    context.fillStyle = '#f5f5f7';
    context.font = font(700, 40);
    context.fillText(fit(context, value, textWidth - 340), left + 340, y);
  });

  context.fillStyle = '#636366';
  context.font = font(600, 30);
  context.fillText('Spoons Collector', left, HEIGHT - 80);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};
