export type PubLocation = {
  // Wetherspoon's own id for the pub (jdwId in the data). Stable across data
  // refreshes, so visits and image names are keyed on it.
  id: number;
  // OpenStreetMap id; changes whenever a mapper redraws the pub
  osmId: number;
  name: string;
  city: string;
  postcode: string;
  lon: number;
  lat: number;
  website: string;
  menu: string;
  region: string;
  // null when the pub's page has no photo yet (typically a newly opened pub)
  imgUrl: string | null;
  // Empty in a shareable build, which loads it from Wetherspoon's site by
  // historyId instead (see pubHistory.ts)
  history: string;
  // The pub's entry in the site's pub histories; null if it has none
  historyId?: number | null;
  rarity: string;
  imgType: string | null;
  // Miles to the nearest and second-nearest other Wetherspoon. Rarity is
  // based on the second-nearest.
  nearestNeighborMiles: number;
  secondNeighborMiles: number;
};

export type VisitEntry = {
  id: string;
  // The pub's Wetherspoon id
  locationId: number;
  date: string;
  // -1 for none, 0 to 2 for one to three stars
  rating: number;
  // What the user drank, who they were with, anything else
  drink?: string;
  company?: string;
  notes?: string;
  // Whether a photo is saved for this visit, on this device (see photos.ts)
  hasPhoto?: boolean;
};

/** The parts of a visit the user fills in */
export type VisitDetails = Omit<VisitEntry, 'id' | 'locationId'>;
