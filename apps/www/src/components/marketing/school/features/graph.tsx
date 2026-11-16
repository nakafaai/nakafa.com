/**
 * The graph a lab group draws of a cart before and after a collision, as a picture in code: the grid, the two axes,
 * and the momentum of each cart as one line, flat until the hit and flat again after it. It scales to its box, and
 * says nothing to a screen reader, since the file's name beside it does.
 */
export function LabGraph() {
  return (
    <svg
      aria-hidden="true"
      className="bg-background size-full"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 160 100"
    >
      <path
        className="stroke-border"
        d="M20 25H150M20 50H150M20 75H150M55 10V85M90 10V85M125 10V85"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="stroke-muted-foreground"
        d="M20 10V85H150"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="stroke-pop-blue"
        d="M20 30H78C84 30 86 58 92 58H150"
        strokeLinecap="round"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="stroke-pop-orange"
        d="M20 80H78C84 80 86 52 92 52H150"
        strokeLinecap="round"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      <circle className="fill-pop-red" cx="85" cy="44" r="3" />
    </svg>
  );
}
