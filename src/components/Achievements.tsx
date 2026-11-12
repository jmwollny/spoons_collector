import React from 'react';

interface AchievementsProps {
  uniqueVisitedCount: number;
  totalLocations: number;
}

export const Achievements: React.FC<AchievementsProps> = ({
  uniqueVisitedCount,
  totalLocations,
}) => {
  const achievementsList = [
    {
      title: 'First Pint',
      unlocked: uniqueVisitedCount >= 1,
      detail: 'Log your first Spoons visit.',
    },
    {
      title: 'Bronze Pint',
      unlocked: uniqueVisitedCount >= 10,
      detail: 'Visit ten different Spoons.',
    },
    {
      title: 'Silver Pint',
      unlocked: uniqueVisitedCount >= 25,
      detail: 'Visit twenty-five different Spoons.',
    },
    {
      title: 'Gold Pint',
      unlocked: uniqueVisitedCount >= 50,
      detail: 'Visit fifty different Spoons.',
    },
    {
      title: 'Spoons Master',
      unlocked: uniqueVisitedCount >= totalLocations,
      detail: 'Visit every Spoons location.',
    },
  ];

  return (
    <div className="card">
      <div className="section-heading">
        <h2>Achievements</h2>
        <p>Small goals, big bragging rights.</p>
      </div>
      <ul className="achievement-list">
        {achievementsList.map((achievement) => (
          <li
            key={achievement.title}
            className={achievement.unlocked ? 'unlocked' : ''}
          >
            <strong>{achievement.title}</strong>
            <span>{achievement.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};