/**
 * Shows nothing in the school's page area while the page's server read answers, so a
 * click into the school commits at once, as the app's own loading boundary does. The
 * sidebar stays, because the school layout above this boundary draws it, and the
 * sidebar's current item moves at the click.
 */
export default function SchoolLoading() {
  return null;
}
