import { createContext, type ReactNode, use } from "react";
import type { PlayerMode } from "@/components/player/mode";

const ModeContext = createContext<PlayerMode | null>(null);

/**
 * Gives the student's running paper the view the server resolved from the address and the saved view. The
 * view is fixed for the page, so the context never changes after hydration.
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
  const mode = use(ModeContext);
  if (mode === null) {
    throw new Error("useSittingMode must be used within SittingModeProvider");
  }
  return mode;
}
