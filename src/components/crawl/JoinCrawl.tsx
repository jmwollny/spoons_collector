import { useId, useState } from 'react';
import type { PubLocation } from '../../types';
import { decodeCrawl } from '../../crawlShare';
import type { Crawl } from '../../crawl';

type JoinCrawlProps = {
  locations: PubLocation[];
  visitedIds: Set<number>;
  onJoin: (crawl: Crawl) => void;
};

/** Joins a crawl a friend shared, from its code or the whole message */
export const JoinCrawl = ({ locations, visitedIds, onJoin }: JoinCrawlProps) => {
  const fieldId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const join = () => {
    try {
      // Following the streets only sends the pubs' locations
      onJoin({ ...decodeCrawl(text, locations, visitedIds), followStreets: true });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : String(joinError));
    }
  };

  return (
    <details className="crawl-join">
      <summary>Join a friend's crawl</summary>
      <div className="crawl-join-form">
        <label htmlFor={fieldId}>Paste the code or message they sent</label>
        <textarea
          id={fieldId}
          rows={3}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          placeholder="SC1.…"
        />
        {error && (
          <p className="near-me-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="visit-form-close" onClick={join} disabled={!text.trim()}>
          Join crawl
        </button>
      </div>
    </details>
  );
};
