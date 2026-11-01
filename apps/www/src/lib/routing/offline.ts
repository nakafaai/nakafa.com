/**
 * Whether a move holds while the browser has no network. Another page may need code the tab never
 * loaded, and the router reloads the tab for a chunk it cannot fetch, which swaps the page for the
 * browser's offline screen and loses what was on it. A move inside one page, such as to the next
 * question of a sitting, needs nothing from the network and goes on.
 */
export function holdsOffline(online: boolean, from: string, to: string) {
  return !online && from !== to;
}
