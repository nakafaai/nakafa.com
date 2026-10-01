import type { ReactNode } from "react";

/**
 * Lays the question column beside the navigator slot. The column keeps its
 * width at every breakpoint, and the navigator never pushes it.
 */
export function PlayerMain({
  children,
  navigator,
}: {
  readonly children: ReactNode;
  readonly navigator: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 lg:max-w-5xl">
      <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
      {navigator}
    </div>
  );
}
