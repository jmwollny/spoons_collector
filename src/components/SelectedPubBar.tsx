import { useRef, useState } from 'react';
import type { PubLocation } from '../types';
import type { PubTrail } from '../trail';
import SpoonCard from './SpoonCard';

type SelectedPubBarProps = {
  pub: PubLocation;
  visitCount: number;
  // Date of the latest visit, formatted for display
  date: string | null;
  trail: PubTrail;
  onOpen: () => void;
};

// How far a finger has to travel for a swipe
const SWIPE_PX = 40;

/**
 * The selected pub as a pull-up sheet along the bottom of the map, shown
 * on phones instead of the mini card, which is too small to read there.
 *
 * - Closed, it's a slim bar. Swipe it up, or tap the handle, to pull up
 *   the pub's card; swipe down to put it away.
 * - ‹ and ›, or swiping the bar left and right, step to nearby pubs.
 * - Tapping the bar or the card opens the full-size card.
 */
export const SelectedPubBar = ({ pub, visitCount, date, trail, onOpen }: SelectedPubBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Set when a touch turned out to be a swipe, so the tap that follows
  // it doesn't also open the card
  const swiped = useRef(false);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    swiped.current = false;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      if (dx < 0) trail.goNext();
      else trail.goPrevious();
    } else if (Math.abs(dy) > SWIPE_PX) {
      swiped.current = true;
      setIsOpen(dy < 0);
    }
  };

  const openUnlessSwiped = () => {
    if (!swiped.current) onOpen();
    swiped.current = false;
  };

  return (
    <div
      className={`map-pub-sheet rarity-${pub.rarity.toLowerCase()} ${isOpen ? 'is-open' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
        </button>

        <button
          type="button"
          className="map-pub-bar-step"
          onClick={trail.goNext}
          disabled={!trail.next}
          aria-label={
            trail.next
              ? `Next: ${trail.next.pub.name}, ${trail.next.pub.city}`
              : trail.mode === 'crawl'
                ? 'Last stop on the crawl'
                : 'No more pubs nearby'
          }
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
            hasImage={Boolean(pub.imgType)}
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
