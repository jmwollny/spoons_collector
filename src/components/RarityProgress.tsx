import { useMemo } from 'react';
import type { PubLocation } from '../types';
import { ProgressRow } from './ProgressRow';

// Rarest first, in the card border colours from SpoonCard.css
const RARITIES = [
  { name: 'Legendary', color: '#f59e0b' },
  { name: 'Epic', color: '#8b5cf6' },
  { name: 'Rare', color: '#0284c7' },
  { name: 'Uncommon', color: '#10b981' },
  { name: 'Common', color: '#64748b' },
];

type RarityProgressProps = {
  locations: PubLocation[];
  visitedLocationIds: Set<number>;
};

export const RarityProgress = ({ locations, visitedLocationIds }: RarityProgressProps) => {
  const tiers = useMemo(
    () =>
      RARITIES.map(({ name, color }) => {
        const pubs = locations.filter((location) => location.rarity === name);
        return {
          name,
          color,
          total: pubs.length,
          visited: pubs.filter((pub) => visitedLocationIds.has(pub.id)).length,
        };
      }),
    [locations, visitedLocationIds],
  );

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Rarity</h2>
        <p>The further a pub is from other Wetherspoons, the rarer it is.</p>
      </div>
      <ul className="progress-list">
        {tiers.map((tier) => (
          <ProgressRow
            key={tier.name}
            label={tier.name}
            visited={tier.visited}
            total={tier.total}
            color={tier.color}
          />
        ))}
      </ul>
    </div>
  );
};
