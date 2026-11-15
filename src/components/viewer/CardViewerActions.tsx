type CardViewerActionsProps = {
  flipped: boolean;
  onFlip: () => void;
  onShowOnMap: () => void;
  visitCount: number;
  onShowVisits: () => void;
  onAddVisit: () => void;
};

/** The buttons under the full-size card */
export const CardViewerActions = ({
  flipped,
  onFlip,
  onShowOnMap,
  visitCount,
  onShowVisits,
  onAddVisit,
}: CardViewerActionsProps) => (
  <div className="card-viewer-actions">
    <button type="button" className="card-viewer-button" onClick={onFlip}>
      {flipped ? '↺ Front' : '↻ History'}
    </button>
    <button type="button" className="card-viewer-button" onClick={onShowOnMap}>
      🗺 Map
    </button>
    {visitCount > 0 && (
      <button type="button" className="card-viewer-button" onClick={onShowVisits}>
        {visitCount === 1 ? '1 visit' : `${visitCount} visits`}
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
);
