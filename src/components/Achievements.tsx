import React, { useMemo } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import { getAchievements, isUnlocked } from '../achievements';

interface AchievementsProps {
  locations: PubLocation[];
  visitedLocationIds: Set<number>;
  // Each pub's visits
  indexedVisits: Record<number, VisitEntry[]>;
}

export const Achievements: React.FC<AchievementsProps> = ({
  locations,
  visitedLocationIds,
  indexedVisits,
}) => {
  const achievementsList = useMemo(
    () => getAchievements(locations, visitedLocationIds, indexedVisits),
    [locations, visitedLocationIds, indexedVisits],
  );

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Achievements</h2>
        <p>Small goals, big bragging rights.</p>
      </div>
      <ul className="achievement-list">
        {achievementsList.map((achievement) => {
          const unlocked = isUnlocked(achievement);
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
