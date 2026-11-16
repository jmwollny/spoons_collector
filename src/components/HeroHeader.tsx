import { useMemo, type ReactNode } from 'react';
import type { PubLocation, VisitEntry } from '../types';
import { pickHeaderPubs } from '../headerPhotos';
import { usePubPhotoUrl } from '../pubPhoto';
import './HeroHeader.css';

type HeroHeaderProps = {
  visits: VisitEntry[];
  locations: PubLocation[];
  pubsById: Map<number, PubLocation>;
  visitedCount: number;
  // The ☰ menu
  children: ReactNode;
};

const MosaicTile = ({ pub }: { pub: PubLocation }) => {
  const photoUrl = usePubPhotoUrl(pub);
  return (
    <span className="hero-tile">{photoUrl && <img src={photoUrl} alt="" loading="lazy" decoding="async" />}</span>
  );
};

/**
 * The app's title over a mosaic of pub photos: the user's own pubs first,
 * so the header shows their collection.
 */
export const HeroHeader = ({ visits, locations, pubsById, visitedCount, children }: HeroHeaderProps) => {
  const pubs = useMemo(() => pickHeaderPubs(visits, locations, pubsById), [visits, locations, pubsById]);

  return (
    <header className="hero-card">
      <div className="hero-mosaic" aria-hidden="true">
        {pubs.map((pub) => (
          <MosaicTile key={pub.id} pub={pub} />
        ))}
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-title">
        <img className="hero-logo" src="/favicon.svg" alt="" />
        <div>
          <h1>Spoons Collector</h1>
          <p className="hero-copy">Log your visits and rate each pub.</p>
          <p className="hero-count">
            <strong>{visitedCount}</strong> of {locations.length} pubs collected
          </p>
        </div>
      </div>
      <div className="hero-menu">{children}</div>
    </header>
  );
};
