import type { PubTrail } from '../trail';
import { formatMiles } from '../utils';
import './TrailNav.css';

type TrailNavProps = {
  trail: PubTrail;
  // 'map' sits under the map's card; 'viewer' under the full-size card
  variant: 'map' | 'viewer';
};

/**
 * Previous and Next nearest pub, as arrows. The pubs they go to are named
 * in their tooltips and for screen readers.
 */
export const TrailNav = ({ trail, variant }: TrailNavProps) => {
  const { previous, next, goPrevious, goNext } = trail;
  return (
    <nav className={`trail-nav trail-nav--${variant}`} aria-label="Nearby pubs">
      <button
        type="button"
        className="trail-nav-previous"
        onClick={goPrevious}
        disabled={!previous}
        aria-label={previous ? `Back to ${previous.pub.name}` : 'No previous pub'}
        title={previous ? `Back to ${previous.pub.name} (←)` : undefined}
      >
        ‹
      </button>
      <button
        type="button"
        className="trail-nav-next"
        onClick={goNext}
        disabled={!next}
        aria-label={
          next
            ? `Next: ${next.pub.name}, ${next.pub.city}, ${formatMiles(next.miles)} away`
            : 'No more pubs nearby'
        }
        title={next ? `Next: ${next.pub.name} · ${formatMiles(next.miles)} (→)` : undefined}
      >
        ›
      </button>
    </nav>
  );
};
