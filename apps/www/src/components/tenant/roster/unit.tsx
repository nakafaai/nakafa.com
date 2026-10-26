import { QueryResult } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { useViewerQuery } from "@/components/tenant/context";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";

/** The unit the Admin imports into: the one chosen, or none until the Admin chooses one. */
const RosterUnitState = Schema.Struct({
  chosen: Schema.UndefinedOr(Id("tenantUnits")),
});

/** The action that chooses the unit. */
interface RosterUnitActions {
  readonly choose: (unitId: UnitId) => void;
}

/** The unit choice of one import page, with its action. */
type RosterUnitStore = typeof RosterUnitState.Type & RosterUnitActions;

/** Creates the unit choice of one import page, with no unit chosen. */
const createRosterUnit = () =>
  createStore<RosterUnitStore>()((set) => ({
    choose: (unitId) => set({ chosen: unitId }),
    chosen: undefined,
  }));

const RosterUnitContext = createContext<StoreApi<RosterUnitStore> | null>(null);

/** Gives the import page its unit choice, created once for the page. */
export function RosterUnitProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createRosterUnit);

  return <RosterUnitContext value={store}>{children}</RosterUnitContext>;
}

/** Reads one selected slice of the page's unit choice. */
function useRosterUnitStore<T>(selector: (state: RosterUnitStore) => T) {
  const store = use(RosterUnitContext);

  if (store === null) {
    throw new Error(
      "useRosterUnitStore must be used within RosterUnitProvider"
    );
  }

  return useStore(store, selector);
}

/** The school's units once the viewer is in, and the unit the import goes into: the chosen one, else the first active one. */
export function useRosterUnit() {
  const viewer = useViewerQuery();
  const chosen = useRosterUnitStore((state) => state.chosen);

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return;
  }
  const units = viewer.value.units;

  return {
    unit: Arr.findFirst(units, (candidate) =>
      chosen === undefined
        ? candidate.status === "active"
        : candidate.id === chosen
    ),
    units,
  };
}

/** The choice of the unit to import into, in the page's header, when the school has more than one. */
export function RosterUnitChoice() {
  const read = useRosterUnit();
  const choose = useRosterUnitStore((state) => state.choose);

  if (read === undefined || Option.isNone(read.unit) || read.units.length < 2) {
    return null;
  }

  return (
    <SchoolUnitChoice
      onChoose={choose}
      unitId={read.unit.value.id}
      units={read.units}
    />
  );
}
