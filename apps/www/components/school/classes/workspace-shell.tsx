import type { ReactNode } from "react";

/**
 * Render the class workspace with an optional detail slot that can sit beside
 * the main class surface without changing the page route ownership.
 */
export function SchoolClassesWorkspaceShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col xl:flex-row">
      <div className="min-w-0 flex-1">{children}</div>
      {panel}
    </div>
  );
}
