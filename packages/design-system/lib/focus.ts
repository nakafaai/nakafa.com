/**
 * Whether the focus has gone nowhere the learner chose: to the body, or into
 * `box`, which is leaving the page with it. Without a box, only the body counts.
 */
export function focusIsLost(box: Element | null) {
  const active = document.activeElement;
  return (
    active === null ||
    active === document.body ||
    box?.contains(active) === true
  );
}
