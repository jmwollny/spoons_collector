// Sent with every request the data pipeline makes, so the sites it reads
// (OpenStreetMap's Overpass API and the Wetherspoon website) can see what is
// fetching their pages rather than mistaking it for a browser
export const USER_AGENT = 'spoons_collector/1.0 (personal Wetherspoons visit logger)';
