/** Renders the production try-out metric number style. */
export function TryoutMetricNumber({ value }: { value: number }) {
  return (
    <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none">
      {value}
    </div>
  );
}

/** Renders one correct-answer fraction with stable metric dimensions. */
export function TryoutMetricFraction({
  correct,
  total,
}: {
  correct: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <TryoutMetricNumber value={correct} />
      <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
        /
      </span>
      <TryoutMetricNumber value={total} />
    </div>
  );
}

/** Renders the production try-out duration style. */
export function TryoutMetricTime({ totalSeconds }: { totalSeconds: number }) {
  const segments = getTimeSegments(totalSeconds);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {segments.map((segment, index) => (
        <div className="contents" key={segment.label}>
          <div className="font-light font-mono text-5xl text-foreground tabular-nums leading-none">
            {segment.value.toString().padStart(2, "0")}
          </div>
          <TryoutMetricSeparator visible={index < segments.length - 1} />
        </div>
      ))}
    </div>
  );
}

/** Separates adjacent duration segments without a component ternary. */
function TryoutMetricSeparator({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <span className="font-light font-mono text-3xl text-muted-foreground leading-none">
      :
    </span>
  );
}

/** Splits a duration into the visible time segments for the UI. */
function getTimeSegments(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      { label: "hours", value: hours },
      { label: "minutes", value: minutes },
      { label: "seconds", value: seconds },
    ] as const;
  }

  return [
    { label: "minutes", value: minutes },
    { label: "seconds", value: seconds },
  ] as const;
}
