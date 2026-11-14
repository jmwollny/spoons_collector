import { useEffect, useRef, useState } from 'react';
import SpoonCard from './SpoonCard';
import type { PubLocation } from '../types';
import './CardViewer.css';
import { useBackButton } from '../backButton';

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
};

// How far a downward swipe has to travel to close the viewer
const SWIPE_CLOSE_PX = 90;

/**
 * One pub's card at full size, on top of the page. Tapping the card or
 * Flip turns it over to show the pub's full history. Escape, ✕, a tap
 * outside the card or a swipe down closes it.
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
}: CardViewerProps) => {
  const [flipped, setFlipped] = useState(false);
  const swipeStartY = useRef<number | null>(null);
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
    // A swipe inside the history is the user scrolling it, not closing
    const target = event.target as HTMLElement;
    swipeStartY.current = target.closest('.card-back-text')
      ? null
      : event.touches[0].clientY;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (swipeStartY.current === null) {
      return;
    }
    const travelled = event.changedTouches[0].clientY - swipeStartY.current;
    swipeStartY.current = null;
    if (travelled > SWIPE_CLOSE_PX) {
      onClose();
    }
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
          onClick={() => setFlipped((current) => !current)}
        />

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
