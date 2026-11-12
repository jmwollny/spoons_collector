import fs from 'fs';

// Haversine formula to calculate real-world distance over a sphere
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Radius of the Earth in miles (use 6371 for kilometers)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

const generateTrail = (startLat, startLon, totalCheckpoints = 5) => {
  if (!fs.existsSync('./assets/spoons.json')) {
    console.error("❌ Missing ./assets/spoons.json. Run your collector script first!");
    return;
  }

  const spoons = JSON.parse(fs.readFileSync('./assets/spoons.json', 'utf-8'));
  const unvisited = [...spoons];
  const trail = [];

  let currentLat = startLat;
  let currentLon = startLon;

  console.log(`🗺️  Plotting a ${totalCheckpoints}-stop treasure hunt from [${startLat}, ${startLon}]...\n`);

  for (let i = 0; i < totalCheckpoints; i++) {
    if (unvisited.length === 0) break;

    let closestIndex = -1;
    let shortestDistance = Infinity;

    // Scan all remaining unvisited pubs for the absolute closest neighbor
    for (let j = 0; j < unvisited.length; j++) {
      const dist = calculateDistance(currentLat, currentLon, unvisited[j].lat, unvisited[j].lon);
      if (dist < shortestDistance) {
        shortestDistance = dist;
        closestIndex = j;
      }
    }

    if (closestIndex !== -1) {
      const nextStop = unvisited.splice(closestIndex, 1)[0];
      
      trail.push({
        checkpoint: i + 1,
        id: nextStop.id,
        name: nextStop.name,
        city: nextStop.city,
        lat: nextStop.lat,
        lon: nextStop.lon,
        distanceFromPreviousMiles: parseFloat(shortestDistance.toFixed(2))
      });

      // Move our search anchor to the newly discovered pub
      currentLat = nextStop.lat;
      currentLon = nextStop.lon;
    }
  }

  // Calculate overall metrics
  const totalDistance = trail.reduce((sum, stop) => sum + stop.distanceFromPreviousMiles, 0);

  // Print a scannable summary to the console
  console.log("🏆 YOUR TREASURE HUNT TRAIL:");
  console.log("----------------------------------------------------------------");
  trail.forEach((stop) => {
    console.log(`📍 Stop ${stop.checkpoint}: ${stop.name} (${stop.city})`);
    console.log(`   ↳ Leg Distance: ${stop.distanceFromPreviousMiles} miles`);
  });
  console.log("----------------------------------------------------------------");
  console.log(`🏁 Total Route Distance: ${totalDistance.toFixed(2)} miles\n`);

  // Save the manifest as an independent hunt file
  if (!fs.existsSync('./hunts')) fs.mkdirSync('./hunts');
  fs.writeFileSync('./hunts/regional_hunt.json', JSON.stringify(trail, null, 2), 'utf-8');
  console.log("💾 Route manifest saved to ./hunts/regional_hunt.json");
};

// Example coordinates: Let's center it around South London (SE25 / Crystal Palace area)
const targetLat = 51.3970;
const targetLon = -0.0750;

generateTrail(targetLat, targetLon, 6);