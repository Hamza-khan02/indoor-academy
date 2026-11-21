// Google Maps links for branches.

const MAPS_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com', 'google.com', 'www.google.co.in', 'google.co.in'];

/** True for a Google Maps link (only these are shown to parents, so no other sites can be linked). */
export function isGoogleMapsUrl(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !MAPS_HOSTS.includes(u.hostname)) return false;
    if (u.hostname === 'goo.gl') return u.pathname.startsWith('/maps');
    if (u.hostname.endsWith('google.com') || u.hostname.endsWith('google.co.in')) return u.hostname.startsWith('maps.') || u.pathname.startsWith('/maps');
    return true;
  } catch {
    return false;
  }
}

/** Link that opens the branch in Google Maps: the saved link, or a search for the address. */
export function directionsUrl(branch: { name: string; address: string | null; mapsUrl: string | null }) {
  if (branch.mapsUrl) return branch.mapsUrl;
  if (!branch.address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`;
}
