import StarRating from '../StarRating';
import { formatMiles } from '../../utils';
import { CardHeader } from './CardHeader';
import { StatRow } from './StatRow';

export type CardFrontProps = {
  id: number;
  name: string;
  city: string;
  region: string;
  rarity: string;
  rating: number;
  visited: boolean;
  visitCount: number;
  // Date of the latest visit, formatted for display
  date: string | null;
  // Whether public/images holds a photo for this pub
  hasImage: boolean;
  // Miles from the user, once they've used Near me
  distanceMiles?: number;
  // Leaves out the visit date and rating (the map's card, where they show
  // above it)
  compact: boolean;
  // Hidden from screen readers while the back is showing
  hidden: boolean;
};

/** The front of a card: photo, region and stats */
export const CardFront = ({
  id,
  name,
  city,
  region,
  rarity,
  rating,
  visited,
  visitCount,
  date,
  hasImage,
  distanceMiles,
  compact,
  hidden,
}: CardFrontProps) => (
  <div className="card-face card-face-front" aria-hidden={hidden}>
    <CardHeader name={name} visited={visited} />

    <figure className="card-art-frame">
      {/* Without a photo the dotted placeholder below shows instead */}
      {hasImage && (
        <img
          src={`/images/${id}.webp`}
          alt={name}
          className="card-art-image"
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div className="card-map-fallback" />
      <span className="region-badge">{region}</span>
    </figure>

    <section className="card-stats-panel">
      <StatRow label="Rarity">{rarity}</StatRow>
      <StatRow label="Locality">{city}</StatRow>
      {distanceMiles !== undefined && <StatRow label="Distance">{formatMiles(distanceMiles)}</StatRow>}
      {!compact && visitCount > 1 && <StatRow label="Visits">{visitCount}</StatRow>}
      {!compact && (
        <>
          <StatRow label={visitCount > 1 ? 'Last visit' : 'Visit date'}>{date || 'Not visited'}</StatRow>
          <StatRow label="Rating">
            <StarRating size={20} disabled={true} maxRating={3} rating={rating} />
          </StatRow>
        </>
      )}
    </section>
    {/* The history is on the back of the card, in full */}
  </div>
);
