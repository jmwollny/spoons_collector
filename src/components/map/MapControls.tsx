type MapControlsProps = {
  expanded: boolean;
  onToggleExpanded: () => void;
  // Near me, shown while the map fills the screen
  onNearMe: () => void;
  locating: boolean;
};

/** Full screen on and off, and Near me while it's on */
export const MapControls = ({ expanded, onToggleExpanded, onNearMe, locating }: MapControlsProps) => (
  <div className="map-controls">
    <button
      type="button"
      className="map-control-button"
      onClick={onToggleExpanded}
      aria-label={expanded ? 'Shrink map' : 'Expand map to full screen'}
      title={expanded ? 'Shrink map (Esc)' : 'Full screen'}
    >
      {expanded ? '✕' : '⛶'}
    </button>
    {expanded && (
      <button
        type="button"
        className="map-control-button map-near-me"
        onClick={onNearMe}
        disabled={locating}
        aria-label="Find the nearest pubs you haven't visited"
      >
        {locating ? 'Finding you…' : '📍 Near me'}
      </button>
    )}
  </div>
);
