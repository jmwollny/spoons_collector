// Rarity thresholds in miles, applied to the distance to the SECOND-nearest
// other Wetherspoon. Using the second-nearest means a pair of pubs in an
// otherwise isolated town (Carlisle's two are 0.06 miles apart, with the next
// 17 miles away) are rare, rather than making each other Common. The values
// keep the tiers about the size they were under the old nearest-pub rule.
const RARITY_TIERS = [
  { rarity: 'Legendary', minMiles: 16 },
  { rarity: 'Epic', minMiles: 9 },
  { rarity: 'Rare', minMiles: 4.5 },
  { rarity: 'Uncommon', minMiles: 2.25 },
  { rarity: 'Common', minMiles: 0 },
];

/**
 * Calculates the rarity tier of a single pub relative to the entire estate
 * @param {Object} currentPub - The pub currently being processed
 * @param {Array} allSpoons - The full array of all collected pubs
 * @returns {Object} { rarity, nearestNeighborMiles, secondNeighborMiles }
 */
function calculateRarity(currentPub, allSpoons) {
  let nearest = Infinity;
  let secondNearest = Infinity;

  for (const targetPub of allSpoons) {
    if (currentPub.id === targetPub.id) continue; // Don't match against itself

    const dist = getDistance(
      currentPub.lat,
      currentPub.lon,
      targetPub.lat,
      targetPub.lon,
    );
    if (dist < nearest) {
      secondNearest = nearest;
      nearest = dist;
    } else if (dist < secondNearest) {
      secondNearest = dist;
    }
  }

  const { rarity } = RARITY_TIERS.find((tier) => secondNearest >= tier.minMiles);

  return {
    rarity,
    nearestNeighborMiles: parseFloat(nearest.toFixed(2)),
    secondNeighborMiles: parseFloat(secondNearest.toFixed(2)),
  };
}

/**
 * Standard Haversine formula to calculate distance between two coordinates in miles
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default calculateRarity;
