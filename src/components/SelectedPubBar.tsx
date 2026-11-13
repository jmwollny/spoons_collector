import type { PubLocation } from '../types';

type SelectedPubBarProps = {
  pub: PubLocation;
  visitCount: number;
  // Date of the latest visit, formatted for display
  date: string | null;
  onOpen: () => void;
};

/**
 * The selected pub as a slim bar along the bottom of the map. Shown on
 * phones instead of the mini card, which is too small to read there.
 * Tapping it opens the full-size card.
 */
export const SelectedPubBar = ({ pub, visitCount, date, onOpen }: SelectedPubBarProps) => (
  <button
    type="button"
    className={`map-pub-bar rarity-${pub.rarity.toLowerCase()}`}
    onClick={onOpen}
    aria-label={`Open the card for ${pub.name}`}
  >
    {pub.imgType ? (
      <img className="map-pub-bar-photo" src={`/images/${pub.id}.webp`} alt="" />
    ) : (
      <span className="map-pub-bar-photo" />
    )}
    <span className="map-pub-bar-text">
      <span className="map-pub-bar-name">{pub.name}</span>
      <span className="map-pub-bar-meta">
        <span className="map-pub-bar-rarity">{pub.rarity}</span>
        <span>{pub.city}</span>
        {visitCount > 0 ? (
          <span className="map-pub-bar-visited">
            ✓ {visitCount > 1 ? `${visitCount} visits` : date}
          </span>
        ) : (
          <span>Not visited</span>
        )}
      </span>
    </span>
    <span className="map-pub-bar-open" aria-hidden="true">›</span>
  </button>
);
