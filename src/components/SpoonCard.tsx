import './SpoonCard.css';
import { CardFront } from './card/CardFront';
import { CardBack } from './card/CardBack';
import { spoonCardClassName } from './card/cardClassName';

export type SpoonCardProps = {
  id: number;
  name: string;
  city: string;
  region: string;
  rarity: string;
  history: string;
  historyId?: number | null;
  rating: number;
  visited: boolean;
  // How many times the pub has been visited
  visitCount?: number;
  // Card sizes: the map's mini card, the gallery card, and the viewer's
  // full-size card. Without one, the card is the standard 320 × 480.
  small?: boolean;
  medium?: boolean;
  full?: boolean;
  // Just enough to say which pub this is: photo, name, rarity and town.
  // Used on the map, where the visit date and rating show above it.
  compact?: boolean;
  // Shows the back of the card (history, distances, links)
  flipped?: boolean;
  onClick?: () => void;
  // Whether public/images holds a photo for this pub
  // The pub's photo, or null for the dotted placeholder
  photoUrl: string | null;
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

/** A pub as a trading card: the front shows its stats, the back its history */
const SpoonCard = (props: SpoonCardProps) => (
  <article
    className={spoonCardClassName(props)}
    data-region={props.region.toLowerCase()}
    onClick={props.onClick}
  >
    <div className="spoon-card__inner">
      <CardFront
        name={props.name}
        city={props.city}
        region={props.region}
        rarity={props.rarity}
        rating={props.rating}
        visited={props.visited}
        visitCount={props.visitCount ?? 0}
        date={props.date ?? null}
        photoUrl={props.photoUrl}
        distanceMiles={props.distanceMiles}
        compact={Boolean(props.compact)}
        hidden={Boolean(props.flipped)}
      />
      <CardBack
        name={props.name}
        visited={props.visited}
        history={props.history}
        historyId={props.historyId}
        nearestMiles={props.nearestMiles}
        secondMiles={props.secondMiles}
        website={props.website}
        menu={props.menu}
        hidden={!props.flipped}
      />
    </div>
  </article>
);

export default SpoonCard;
