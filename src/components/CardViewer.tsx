import { useEffect, useRef, useState } from 'react';
import SpoonCard from './SpoonCard';
import type { PubLocation } from '../types';
import './CardViewer.css';
import { useBackButton } from '../backButton';
import type { PubTrail } from '../trail';
import { TrailNav } from './TrailNav';

type CardViewerProps = {
  pub: PubLocation;
  rating: number;
  visitCount: number;
  // Date of the latest visit, formatted for display
  date: string | null;
  // Miles from the user, once they've used Near me
  distanceMiles?: number;
  onAddVisit: () => void;
  onShowVisits: () => void;
  onShowOnMap: () => void;
  onClose: () => void;
  // Previous and Next nearest pub
  trail: PubTrail;
};

// How far a downward swipe has to travel to close the viewer
const SWIPE_CLOSE_PX = 90;
// How far a sideways swipe has to travel to step to another pub
const SWIPE_STEP_PX = 60;

/**
 * One pub's card at full size, on top of the page. Tapping the card or
 * Flip turns it over to show the pub's full history. Swiping left or
 * right (or the arrow keys) steps to the next or previous nearest pub,
 * staying on the same side of the card. Escape, ✕, a tap outside the card
 * or a swipe down closes it.
 */
export const CardViewer = ({
  pub,
  rating,
  visitCount,
  date,
  distanceMiles,
  onAddVisit,
  onShowVisits,
  onShowOnMap,
  onClose,
  trail,
}: CardViewerProps) => {
  const [flipped, setFlipped] = useState(false);
  const swipeStart = useRef<{ x: number; y: number; inHistory: boolean } | null>(null);
  // Set when a touch was a swipe, so the tap it ends in doesn't flip the card
  const swiped = useRef(false);
  // Android's Back button closes the card rather than leaving the app
  useBackButton(onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Stop the page behind from scrolling while the viewer is open
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const onTouchStart = (event: React.TouchEvent) => {
    const target = event.target as HTMLElement;
    swiped.current = false;
    swipeStart.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      // A vertical swipe inside the history is the user scrolling it
      inHistory: Boolean(target.closest('.card-back-text')),
    };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) {
      return;
    }
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > SWIPE_STEP_PX && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      if (dx < 0) trail.goNext();
      else trail.goPrevious();
    } else if (!start.inHistory && dy > SWIPE_CLOSE_PX) {
      swiped.current = true;
      onClose();
    }
  };

  const flip = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setFlipped((current) => !current);
  };

  const visitLabel = visitCount === 1 ? '1 visit' : `${visitCount} visits`;

  return (
    <div
      className="card-viewer-backdrop"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="card-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={pub.name}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="card-viewer-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <SpoonCard
          id={pub.id}
          name={pub.name}
          city={pub.city}
          region={pub.region}
          rarity={pub.rarity}
          rating={rating}
          history={pub.history}
          visited={visitCount > 0}
          visitCount={visitCount}
          date={date}
          full={true}
          hasImage={Boolean(pub.imgType)}
          distanceMiles={distanceMiles}
          nearestMiles={pub.nearestNeighborMiles}
          secondMiles={pub.secondNeighborMiles}
          website={pub.website}
          menu={pub.menu}
          flipped={flipped}
          onClick={flip}
        />

        <TrailNav trail={trail} variant="viewer" />

        <div className="card-viewer-actions">
          <button
            type="button"
            className="card-viewer-button"
            onClick={() => setFlipped((current) => !current)}
          >
            {flipped ? '↺ Front' : '↻ History'}
          </button>
          <button type="button" className="card-viewer-button" onClick={onShowOnMap}>
            🗺 Map
          </button>
          {visitCount > 0 && (
            <button type="button" className="card-viewer-button" onClick={onShowVisits}>
              {visitLabel}
            </button>
          )}
          <button
            type="button"
            className="card-viewer-button card-viewer-button--primary"
            onClick={onAddVisit}
          >
            + Add visit
          </button>
        </div>
      </div>
    </div>
  );
};
