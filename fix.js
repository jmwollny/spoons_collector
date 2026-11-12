import spoons from './assets/spoons.json' with { type: 'json' };
import websites from './assets/websites.json' with { type: 'json' };
import missingPostcodes from './assets/missing_postcodes.json' with { type: 'json' };
import deadSpoons from './assets/dead_spoons.json' with { type: 'json' };
import cities from './assets/cities.json' with { type: 'json' };
import histories from './assets/missing_history.json' with { type: 'json' };
import images from './assets/images.json' with { type: 'json' };
import fs from 'fs';

const fix = () => {
  const filteredSpoons = removeDeadSpoons(spoons);
  filteredSpoons.forEach((pub) => {
    const idStr = pub.id.toString();

    // Fix postcodes
    if (missingPostcodes[pub.id]) {
      const newPostcode = missingPostcodes[pub.id];
      console.log(
        `Updating postcode for '${pub.name}[${pub.id}]' from ${pub.postcode} to ${newPostcode}.`,
      );
      pub.postcode = newPostcode;
    }

    // Fix cities
    if (cities[pub.id]) {
      const newCity = cities[pub.id];
      console.log(
        `Updating city for '${pub.name}[${pub.id}]' from ${pub.city} to ${newCity}.`,
      );
      pub.city = newCity;
    }

    // Fix websites
    if (websites[idStr]) {
      const newWebsite = websites[idStr];
      console.log(
        `Updating website for '${pub.name}' from ${pub.website} to ${newWebsite}.`,
      );
      pub.website = newWebsite;
    }

    // Fix missing history
    if (histories[idStr]) {
      const newHistory = histories[idStr];
      console.log(`Updating history for '${pub.name}' to ${newHistory}.`);
      pub.history = newHistory;
    }

    // Fix missing images
    if (images[idStr]) {
      const newImage = images[idStr];
      pub.jdwId = newImage.jdwId;
      pub.imgUrl = newImage.imgUrl;
      pub.imgType = newImage.imgType;
      console.log(
        `Updating image for '${pub.name}' to ${JSON.stringify(newImage)}.`,
      );
    }
  });

  // Save the updated file
  fs.writeFileSync(
    './assets/spoons_fixed.json',
    JSON.stringify(filteredSpoons, null, 2),
  );
  console.log('Fixes saved to spoons_fixed.json.');
};

const removeDeadSpoons = (spoonsArr) => {
  return spoonsArr.filter((pub) => {
    return !deadSpoons.includes(pub.id);
  });
};

// --- Main ---
async function main() {
  fix();
}
main().catch(console.error);
