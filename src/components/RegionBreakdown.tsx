import React, { useMemo } from 'react';
import type { PubLocation } from '../types';

interface RegionBreakdownProps {
  locations: PubLocation[];
  visitedLocationIds: Set<number>;
}

export const RegionBreakdown: React.FC<RegionBreakdownProps> = ({
  locations,
  visitedLocationIds,
}) => {
  // The calculation logic is safely self-contained right here
  const breakdowns = useMemo(() => {
    const grouped = locations.reduce<
      Record<string, { total: number; visited: number }>
    >((acc, location) => {
      const bucket = acc[location.region] ?? { total: 0, visited: 0 };
      bucket.total += 1;

      if (visitedLocationIds.has(location.id)) {
        bucket.visited += 1;
      }

      acc[location.region] = bucket;
      return acc;
    }, {});

    return Object.entries(grouped).map(([region, value]) => ({
      region,
      percentage: Math.round((value.visited / value.total) * 100),
      visited: value.visited,
      total: value.total,
    }));
  }, [locations, visitedLocationIds]);

  return (
    <section className="lower-grid">
      <div className="card">
        <div className="section-heading">
          <h2>Region breakdown</h2>
          <p>See how far you are from completing each corner of the map.</p>
        </div>
        <ul className="stat-list">
          {breakdowns.map((region) => (
            <li key={region.region}>
              <div>
                <strong>{region.region}</strong>
                <span>
                  {region.visited}/{region.total} visited
                </span>
              </div>
              <div className="progress-pill">{region.percentage}%</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
