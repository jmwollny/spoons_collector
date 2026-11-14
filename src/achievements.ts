import type { PubLocation, VisitEntry } from './types';

export type Achievement = {
  title: string;
  detail: string;
  // How far along it is, e.g. 7 of 10
  progress: number;
  target: number;
};

/** Every achievement, with the user's progress towards it */
export const getAchievements = (
  locations: PubLocation[],
  visitedLocationIds: Set<number>,
  indexedVisits: Record<number, VisitEntry[]>,
): Achievement[] => {
  const visited = locations.filter((location) => visitedLocationIds.has(location.id));
  const regions = new Set(locations.map((location) => location.region));
  const visitedRegions = new Set(visited.map((location) => location.region));
  const legendaryCount = visited.filter((location) => location.rarity === 'Legendary').length;
  const count = visited.length;
  const mostVisitsToOnePub = Math.max(
    0,
    ...visited.map((location) => indexedVisits[location.id]?.length ?? 0),
  );

  return [
    { title: 'First Pint', detail: 'Log your first Spoons visit.', progress: count, target: 1 },
    { title: 'Bronze Pint', detail: 'Visit ten different Spoons.', progress: count, target: 10 },
    { title: 'Silver Pint', detail: 'Visit twenty-five different Spoons.', progress: count, target: 25 },
    { title: 'Gold Pint', detail: 'Visit fifty different Spoons.', progress: count, target: 50 },
    { title: 'Centurion', detail: 'Visit a hundred different Spoons.', progress: count, target: 100 },
    {
      title: 'Off the Beaten Track',
      detail: 'Visit a Legendary Spoons: at most one other Spoons within 16 miles.',
      progress: legendaryCount,
      target: 1,
    },
    {
      title: 'Regular',
      detail: 'Visit the same Spoons five times.',
      progress: mostVisitsToOnePub,
      target: 5,
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
};

export const isUnlocked = (achievement: Achievement) =>
  achievement.progress >= achievement.target;

/** Titles of the achievements the user has unlocked */
export const unlockedTitles = (
  locations: PubLocation[],
  visitedLocationIds: Set<number>,
  indexedVisits: Record<number, VisitEntry[]>,
) =>
  getAchievements(locations, visitedLocationIds, indexedVisits)
    .filter(isUnlocked)
    .map((achievement) => achievement.title);
