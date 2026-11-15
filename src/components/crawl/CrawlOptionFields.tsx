import { MAX_STOPS, MIN_STOPS, type CrawlStyle, type TravelMode } from '../../crawl';

export type CrawlOptionValues = {
  stopCount: number;
  style: CrawlStyle;
  mode: TravelMode;
  stayMinutes: number;
  // HH:MM
  startTime: string;
  // Hide the pubs behind clues
  treasureHunt: boolean;
  // Measure the route along real streets (from openstreetmap.de)
  followStreets: boolean;
};

type CrawlOptionFieldsProps = {
  values: CrawlOptionValues;
  onChange: (changes: Partial<CrawlOptionValues>) => void;
};

const STAY_OPTIONS = [45, 60, 90, 120];

/** e.g. 45 → "45 min", 60 → "1 hour", 90 → "1.5 hours" */
const stayLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${minutes / 60} hour${minutes > 60 ? 's' : ''}`;

const STOP_COUNTS = Array.from({ length: MAX_STOPS - MIN_STOPS + 1 }, (_, index) => MIN_STOPS + index);

/** How many pubs, which ones, how to get around, and timings */
export const CrawlOptionFields = ({ values, onChange }: CrawlOptionFieldsProps) => (
  <div className="crawl-form-grid">
    <label>
      Pubs
      <select
        value={values.stopCount}
        onChange={(event) => onChange({ stopCount: Number(event.target.value) })}
      >
        {STOP_COUNTS.map((count) => (
          <option key={count} value={count}>
            {count} pubs
          </option>
        ))}
      </select>
    </label>
    <label>
      Which pubs
      <select
        value={values.style}
        onChange={(event) => onChange({ style: event.target.value as CrawlStyle })}
      >
        <option value="new">New to me</option>
        <option value="rarity">Rarest in reach</option>
        <option value="any">Any, nearest first</option>
      </select>
    </label>
    <label>
      Getting around
      <select
        value={values.mode}
        onChange={(event) => onChange({ mode: event.target.value as TravelMode })}
      >
        <option value="walk">Walking</option>
        <option value="drive">Car, bus or train</option>
      </select>
    </label>
    <label>
      Time at each pub
      <select
        value={values.stayMinutes}
        onChange={(event) => onChange({ stayMinutes: Number(event.target.value) })}
      >
        {STAY_OPTIONS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {stayLabel(minutes)}
          </option>
        ))}
      </select>
    </label>
    <label>
      Start time
      <input
        type="time"
        value={values.startTime}
        onChange={(event) => onChange({ startTime: event.target.value })}
        required
      />
    </label>
    <label className="crawl-checkbox">
      <input
        type="checkbox"
        checked={values.treasureHunt}
        onChange={(event) => onChange({ treasureHunt: event.target.checked })}
      />
      <span>
        🗝 Treasure hunt
        <small>Hide the pub names: follow a clue to each one</small>
      </span>
    </label>
    <label className="crawl-checkbox">
      <input
        type="checkbox"
        checked={values.followStreets}
        onChange={(event) => onChange({ followStreets: event.target.checked })}
      />
      <span>
        🛣 Follow the streets
        <small>Real routes from openstreetmap.de. Only the pubs' locations are sent, not yours.</small>
      </span>
    </label>
  </div>
);
