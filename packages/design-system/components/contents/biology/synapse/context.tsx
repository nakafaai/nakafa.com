import type { Treatment } from "@repo/design-system/components/contents/biology/synapse/transmission";
import { useRequired } from "@repo/design-system/hooks/required";
import type { ReactNode, RefObject } from "react";
import { createContext, useMemo } from "react";

/**
 * What every part of the synapse reads while it plays: the run's clock in
 * seconds on the screen, which the scene moves every frame, the rate the
 * impulses arrive at, and the drug in the cleft.
 */
const SynapseContext = createContext<{
  readonly clock: RefObject<number>;
  readonly rate: number;
  readonly treatment: Treatment;
} | null>(null);

/** Shares the run's clock, the rate and the drug with the parts of the synapse. */
export function SynapseProvider({
  children,
  clock,
  rate,
  treatment,
}: {
  readonly children: ReactNode;
  readonly clock: RefObject<number>;
  readonly rate: number;
  readonly treatment: Treatment;
}) {
  const value = useMemo(
    () => ({ clock, rate, treatment }),
    [clock, rate, treatment]
  );
  return <SynapseContext value={value}>{children}</SynapseContext>;
}

/** Reads the run's clock, the rate and the drug of the surrounding synapse. */
export function useSynapse() {
  return useRequired(SynapseContext, "useSynapse");
}
