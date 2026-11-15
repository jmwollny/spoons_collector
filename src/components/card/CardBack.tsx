import { formatMiles } from '../../utils';
import { CardHeader } from './CardHeader';

export type CardBackProps = {
  name: string;
  visited: boolean;
  history: string;
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
  nearestMiles,
  secondMiles,
  website,
  menu,
  hidden,
}: CardBackProps) => (
  <div className="card-face card-face-back" aria-hidden={hidden}>
    <CardHeader name={name} visited={visited} />
    <div className="card-back-body">
      <p className="card-back-label">History</p>
      <p className="card-back-text">{history}</p>
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
