import { formatMiles } from '../../utils';
import { CardHeader } from './CardHeader';
import { usePubHistory } from '../../pubHistory';

export type CardBackProps = {
  name: string;
  visited: boolean;
  history: string;
  // For loading the history from Wetherspoon's site, in a shareable build
  historyId?: number | null;
  // Miles to the nearest and second-nearest other Wetherspoon
  nearestMiles: number;
  secondMiles: number;
  // Links to the pub's Wetherspoon page and menu ('NONE' when unknown)
  website: string;
  menu: string;
  // Hidden from screen readers while the front is showing
  hidden: boolean;
};

const hasLink = (url: string) => Boolean(url) && url !== 'NONE';

// Links open in a new tab, without also flipping the card
const ExternalLink = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
    {children}
  </a>
);

/** The back of a card: the pub's history, how isolated it is, and links */
export const CardBack = ({
  name,
  visited,
  history,
  historyId,
  nearestMiles,
  secondMiles,
  website,
  menu,
  hidden,
}: CardBackProps) => {
  // Loaded once the card is turned over
  const { text, status } = usePubHistory({ history, historyId }, !hidden);
  return (
    <div className="card-face card-face-back" aria-hidden={hidden}>
      <CardHeader name={name} visited={visited} />
      <div className="card-back-body">
        <p className="card-back-label">History</p>
        <p className="card-back-text">
          {status === 'ready' && text}
          {status === 'loading' && 'Loading the history…'}
          {status === 'failed' && "Couldn't load the history. It comes from Wetherspoon's site, so needs a connection."}
        </p>
      </div>
      <dl className="card-back-facts">
        <div>
          <dt>Nearest Spoons</dt>
          <dd>{formatMiles(nearestMiles)}</dd>
        </div>
        <div>
          <dt>Next nearest</dt>
          <dd>{formatMiles(secondMiles)}</dd>
        </div>
      </dl>
      {(hasLink(website) || hasLink(menu)) && (
        <nav className="card-back-links" aria-label="Links">
          {hasLink(website) && <ExternalLink href={website}>Pub page ↗</ExternalLink>}
          {hasLink(menu) && <ExternalLink href={menu}>Menu ↗</ExternalLink>}
        </nav>
      )}
    </div>
  );
};
