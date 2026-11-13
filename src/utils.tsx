export const formatDate = (dateStr: string): string | null => {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
};

/** Great-circle (haversine) distance between two points, in miles */
export const distanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** e.g. "0.3 mi", "12 mi" */
export const formatMiles = (miles: number) =>
  `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
