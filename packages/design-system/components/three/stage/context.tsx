import { isMobileDevice } from "@repo/design-system/lib/device";
import { createContext, type ReactNode, use, useMemo } from "react";

interface StageProviderProps {
  readonly children: ReactNode;
  /** The height of the floor objects stand on, when the lab has one. */
  readonly floor: number | undefined;
  /** How far the lab reaches from its middle, in scene units. */
  readonly reach: number;
}

/**
 * What every part of a stage reads: the lab's floor and reach, and whether the
 * device is a phone, which keeps the finish a phone can afford.
 */
type StageValue = Omit<StageProviderProps, "children"> &
  Readonly<Record<"phone", boolean>>;

const StageContext = createContext<StageValue | null>(null);

/**
 * Shares the floor and reach of one lab with the parts of its stage. It renders
 * inside the canvas, which mounts only in the browser, so reading the device
 * never reaches streamed server HTML.
 */
export function StageProvider({ children, floor, reach }: StageProviderProps) {
  const value = useMemo(
    () => ({ floor, phone: isMobileDevice(), reach }),
    [floor, reach]
  );

  return <StageContext value={value}>{children}</StageContext>;
}

/** Reads the floor, reach, and device of the surrounding stage. */
export function useStage() {
  const stage = use(StageContext);
  if (!stage) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useStage must be used within StageProvider");
  }
  return stage;
}
