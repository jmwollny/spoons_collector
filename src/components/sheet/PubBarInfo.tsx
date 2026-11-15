import type { PubLocation } from '../../types';

type PubBarInfoProps = {
  pub: PubLocation;
  visitCount: number;
  // Date of the latest visit, formatted for display
  date: string | null;
};

/** The pub's photo, name, rarity, town and whether it's been visited */
export const PubBarInfo = ({ pub, visitCount, date }: PubBarInfoProps) => (
  <>
    {pub.imgType ? (
      <img className="map-pub-bar-photo" src={`/images/${pub.id}.webp`} alt="" />
    ) : (
      <span className="map-pub-bar-photo" />
    )}
    <span className="map-pub-bar-text">
      <span className="map-pub-bar-name">{pub.name}</span>
      <span className="map-pub-bar-meta">
        <span className="map-pub-bar-rarity">{pub.rarity}</span>
        <span>{pub.city}</span>
        {visitCount > 0 ? (
          <span className="map-pub-bar-visited">✓ {visitCount > 1 ? `${visitCount} visits` : date}</span>
        ) : (
          <span>Not visited</span>
        )}
      </span>
    </span>
  </>
);
