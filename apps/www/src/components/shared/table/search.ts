/**
 * Whether a row's text holds the search, ignoring case and the spaces around the search. A blank search
 * holds every row, so an empty search filters nothing.
 */
export const matchesSearch = (text: string, search: string): boolean =>
  text.toLowerCase().includes(search.trim().toLowerCase());
