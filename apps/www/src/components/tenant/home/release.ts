import { type Id, Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import { createStore } from "zustand";

/** The closed sittings whose results the school home is releasing, by their IDs. */
const ReleasesState = Schema.Struct({
  ids: Schema.Array(IdSchema("examSittings")),
});

/** The actions that start and end the release of one sitting's results. */
interface ReleasesActions {
  /** Ends the release of a sitting, once the server refused it, so its row offers the release again. */
  readonly end: (id: Id<"examSittings">) => void;
  /** Starts the release of a sitting, so its row shows the release before the server answers. */
  readonly start: (id: Id<"examSittings">) => void;
}

/** The state of the releases in flight, with its actions. */
export type HomeReleases = typeof ReleasesState.Type & ReleasesActions;

/** Creates the releases of one home. Each home creates its own, once. */
export const createHomeReleases = () =>
  createStore<HomeReleases>()((set) => ({
    end: (id) =>
      set((state) => ({
        ids: Arr.filter(state.ids, (current) => current !== id),
      })),
    ids: [],
    start: (id) => set((state) => ({ ids: Arr.append(state.ids, id) })),
  }));

/** A closed sitting's row as the school home holds it, with what its release changes. */
const ReleasableRow = Schema.Struct({
  canRelease: Schema.Boolean,
  id: IdSchema("examSittings"),
  resultsReleased: Schema.Boolean,
});

/**
 * The closed sittings once one sitting's results are released: its row offers no release and shows as released, and
 * every other row is kept as the server sent it.
 */
export const releaseInRows = <Row extends typeof ReleasableRow.Type>(
  rows: readonly Row[],
  sittingId: Id<"examSittings">
): readonly Row[] =>
  Arr.map(rows, (row) =>
    row.id === sittingId
      ? { ...row, canRelease: false, resultsReleased: true }
      : row
  );
