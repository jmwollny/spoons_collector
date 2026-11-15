import type { PubLocation } from '../types';
import type { PubVisitStats } from '../hooks/useVisits';
import type { PubTrail } from '../trail';
import SpoonCard from './SpoonCard';
import { TrailNav } from './TrailNav';

type MapPubCardProps = {
  pub: PubLocation;
  stats: PubVisitStats;
  trail: PubTrail;
  onOpen: () => void;
};

/**
 * The selected pub's card in the corner of the map, with Previous and Next
 * under it. Hidden on phones, where the pub sheet shows instead.
 */
export const MapPubCard = ({ pub, stats, trail, onOpen }: MapPubCardProps) => (
  <>
    <SpoonCard
      id={pub.id}
      name={pub.name}
      city={pub.city}
      region={pub.region}
      rarity={pub.rarity}
      rating={stats.rating}
      history={pub.history}
      visited={stats.count > 0}
      visitCount={stats.count}
      date={stats.date}
      small={true}
      compact={true}
      hasImage={Boolean(pub.imgType)}
      nearestMiles={pub.nearestNeighborMiles}
      secondMiles={pub.secondNeighborMiles}
      website={pub.website}
      menu={pub.menu}
      onClick={onOpen}
    />
    <div className="map-card-nav">
      <TrailNav trail={trail} variant="map" />
    </div>
  </>
);
