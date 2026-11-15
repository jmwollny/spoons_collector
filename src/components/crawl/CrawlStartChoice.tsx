import { useId } from 'react';
import type { PubLocation } from '../../types';
import type { CrawlStart } from '../../crawl';

export type StartKind = CrawlStart['kind'];

type CrawlStartChoiceProps = {
  value: StartKind;
  onChange: (kind: StartKind) => void;
  // The pub selected on the map, offered as a starting point
  selectedPub: PubLocation;
  town: string;
  onTownChange: (town: string) => void;
  // Every town with a Wetherspoon, suggested as the user types
  towns: string[];
};

/** Where a crawl starts: the selected pub, the user's location, or a town */
export const CrawlStartChoice = ({
  value,
  onChange,
  selectedPub,
  town,
  onTownChange,
  towns,
}: CrawlStartChoiceProps) => {
  const townListId = useId();
  const choice = (kind: StartKind, label: React.ReactNode) => (
    <label className="crawl-choice">
      <input
        type="radio"
        name="crawl-start"
        checked={value === kind}
        onChange={() => onChange(kind)}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <fieldset className="crawl-start">
      <legend>Start from</legend>
      {choice(
        'pub',
        <>
          {selectedPub.name}, {selectedPub.city}
          <small>The pub selected on the map</small>
        </>,
      )}
      {choice('here', 'My location')}
      {choice('town', 'A town')}
      {value === 'town' && (
        <>
          <input
            className="crawl-town"
            list={townListId}
            value={town}
            onChange={(event) => onTownChange(event.target.value)}
            placeholder="Type a town"
            aria-label="Town"
            required
          />
          <datalist id={townListId}>
            {towns.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </>
      )}
    </fieldset>
  );
};
