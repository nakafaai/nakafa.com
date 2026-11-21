import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import type { RefObject } from "react";
import { createContext, use } from "react";

/**
 * What every part of one paddy scene shares: the crop it grows, how far the
 * field is flooded (0 drained, 1 flooded, eased between), and the seconds of
 * play its moving particles follow.
 */
interface PaddyState {
  readonly clock: RefObject<number>;
  readonly flood: RefObject<number>;
  readonly plant: Plant;
}

/** The shared state of the paddy scene the reader is looking at, set by `PaddyScene`. */
export const PaddyContext = createContext<PaddyState | null>(null);

/** The shared state of the enclosing paddy scene; outside one, a drained rice field standing still. */
export function usePaddy(): PaddyState {
  return (
    use(PaddyContext) ?? {
      clock: { current: 0 },
      flood: { current: 0 },
      plant: "rice",
    }
  );
}
