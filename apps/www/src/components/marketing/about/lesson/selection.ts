import type { AtomShellSampleId } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import type { ParabolicLaunchId } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { createContext, use } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/**
 * The reader's choice in each lab of the lesson window. A choice is null until
 * the reader makes one, and the lab then shows its own default.
 */
interface LessonSelectionState {
  atomSample: AtomShellSampleId | null;
  cellItem: number | null;
  circleAngle: number | null;
  projectileLaunch: ParabolicLaunchId | null;
  setAtomSample: (sampleId: AtomShellSampleId) => void;
  setCellItem: (index: number) => void;
  setCircleAngle: (angle: number) => void;
  setProjectileLaunch: (launchId: ParabolicLaunchId) => void;
}

type LessonSelectionStore = StoreApi<LessonSelectionState>;

/**
 * Creates the store of one lesson window. The store lives as long as the window,
 * so a lab that unmounts when the reader opens another lesson gives the same
 * choice back when it mounts again. The store holds no defaults, so the labs keep
 * their own, and the home page's first JavaScript loads none of their data.
 */
export function createLessonSelectionStore(): LessonSelectionStore {
  return createStore<LessonSelectionState>()((set) => ({
    atomSample: null,
    cellItem: null,
    circleAngle: null,
    projectileLaunch: null,
    setAtomSample: (atomSample) => set({ atomSample }),
    setCellItem: (cellItem) => set({ cellItem }),
    setCircleAngle: (circleAngle) => set({ circleAngle }),
    setProjectileLaunch: (projectileLaunch) => set({ projectileLaunch }),
  }));
}

/** The selections of the lesson window. The window provides its store, and its labs read it. */
export const LessonSelectionContext =
  createContext<LessonSelectionStore | null>(null);

/** Reads one part of the selections of the lesson window that holds the lab. */
export function useLessonSelection<Selected>(
  selector: (state: LessonSelectionState) => Selected
) {
  const store = use(LessonSelectionContext);
  if (!store) {
    // A lab has no selections outside its lesson window, a composition error at this seam.
    throw new Error("A lesson lab reads its selections inside its window.");
  }
  return useStore(store, selector);
}
