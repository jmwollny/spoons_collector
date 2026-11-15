import type { PubLocation } from './types';
import type { Crawl } from './crawl';

// Words too common to give a pub away, kept in the clue
const COMMON_WORDS = new Set([
  'the', 'and', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'by', 'for', 'old', 'new', 'inn', 'arms',
  'hotel', 'house', 'tavern', 'bar', 'rooms', 'room', 'wetherspoon', 'wetherspoons', 'co',
]);

const BLANK = '▇▇▇';
const MAX_CLUE_LENGTH = 240;
const MAX_CLUE_SENTENCES = 2;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words that would give the pub away: its name's distinctive words and its town */
const giveaways = (pub: PubLocation) =>
  [...pub.name.split(/[^\p{L}\p{N}']+/u), ...pub.city.split(/[^\p{L}\p{N}']+/u)]
    .map((word) => word.replace(/'s$/i, ''))
    .filter((word) => word.length >= 3 && !COMMON_WORDS.has(word.toLowerCase()));

/**
 * A clue to a pub for a treasure hunt: the start of its history, with its
 * name and town blanked out. Pubs without much history get a plainer clue.
 */
export const makeClue = (pub: PubLocation) => {
  const history = pub.history.trim();
  if (history.length < 40) {
    return `A ${pub.rarity.toLowerCase()} Wetherspoon in ${pub.region}.`;
  }
  let clue = history;
  for (const word of giveaways(pub)) {
    clue = clue.replace(new RegExp(`\\b${escapeRegExp(word)}('s)?\\b`, 'giu'), BLANK);
  }
  // The first sentence or two, up to a length that reads as a clue
  const sentences = clue.match(/[^.!?]+[.!?]+/g) ?? [clue];
  let short = '';
  for (const sentence of sentences.slice(0, MAX_CLUE_SENTENCES)) {
    if (short && (short + sentence).length > MAX_CLUE_LENGTH) break;
    short += sentence;
  }
  return short.length > MAX_CLUE_LENGTH ? `${short.slice(0, MAX_CLUE_LENGTH - 1).trimEnd()}…` : short.trim();
};

/**
 * On a treasure hunt, the stops still hidden: not yet visited, nor
 * revealed. Never the pub the crawl starts at, which the user chose. Empty
 * on an ordinary crawl.
 */
export const hiddenStopIds = (crawl: Crawl, doneIds: Set<number>) =>
  new Set(
    crawl.treasureHunt
      ? crawl.stops
          .filter((_, index) => !(index === 0 && crawl.startIsPub))
          .map((stop) => stop.pubId)
          .filter((pubId) => !doneIds.has(pubId) && !crawl.revealed?.includes(pubId))
      : [],
  );
