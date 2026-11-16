import type { PubLocation, VisitEntry } from '../types';
import { formatDate } from '../utils';
import SpoonCard from './SpoonCard';
import { pubPhotoUrl } from '../pubPhoto';

type GalleryCardProps = {
  pub: PubLocation;
  // The pub's visits, newest first
  visits: VisitEntry[];
  isSelected: boolean;
  // Miles from the user, once they've used Near me
  distanceMiles?: number;
  onOpen: (pubId: number) => void;
};

/** One pub in the list, as a card that opens full size when clicked */
export const GalleryCard = ({ pub, visits, isSelected, distanceMiles, onOpen }: GalleryCardProps) => {
  const latest = visits[0];
  return (
    <div className="gallery-card-wrapper">
      <button
        type="button"
        className="visits-card-button"
        onClick={() => onOpen(pub.id)}
        aria-label={`${pub.name}, ${pub.city}`}
      >
        <SpoonCard
          id={pub.id}
          name={pub.name}
          city={pub.city}
          region={pub.region}
          rarity={pub.rarity}
          rating={latest?.rating ?? -1}
          history={pub.history}
          visited={visits.length > 0}
          visitCount={visits.length}
          photoUrl={pubPhotoUrl(pub)}
          medium={true}
          selected={isSelected}
          date={latest ? formatDate(latest.date) : null}
          distanceMiles={distanceMiles}
          nearestMiles={pub.nearestNeighborMiles}
          secondMiles={pub.secondNeighborMiles}
          website={pub.website}
          menu={pub.menu}
        />
      </button>
    </div>
  );
};
