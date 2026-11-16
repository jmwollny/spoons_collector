import type { PubLocation, VisitEntry } from '../types';
import { formatDate } from '../utils';
import StarRating from './StarRating';

type SelectedPubSummaryProps = {
  pub: PubLocation;
  // The pub's visits, newest first
  visits: VisitEntry[];
};

/** One line about the selected pub: its name and latest visit */
export const SelectedPubSummary = ({ pub, visits }: SelectedPubSummaryProps) => {
  const latest = visits[0];
  return (
    // The slot takes the rest of the toolbar's row, whatever the pub's name,
    // so a long name is cut short rather than moving the line (and the map)
    <div className="selected-visit-slot">
      <div className={`selected-visit-details ${latest ? '' : 'is-unvisited'}`}>
        {/* The full name on hover, as a long one is cut short */}
        <span className="details-value details-name" title={pub.name}>
          {pub.name}
        </span>
        <span className="details-divider">·</span>
        {latest ? (
          <>
            <strong className="details-value">{formatDate(latest.date)}</strong>
            <span className="details-divider">·</span>
            <StarRating rating={latest.rating} maxRating={3} disabled={true} size={14} />
            {visits.length > 1 && (
              <>
                <span className="details-divider">·</span>
                <span className="details-value">{visits.length} visits</span>
              </>
            )}
          </>
        ) : (
          <span className="details-unvisited">Not visited yet</span>
        )}
      </div>
    </div>
  );
};
