import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';

type MapToolbarProps = {
  onAddVisit: () => void;
  // Visits to the selected pub
  visitCount: number;
  onShowVisits: () => void;
  onPlanCrawl: () => void;
  // In crawl mode, one crawl at a time: end or finish it first
  canPlanCrawl: boolean;
  isLiveLocationOn: boolean;
  onToggleLiveLocation: () => void;
  // Shown after the buttons, e.g. the selected pub's summary
  children?: ReactNode;
};

/** The buttons above the map */
export const MapToolbar = ({
  onAddVisit,
  visitCount,
  onShowVisits,
  onPlanCrawl,
  canPlanCrawl,
  isLiveLocationOn,
  onToggleLiveLocation,
  children,
}: MapToolbarProps) => (
  <div className="map-selector-container">
    <div className="map-selector-actions">
      <ActionButton variant="primary" onClick={onAddVisit}>
        Add visit
      </ActionButton>
      <button
        type="button"
        className="visit-form-close"
        onClick={onShowVisits}
        disabled={visitCount === 0}
      >
        Visits ({visitCount})
      </button>
      <button
        type="button"
        className="visit-form-close"
        onClick={onPlanCrawl}
        disabled={!canPlanCrawl}
        title={canPlanCrawl ? undefined : 'Finish or end this crawl to plan another'}
      >
        🍺 Plan a crawl
      </button>
      <button
        type="button"
        className={`visit-form-close live-toggle ${isLiveLocationOn ? 'is-on' : ''}`}
        onClick={onToggleLiveLocation}
        aria-pressed={isLiveLocationOn}
        title="Spot when you're at a Wetherspoon, while the app is open"
      >
        📍 Live location: {isLiveLocationOn ? 'On' : 'Off'}
      </button>
      {children}
    </div>
  </div>
);
