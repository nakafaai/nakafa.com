import type { ReactNode } from "react";

/**
 * Lays the questions beside the navigator. The questions keep one width at
 * every breakpoint, and the navigator never pushes them.
 */
export function PlayerMain({
  children,
  navigator,
}: {
  children: ReactNode;
  navigator: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 lg:max-w-5xl">
      <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
      {navigator}
    </div>
  );
}
