import { useMemo, useState } from 'react';
import type { PubLocation } from '../types';
import { planCrawl, type Crawl, type CrawlStart } from '../crawl';
import { getCurrentLocation } from '../location';
import { ActionButton } from './ActionButton';
import { Modal } from './Modal';
import { CrawlStartChoice, type StartKind } from './crawl/CrawlStartChoice';
import { CrawlOptionFields, type CrawlOptionValues } from './crawl/CrawlOptionFields';
import { JoinCrawl } from './crawl/JoinCrawl';
import './Crawl.css';

type CrawlPlannerProps = {
  locations: PubLocation[];
  visitedIds: Set<number>;
  // The pub selected on the map, offered as a starting point
  selectedPub: PubLocation;
  today: string;
  // Whether planning replaces a crawl already under way
  hasCrawl: boolean;
  onPlan: (crawl: Crawl) => void;
  onClose: () => void;
};

// "HH:MM" → minutes after midnight
const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** The form for planning a Spoons crawl */
export const CrawlPlanner = ({
  locations,
  visitedIds,
  selectedPub,
  today,
  hasCrawl,
  onPlan,
  onClose,
}: CrawlPlannerProps) => {
  const [startKind, setStartKind] = useState<StartKind>('pub');
  const [town, setTown] = useState(selectedPub.city);
  const [options, setOptions] = useState<CrawlOptionValues>({
    stopCount: 4,
    style: 'new',
    mode: 'walk',
    stayMinutes: 60,
    startTime: '10:00',
    treasureHunt: false,
    followStreets: true,
  });
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every town with a Wetherspoon, for the town box's suggestions
  const towns = useMemo(
    () => Array.from(new Set(locations.map((location) => location.city))).sort(),
    [locations],
  );

  // Where the crawl starts; finding the user's location if asked to
  const resolveStart = async (): Promise<CrawlStart> => {
    if (startKind === 'pub') return { kind: 'pub', pubId: selectedPub.id };
    if (startKind === 'town') return { kind: 'town', town };
    return { kind: 'here', ...(await getCurrentLocation()) };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPlanning(true);
    setError(null);
    try {
      const start = await resolveStart();
      onPlan(
        planCrawl(
          {
            start,
            stopCount: options.stopCount,
            style: options.style,
            mode: options.mode,
            startTime: toMinutes(options.startTime || '10:00'),
            stayMinutes: options.stayMinutes,
            date: today,
            treasureHunt: options.treasureHunt,
            followStreets: options.followStreets,
          },
          locations,
          visitedIds,
        ),
      );
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : String(planError));
    } finally {
      setPlanning(false);
    }
  };

  return (
    <Modal title="Plan a Spoons crawl" onClose={onClose} className="crawl-planner">
      <form className="crawl-form" onSubmit={handleSubmit}>
        <CrawlStartChoice
          value={startKind}
          onChange={setStartKind}
          selectedPub={selectedPub}
          town={town}
          onTownChange={setTown}
          towns={towns}
        />

        <CrawlOptionFields
          values={options}
          onChange={(changes) => setOptions((current) => ({ ...current, ...changes }))}
        />

        <p className="crawl-form-note">
          Meals follow Wetherspoon's usual times (breakfast until noon). Check each pub's menu for
          its own hours.
          {options.mode === 'drive' && " Please don't drink and drive."}
          {hasCrawl && ' This replaces your current crawl.'}
        </p>

        {error && (
          <p className="near-me-error" role="alert">
            {error}
          </p>
        )}

        <ActionButton type="submit" disabled={planning}>
          {planning ? 'Planning…' : 'Plan my crawl'}
        </ActionButton>

        <JoinCrawl locations={locations} visitedIds={visitedIds} onJoin={onPlan} />
      </form>
    </Modal>
  );
};
