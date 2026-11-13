import React, { useMemo } from 'react';
import type { PubLocation } from '../types';

interface AchievementsProps {
  locations: PubLocation[];
  visitedLocationIds: Set<number>;
}

type Achievement = {
  title: string;
  detail: string;
  // How far along it is, e.g. 7 of 10
  progress: number;
  target: number;
};

export const Achievements: React.FC<AchievementsProps> = ({
  locations,
  visitedLocationIds,
}) => {
  const achievementsList = useMemo<Achievement[]>(() => {
    const visited = locations.filter((location) => visitedLocationIds.has(location.id));
    const regions = new Set(locations.map((location) => location.region));
    const visitedRegions = new Set(visited.map((location) => location.region));
    const legendaryCount = visited.filter((location) => location.rarity === 'Legendary').length;
    const count = visited.length;

    return [
      { title: 'First Pint', detail: 'Log your first Spoons visit.', progress: count, target: 1 },
      { title: 'Bronze Pint', detail: 'Visit ten different Spoons.', progress: count, target: 10 },
      { title: 'Silver Pint', detail: 'Visit twenty-five different Spoons.', progress: count, target: 25 },
      { title: 'Gold Pint', detail: 'Visit fifty different Spoons.', progress: count, target: 50 },
      { title: 'Centurion', detail: 'Visit a hundred different Spoons.', progress: count, target: 100 },
      {
        title: 'Off the Beaten Track',
        detail: 'Visit a Legendary Spoons, 12 miles or more from any other.',
        progress: legendaryCount,
        target: 1,
      },
      {
        title: 'Grand Tour',
        detail: `Visit a Spoons in every region (all ${regions.size}).`,
        progress: visitedRegions.size,
        target: regions.size,
      },
      {
        title: 'Spoons Master',
        detail: 'Visit every Spoons location.',
        progress: count,
        target: locations.length,
      },
    ];
  }, [locations, visitedLocationIds]);

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Achievements</h2>
        <p>Small goals, big bragging rights.</p>
      </div>
      <ul className="achievement-list">
        {achievementsList.map((achievement) => {
          const unlocked = achievement.progress >= achievement.target;
          return (
            <li key={achievement.title} className={unlocked ? 'unlocked' : ''}>
              <div>
                <strong>{achievement.title}</strong>
                <span>{achievement.detail}</span>
              </div>
              <span className="achievement-progress">
                {unlocked
                  ? 'Unlocked'
                  : `${Math.min(achievement.progress, achievement.target)}/${achievement.target}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
