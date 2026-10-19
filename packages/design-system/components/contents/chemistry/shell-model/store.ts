import { createStore } from "zustand";
import { combine } from "zustand/middleware";

/**
 * Creates one shell lab's store, which holds the sample its reader picked. The
 * lab creates it once and reads the sample from it with `useStore`.
 */
export function createShellModelSampleStore<SampleId extends string>(
  initialSampleId: SampleId
) {
  return createStore(
    combine({ sampleId: initialSampleId }, (set) => ({
      selectSample: (sampleId: SampleId) => set({ sampleId }),
    }))
  );
}
