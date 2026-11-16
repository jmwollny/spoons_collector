import { useMemo, useState } from 'react';
import { ProgressCard } from './ProgressCard';
import type { PubLocation, VisitEntry } from '../types';
import {
  averageStars,
  bestYear,
  favouritePub,
  furthestFlung,
  monthlyVisits,
  mostRemotePub,
  weeklyStreaks,
} from '../stats';
import { formatMiles, plural } from '../utils';
import { MonthChart } from './stats/MonthChart';
import { YearInSpoons } from './stats/YearInSpoons';
import './Stats.css';

type StatsPanelProps = {
  visits: VisitEntry[];
  pubsById: Map<number, PubLocation>;
  today: string;
};

/** The user's visits in numbers, with a chart and their Year in Spoons */
export const StatsPanel = ({ visits, pubsById, today }: StatsPanelProps) => {
  const [isYearOpen, setIsYearOpen] = useState(false);
  const stats = useMemo(() => {
    const pubIds = new Set(visits.map((visit) => visit.locationId));
    return {
      pubs: pubIds.size,
      averageStars: averageStars(visits),
      months: monthlyVisits(visits, today),
      bestYear: bestYear(visits),
      streaks: weeklyStreaks(visits, today),
      favourite: favouritePub(visits, pubsById),
      remote: mostRemotePub(pubIds, pubsById),
      furthest: furthestFlung(visits, pubsById),
    };
  }, [visits, pubsById, today]);

  return (
    <ProgressCard
      title="Your stats"
      subtitle="Your visits in numbers."
      className="stats-panel"
    >
      {visits.length === 0 ? (
        <p className="stats-empty">Log a visit to see your stats.</p>
      ) : (
        <>
          <dl className="stats-headline">
            <div>
              <dt>Visits</dt>
              <dd>{visits.length}</dd>
            </div>
            <div>
              <dt>Pubs</dt>
              <dd>{stats.pubs}</dd>
            </div>
            <div>
              <dt>Average</dt>
              <dd>{stats.averageStars === null ? '–' : `${stats.averageStars.toFixed(1)} ★`}</dd>
            </div>
          </dl>

          <MonthChart months={stats.months} />

          <dl className="stats-facts">
            {stats.bestYear && (
              <div>
                <dt>Best year</dt>
                <dd>
                  {stats.bestYear.year}: {plural(stats.bestYear.pubs, 'pub')}
                </dd>
              </div>
            )}
            <div>
              <dt>Weekly streak</dt>
              <dd>
                {plural(stats.streaks.current, 'week')} now, best {plural(stats.streaks.longest, 'week')}
              </dd>
            </div>
            {stats.favourite && (
              <div>
                <dt>Favourite</dt>
                <dd>
                  {stats.favourite.pub.name} ({plural(stats.favourite.visits, 'visit')})
                </dd>
              </div>
            )}
            {stats.remote && (
              <div>
                <dt>Most remote</dt>
                <dd>
                  {stats.remote.name} ({stats.remote.rarity})
                </dd>
              </div>
            )}
            {stats.furthest && (
              <div>
                <dt>Furthest flung</dt>
                <dd>
                  {stats.furthest.pub.name}, {formatMiles(stats.furthest.miles)} from your usual patch
                </dd>
              </div>
            )}
          </dl>

          <button type="button" className="visit-form-close stats-year-button" onClick={() => setIsYearOpen(true)}>
            🎉 Year in Spoons
          </button>
        </>
      )}

      {isYearOpen && <YearInSpoons visits={visits} pubsById={pubsById} onClose={() => setIsYearOpen(false)} />}
    </ProgressCard>
  );
};
