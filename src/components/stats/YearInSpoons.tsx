import { useMemo, useState } from 'react';
import type { PubLocation, VisitEntry } from '../../types';
import { yearInSpoons, yearsWithVisits } from '../../stats';
import { shareFile } from '../../files';
import { Modal } from '../Modal';
import { ActionButton } from '../ActionButton';
import { drawYearCard, yearCardLines } from './yearCardImage';

type YearInSpoonsProps = {
  visits: VisitEntry[];
  pubsById: Map<number, PubLocation>;
  onClose: () => void;
};

/** A year's visits as a card, to look back on and share as an image */
export const YearInSpoons = ({ visits, pubsById, onClose }: YearInSpoonsProps) => {
  const years = useMemo(() => yearsWithVisits(visits), [visits]);
  const [year, setYear] = useState(years[0]);
  const [status, setStatus] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const summary = useMemo(() => yearInSpoons(year, visits, pubsById), [year, visits, pubsById]);

  const share = async () => {
    setSharing(true);
    setStatus(null);
    try {
      const image = await drawYearCard(summary);
      if (!image) {
        setStatus("Couldn't make the image on this device.");
        return;
      }
      const result = await shareFile(image, `year-in-spoons-${year}.png`, `My ${year} in Spoons`);
      if (result === 'downloaded') setStatus('Saved the image to your downloads.');
    } catch (error) {
      setStatus(`Couldn't share: ${error instanceof Error ? error.message : error}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal title="Year in Spoons" onClose={onClose} className="year-in-spoons">
      {years.length > 1 && (
        <label className="year-in-spoons-year">
          Year
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}

      <article className="year-card" aria-label={`My ${year} in Spoons`}>
        <p className="year-card-kicker">My year in Spoons</p>
        <p className="year-card-year">{year}</p>
        <dl className="year-card-numbers">
          <div>
            <dt>{summary.pubs === 1 ? 'pub' : 'pubs'}</dt>
            <dd>{summary.pubs}</dd>
          </div>
          <div>
            <dt>{summary.visits === 1 ? 'visit' : 'visits'}</dt>
            <dd>{summary.visits}</dd>
          </div>
          <div>
            <dt>new to me</dt>
            <dd>{summary.newPubs}</dd>
          </div>
          <div>
            <dt>{summary.regions === 1 ? 'region' : 'regions'}</dt>
            <dd>{summary.regions}</dd>
          </div>
        </dl>
        <dl className="year-card-lines">
          {yearCardLines(summary).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </article>

      <ActionButton onClick={share} disabled={sharing}>
        {sharing ? 'Making the image…' : 'Share as an image'}
      </ActionButton>
      {status && (
        <p className="year-in-spoons-status" role="status">
          {status}
        </p>
      )}
    </Modal>
  );
};
