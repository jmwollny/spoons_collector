import { useEffect, useMemo, useState } from 'react';
import type { PubLocation } from '../types';
import {
  MAX_STOPS,
  MIN_STOPS,
  planCrawl,
  type Crawl,
  type CrawlStart,
  type CrawlStyle,
  type TravelMode,
} from '../crawl';
import { getCurrentLocation } from '../location';
import { ActionButton } from './ActionButton';
import { useBackButton } from '../backButton';
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

type StartKind = CrawlStart['kind'];

const STAY_OPTIONS = [45, 60, 90, 120];

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
  const [stopCount, setStopCount] = useState(4);
  const [style, setStyle] = useState<CrawlStyle>('new');
  const [mode, setMode] = useState<TravelMode>('walk');
  const [startTime, setStartTime] = useState('10:00');
  const [stayMinutes, setStayMinutes] = useState(60);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every town with a Wetherspoon, for the town box's suggestions
  const towns = useMemo(
    () => Array.from(new Set(locations.map((location) => location.city))).sort(),
    [locations],
  );

  useBackButton(onClose);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPlanning(true);
    setError(null);
    try {
      let start: CrawlStart;
      if (startKind === 'pub') {
        start = { kind: 'pub', pubId: selectedPub.id };
      } else if (startKind === 'town') {
        start = { kind: 'town', town };
      } else {
        const position = await getCurrentLocation();
        start = { kind: 'here', ...position };
      }
      onPlan(
        planCrawl(
          {
            start,
            stopCount,
            style,
            mode,
            startTime: toMinutes(startTime || '10:00'),
            stayMinutes,
            date: today,
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
    <div className="visit-form-modal-backdrop" onClick={onClose}>
      <div
        className="visit-form-modal crawl-planner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crawl-planner-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="visit-form-modal-header">
          <h2 id="crawl-planner-title">Plan a Spoons crawl</h2>
          <button type="button" className="visit-form-close" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="crawl-form" onSubmit={handleSubmit}>
          <fieldset className="crawl-start">
            <legend>Start from</legend>
            <label className="crawl-choice">
              <input
                type="radio"
                name="crawl-start"
                checked={startKind === 'pub'}
                onChange={() => setStartKind('pub')}
              />
              <span>
                {selectedPub.name}, {selectedPub.city}
                <small>The pub selected on the map</small>
              </span>
            </label>
            <label className="crawl-choice">
              <input
                type="radio"
                name="crawl-start"
                checked={startKind === 'here'}
                onChange={() => setStartKind('here')}
              />
              <span>My location</span>
            </label>
            <label className="crawl-choice">
              <input
                type="radio"
                name="crawl-start"
                checked={startKind === 'town'}
                onChange={() => setStartKind('town')}
              />
              <span>A town</span>
            </label>
            {startKind === 'town' && (
              <>
                <input
                  className="crawl-town"
                  list="crawl-towns"
                  value={town}
                  onChange={(event) => setTown(event.target.value)}
                  placeholder="Type a town"
                  aria-label="Town"
                  required
                />
                <datalist id="crawl-towns">
                  {towns.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            )}
          </fieldset>

          <div className="crawl-form-grid">
            <label>
              Pubs
              <select value={stopCount} onChange={(event) => setStopCount(Number(event.target.value))}>
                {Array.from({ length: MAX_STOPS - MIN_STOPS + 1 }, (_, index) => MIN_STOPS + index).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count} pubs
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Which pubs
              <select value={style} onChange={(event) => setStyle(event.target.value as CrawlStyle)}>
                <option value="new">New to me</option>
                <option value="rarity">Rarest in reach</option>
                <option value="any">Any, nearest first</option>
              </select>
            </label>
            <label>
              Getting around
              <select value={mode} onChange={(event) => setMode(event.target.value as TravelMode)}>
                <option value="walk">Walking</option>
                <option value="drive">Car, bus or train</option>
              </select>
            </label>
            <label>
              Time at each pub
              <select value={stayMinutes} onChange={(event) => setStayMinutes(Number(event.target.value))}>
                {STAY_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} hour${minutes > 60 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start time
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
            </label>
          </div>

          <p className="crawl-form-note">
            Meals follow Wetherspoon's usual times (breakfast until noon). Check
            each pub's menu for its own hours.
            {mode === 'drive' && ' Please don\'t drink and drive.'}
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
        </form>
      </div>
    </div>
  );
};
