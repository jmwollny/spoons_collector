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
    <div className={`selected-visit-details ${latest ? '' : 'is-unvisited'}`}>
      <span className="details-value">{pub.name}</span>
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
  );
};
