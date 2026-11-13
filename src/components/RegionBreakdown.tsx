import React, { useMemo } from 'react';
import type { PubLocation } from '../types';
import { ProgressRow } from './ProgressRow';

interface RegionBreakdownProps {
  locations: PubLocation[];
  visitedLocationIds: Set<number>;
}

export const RegionBreakdown: React.FC<RegionBreakdownProps> = ({
  locations,
  visitedLocationIds,
}) => {
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

    return Object.entries(grouped)
      .map(([region, value]) => ({ region, ...value }))
      .sort((a, b) => a.region.localeCompare(b.region));
  }, [locations, visitedLocationIds]);

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Regions</h2>
        <p>See how far you are from completing each corner of the map.</p>
      </div>
      <ul className="progress-list">
        {breakdowns.map((region) => (
          <ProgressRow
            key={region.region}
            label={region.region}
            visited={region.visited}
            total={region.total}
          />
        ))}
      </ul>
    </div>
  );
};
