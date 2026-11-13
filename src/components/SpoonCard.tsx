import { useState, useEffect } from 'react';
import './SpoonCard.css';
import StarRating from './StarRating';
import { formatMiles } from '../utils';
type SpoonCardProps = {
  id: number;
  name: string;
  city: string;
  region: string;
  rarity: string;
  history: string;
  rating: number;
  visited: boolean;
  // How many times the pub has been visited
  visitCount?: number;
  small?: boolean;
  medium?: boolean;
  // Whether public/images holds a photo for this pub
  hasImage: boolean;
  selected?: boolean;
  date?: string | null;
  // Miles from the user, shown once they've used Near me
  distanceMiles?: number;
  // Miles to the nearest and second-nearest other Wetherspoon
  nearestMiles: number;
  secondMiles: number;
  // Links to the pub's Wetherspoon page and menu ('NONE' when unknown)
  website: string;
  menu: string;
};

const hasLink = (url: string) => Boolean(url) && url !== 'NONE';

const SpoonCard = (props: SpoonCardProps) => {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!props.selected && flipped) {
      setFlipped(false);
    }
  }, [props.selected, flipped]);
  const getCardClassName = () => {
    const rarity = props.rarity.toLocaleLowerCase();
    let classes = `spoon-card rarity-${rarity}`;

    if (!props.visited) {
      classes += ' unvisited';
    }

    if (props.small) {
      classes += ' small';
    }

    if (props.medium) {
      classes += ' medium';
    }

    if (props.selected) {
      classes += ' selected';
    }

    if (flipped) {
      classes += ' is-flipped';
    }

    return classes;
  };

  const flipCard = () => {
    // Only flip when selected
    if (props.selected) {
      if (flipped) {
        setFlipped(false);
      } else {
        setFlipped(true);
      }
    }
  };

  return (
    <article
      role="button"
      className={getCardClassName()}
      data-region={props.region.toLowerCase()}
      onClick={flipCard}
    >
      <div className="spoon-card__inner">
        <div className="card-face card-face-front">
          <header className="card-header">
            <h2 className="card-title" title={props.name}>{props.name}</h2>
            {props.visited && <span className="visited-badge">Visited</span>}
          </header>

          <figure className="card-art-frame">
            {/* Without a photo the dotted placeholder below shows instead */}
            {props.hasImage && (
              <img
                src={`/images/${props.id}.webp`}
                alt={props.name}
                className="card-art-image"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}

            <div id="card-map-thumb" className="card-map-fallback"></div>
            <span className="region-badge">{props.region}</span>
          </figure>

          <section className="card-stats-panel">
            <div className="stat-row">
              <span className="stat-label">Rarity</span>
              <span className="stat-value">{props.rarity}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Locality</span>
              <span className="stat-value">{props.city}</span>
            </div>
            {props.distanceMiles !== undefined && (
              <div className="stat-row">
                <span className="stat-label">Distance</span>
                <span className="stat-value">{formatMiles(props.distanceMiles)}</span>
              </div>
            )}
            {(props.visitCount ?? 0) > 1 && (
              <div className="stat-row">
                <span className="stat-label">Visits</span>
                <span className="stat-value">{props.visitCount}</span>
              </div>
            )}
            <div className="stat-row">
              <span className="stat-label">{(props.visitCount ?? 0) > 1 ? 'Last visit' : 'Visit date'}</span>
              <span className="stat-value">{props.date || 'Not visited'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Rating</span>
              <StarRating
                size={20}
                disabled={true}
                maxRating={3}
                rating={props.rating}
              />
            </div>
          </section>

          {!props.medium && (
            <footer className="card-footer">
              <p className="card-flavor-text">{props.history}</p>
            </footer>
          )}
        </div>

        <div className="card-face card-face-back">
          <header className="card-header">
            <h2 className="card-title">{props.name}</h2>
            {props.visited && <span className="visited-badge">Visited</span>}
          </header>
          <div className="card-back-body">
            <p className="card-back-label">History</p>
            <p className="card-back-text">{props.history}</p>
          </div>
          <dl className="card-back-facts">
            <div>
              <dt>Nearest Spoons</dt>
              <dd>{formatMiles(props.nearestMiles)}</dd>
            </div>
            <div>
              <dt>Next nearest</dt>
              <dd>{formatMiles(props.secondMiles)}</dd>
            </div>
          </dl>
          {(hasLink(props.website) || hasLink(props.menu)) && (
            <nav className="card-back-links">
              {hasLink(props.website) && (
                <a
                  href={props.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Pub page ↗
                </a>
              )}
              {hasLink(props.menu) && (
                <a
                  href={props.menu}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Menu ↗
                </a>
              )}
            </nav>
          )}
        </div>
      </div>
    </article>
  );
};

export default SpoonCard;
