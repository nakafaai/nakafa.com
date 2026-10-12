import type {
  CapabilityArtifact,
  CapabilityProgress,
} from "@repo/backend/confect/nina/capability/progress";
import { Array as Arr, Effect, MutableRef } from "effect";

/**
 * A publish function for a tool under test that keeps every part it is given.
 * `parts` returns the parts published so far, in order, as a plain list.
 */
export function createProgress() {
  const written = MutableRef.make<readonly CapabilityArtifact[]>([]);
  const publish: CapabilityProgress = Effect.fn("test.publish")((part) =>
    Effect.sync(() => {
      MutableRef.update(written, Arr.append(part));
    })
  );

  return { parts: () => MutableRef.get(written), publish };
}
