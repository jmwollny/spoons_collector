import * as cheerio from 'cheerio';

/**
 * Extracts the specific pub history flavor text from a JDW pub page
 * @param {string} html - The HTML of the Wetherspoon pub webpage
 * @returns {string|null}
 */
export const extractHistory = (html) => {
  const $ = cheerio.load(html);

  // 1. Locate headings inside the block content
  // 2. Filter specifically for the "Pub history" text node
  // 3. Grab the immediate next <p> tag sibling element
  const historyParagraph = $('.wp-block-media-text__content h2.wp-block-heading')
    .filter((_, element) => $(element).text().trim().toLowerCase() === 'pub history')
    .next('p')
    .text()
    .trim();

  return historyParagraph || null;
};
