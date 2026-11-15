import { formatMiles } from '../../utils';

type CrawlCompleteSummaryProps = {
  pubCount: number;
  totalMiles: number;
  newCount: number;
  // Achievements the crawl unlocked
  newAchievements: string[];
  onFinish: () => void;
};

/** Shown once every stop is ticked off */
export const CrawlCompleteSummary = ({
  pubCount,
  totalMiles,
  newCount,
  newAchievements,
  onFinish,
}: CrawlCompleteSummaryProps) => (
  <div className="crawl-complete" role="status">
    <p className="crawl-complete-title">🎉 Crawl complete!</p>
    <dl className="crawl-complete-stats">
      <div>
        <dt>Pubs</dt>
        <dd>{pubCount}</dd>
      </div>
      <div>
        <dt>Distance</dt>
        <dd>{formatMiles(totalMiles)}</dd>
      </div>
      <div>
        <dt>New to you</dt>
        <dd>{newCount}</dd>
      </div>
    </dl>
    {newAchievements.length > 0 && (
      <p className="crawl-complete-achievements">
        🏅 Unlocked: <strong>{newAchievements.join(', ')}</strong>
      </p>
    )}
    <button type="button" className="crawl-finish-button" onClick={onFinish}>
      Finish crawl
    </button>
  </div>
);
