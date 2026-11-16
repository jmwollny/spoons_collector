import { useState } from 'react';
import type { PubLocation } from '../types';
import type { PubTrail } from '../trail';
import { useSwipe } from '../hooks/useSwipe';
import SpoonCard from './SpoonCard';
import { PubBarInfo } from './sheet/PubBarInfo';
import { pubPhotoUrl } from '../pubPhoto';

type SelectedPubBarProps = {
  pub: PubLocation;
  visitCount: number;
  // Date of the latest visit, formatted for display
  date: string | null;
  trail: PubTrail;
  onOpen: () => void;
};

/**
 * The selected pub as a pull-up sheet along the bottom of the map, shown
 * on phones instead of the mini card, which is too small to read there.
 *
 * - Closed, it's a slim bar. Swipe it up, or tap the handle, to pull up
 *   the pub's card; swipe down to put it away.
 * - ‹ and ›, or swiping the bar left and right, step to other pubs.
 * - Tapping the bar or the card opens the full-size card.
 */
export const SelectedPubBar = ({ pub, visitCount, date, trail, onOpen }: SelectedPubBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { touchHandlers, wasSwipe } = useSwipe(
    {
      onLeft: trail.goNext,
      onRight: trail.goPrevious,
      onUp: () => setIsOpen(true),
      onDown: () => setIsOpen(false),
    },
    { horizontalPx: 40, verticalPx: 40 },
  );

  // A tap opens the full-size card, unless it ended a swipe
  const openUnlessSwiped = () => {
    if (!wasSwipe()) onOpen();
  };

  const nextLabel = trail.next
    ? `Next: ${trail.next.pub.name}, ${trail.next.pub.city}`
    : trail.mode === 'crawl'
      ? 'Last stop on the crawl'
      : 'No more pubs nearby';

  return (
    <div
      className={`map-pub-sheet rarity-${pub.rarity.toLowerCase()} ${isOpen ? 'is-open' : ''}`}
      {...touchHandlers}
    >
      <button
        type="button"
        className="map-pub-sheet-handle"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Hide the card' : 'Show the card'}
      />

      <div className="map-pub-bar">
        <button
          type="button"
          className="map-pub-bar-step"
          onClick={trail.goPrevious}
          disabled={!trail.previous}
          aria-label={trail.previous ? `Back to ${trail.previous.pub.name}` : 'No previous pub'}
        >
          ‹
        </button>

        <button
          type="button"
          className="map-pub-bar-main"
          onClick={openUnlessSwiped}
          aria-label={`Open the card for ${pub.name}`}
        >
          <PubBarInfo pub={pub} visitCount={visitCount} date={date} />
        </button>

        <button
          type="button"
          className="map-pub-bar-step"
          onClick={trail.goNext}
          disabled={!trail.next}
          aria-label={nextLabel}
        >
          ›
        </button>
      </div>

      {isOpen && (
        <div className="map-pub-sheet-card">
          <SpoonCard
            id={pub.id}
            name={pub.name}
            city={pub.city}
            region={pub.region}
            rarity={pub.rarity}
            rating={-1}
            history={pub.history}
            visited={visitCount > 0}
            visitCount={visitCount}
            date={date}
            compact={true}
            photoUrl={pubPhotoUrl(pub)}
            nearestMiles={pub.nearestNeighborMiles}
            secondMiles={pub.secondNeighborMiles}
            website={pub.website}
            menu={pub.menu}
            onClick={openUnlessSwiped}
          />
          {(trail.next || trail.previous) && (
            <p className="map-pub-sheet-next">
              {trail.mode === 'crawl'
                ? 'Swipe sideways for the next stop on your crawl'
                : 'Swipe sideways for nearby pubs'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
