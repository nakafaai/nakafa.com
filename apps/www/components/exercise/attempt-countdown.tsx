"use client";

interface CountdownProps {
  timer: {
    formatted: {
      hours: number;
      minutes: number;
      seconds: number;
    };
  };
}

/** Renders the attempt timer as stable tabular text for production pages. */
export function Countdown({ timer }: CountdownProps) {
  const { formatted } = timer;
  const hours = formatted.hours.toString().padStart(2, "0");
  const minutes = formatted.minutes.toString().padStart(2, "0");
  const seconds = formatted.seconds.toString().padStart(2, "0");

  return (
    <div className="pl-2">
      <time className="font-mono text-lg tabular-nums">
        {hours}:{minutes}:{seconds}
      </time>
    </div>
  );
}
