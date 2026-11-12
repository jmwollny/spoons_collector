/**
 * Calculates the rarity tier of a single pub relative to the entire estate
 * @param {Object} currentPub - The pub currently being processed
 * @param {Array} allSpoons - The full array of all collected pubs
 * @returns {Object} { rarity, nearestNeighborMiles }
 */
function calculateRarity(currentPub, allSpoons) {
  let nearestDistance = Infinity;

  // Find the absolute closest neighbor in the estate
  for (const targetPub of allSpoons) {
    if (currentPub.id === targetPub.id) continue; // Don't match against itself

    const dist = getDistance(
      currentPub.lat,
      currentPub.lon,
      targetPub.lat,
      targetPub.lon,
    );
    if (dist < nearestDistance) {
      nearestDistance = dist;
    }
  }

  // Real-world calibrated thresholds for the ~830 UK Wetherspoons footprint
  let rarity = 'Common';

  if (nearestDistance >= 12.0) {
    rarity = 'Legendary'; // Remote outposts (e.g., Stornoway, Wick, extreme coastlines)
  } else if (nearestDistance >= 6.0) {
    rarity = 'Epic'; // Highly isolated standalone target locations
  } else if (nearestDistance >= 2.5) {
    rarity = 'Rare'; // Country market town hubs
  } else if (nearestDistance >= 1.0) {
    rarity = 'Uncommon'; // Standard outer suburban towns
  }

  return {
    rarity,
    nearestNeighborMiles: parseFloat(nearestDistance.toFixed(2)),
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
