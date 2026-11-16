import { useState } from 'react';
import SpoonCard from './SpoonCard';
import type { PubLocation } from '../types';
import type { PubTrail } from '../trail';
import { useDismiss } from '../hooks/useDismiss';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useSwipe } from '../hooks/useSwipe';
import { TrailNav } from './TrailNav';
import { CardViewerActions } from './viewer/CardViewerActions';
import './CardViewer.css';
import { pubPhotoUrl } from '../pubPhoto';

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

/**
 * One pub's card at full size, on top of the page. Tapping the card or
 * History turns it over to show the pub's full history. Swiping left or
 * right (or the arrow keys) steps to the next or previous pub, staying on
 * the same side of the card. Escape, Back, ✕, a tap outside the card or a
 * swipe down closes it.
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

  // Escape and Android's Back button close the card; the page behind
  // can't scroll while it's open
  useDismiss(onClose);
  useBodyScrollLock();

  const { touchHandlers, wasSwipe } = useSwipe(
    { onLeft: trail.goNext, onRight: trail.goPrevious, onDown: onClose },
    // A vertical swipe inside the history is the user scrolling it
    { horizontalPx: 60, verticalPx: 90, ignoreVerticalWithin: '.card-back-text' },
  );

  const toggleFlip = () => setFlipped((current) => !current);

  return (
    <div className="card-viewer-backdrop" onClick={onClose} {...touchHandlers}>
      <div
        className="card-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={pub.name}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="card-viewer-close" onClick={onClose} aria-label="Close">
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
          photoUrl={pubPhotoUrl(pub)}
          distanceMiles={distanceMiles}
          nearestMiles={pub.nearestNeighborMiles}
          secondMiles={pub.secondNeighborMiles}
          website={pub.website}
          menu={pub.menu}
          flipped={flipped}
          // A tap flips the card, unless it ended a swipe
          onClick={() => {
            if (!wasSwipe()) toggleFlip();
          }}
        />

        <TrailNav trail={trail} variant="viewer" />

        <CardViewerActions
          flipped={flipped}
          onFlip={toggleFlip}
          onShowOnMap={onShowOnMap}
          visitCount={visitCount}
          onShowVisits={onShowVisits}
          onAddVisit={onAddVisit}
        />
      </div>
    </div>
  );
};
