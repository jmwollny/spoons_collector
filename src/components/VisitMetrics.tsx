type VisitMetricsProps = {
  visitedCount: number;
  totalCount: number;
};

/** How many pubs the user has visited, and what share of them all */
export const VisitMetrics = ({ visitedCount, totalCount }: VisitMetricsProps) => (
  <div className="hero-metrics">
    <div className="metric-card">
      <strong>{visitedCount}</strong>
      <span>Visited Spoons</span>
    </div>
    <div className="metric-card">
      <strong>{totalCount === 0 ? 0 : Math.round((visitedCount / totalCount) * 100)}%</strong>
      <span>Completion</span>
    </div>
  </div>
);
