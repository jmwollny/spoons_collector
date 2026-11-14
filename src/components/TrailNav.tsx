import type { PubTrail, TrailStep } from '../trail';
import { formatMiles } from '../utils';
import './TrailNav.css';

type TrailNavProps = {
  trail: PubTrail;
  // 'map' sits under the map's card; 'viewer' under the full-size card
  variant: 'map' | 'viewer';
};

// e.g. "Stop 3: Beckett's Bank" on a crawl, otherwise just the name
const describe = (step: TrailStep) =>
  step.stopNumber ? `Stop ${step.stopNumber}: ${step.pub.name}` : step.pub.name;

/**
 * Previous and Next nearest pub (or crawl stop), as arrows. The pubs they go to are named
 * in their tooltips and for screen readers.
 */
export const TrailNav = ({ trail, variant }: TrailNavProps) => {
  const { previous, next, goPrevious, goNext } = trail;
  return (
    <nav
      className={`trail-nav trail-nav--${variant}`}
      aria-label={trail.mode === 'crawl' ? 'Crawl stops' : 'Nearby pubs'}
    >
      <button
        type="button"
        className="trail-nav-previous"
        onClick={goPrevious}
        disabled={!previous}
        aria-label={previous ? `Back to ${describe(previous)}` : 'No previous pub'}
        title={previous ? `Back to ${describe(previous)} (←)` : undefined}
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
            ? `Next: ${describe(next)}, ${next.pub.city}, ${formatMiles(next.miles)} away`
            : trail.mode === 'crawl'
              ? 'Last stop on the crawl'
              : 'No more pubs nearby'
        }
        title={next ? `Next: ${describe(next)} · ${formatMiles(next.miles)} (→)` : undefined}
      >
        ›
      </button>
    </nav>
  );
};
