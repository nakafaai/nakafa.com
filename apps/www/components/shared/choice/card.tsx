import type { ReactNode } from "react";

/** Keeps choice-card labels aligned with one symmetric content inset. */
export function ChoiceCardContent({ children }: { children: ReactNode }) {
  return <div className="px-6 py-4 text-center">{children}</div>;
}
