const RARITIES = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];

/** The map's key: a marker for each rarity, and for visited pubs */
export const MapLegend = () => (
  <ul className="map-legend" aria-label="Map key">
    {RARITIES.map((rarity) => (
      <li key={rarity}>
        <span className={`spoon-marker rarity-${rarity.toLowerCase()}`} />
        {rarity}
      </li>
    ))}
    <li>
      <span className="spoon-marker visited" />
      Visited
    </li>
  </ul>
);
