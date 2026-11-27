/** A number held between 0 and 1. */
export function held(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** How far a place is from the middle of its own stripe of `count` stripes, from 0 to 1. */
export function fromStripe(place: number, count: number) {
  const along = place * count;
  return Math.abs(along - Math.floor(along) - 0.5) * 2;
}
