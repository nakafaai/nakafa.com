import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode } from "react";
import type { PlayerMode } from "@/components/player/mode";

const ModeContext = createContext<PlayerMode | null>(null);

/**
 * Gives the student's running paper the view the page resolved from the address and the saved view. The
 * view is fixed for the page, so the context never changes while the page shows.
 */
export function SittingModeProvider({
  children,
  mode,
}: {
  readonly children: ReactNode;
  readonly mode: PlayerMode;
}) {
  return <ModeContext value={mode}>{children}</ModeContext>;
}

/** Reads the view of the sitting's paper. It throws outside the provider, which the sitting page always provides. */
export function useSittingMode(): PlayerMode {
  return useRequired(ModeContext, "useSittingMode");
}
