import type { OptimisticUpdate } from "@confect/react";
import roster from "@repo/backend/confect/_generated/refs/roster";
import { Option } from "effect";
import { changeLoaded } from "@/lib/data/loaded";

/** Shows a student's roster row as holding a NISN at once, wherever it is read. */
export const setRosterEntryChange: OptimisticUpdate<
  typeof roster.entries.set
> = (localStore, { personId, slug }) => {
  changeLoaded(localStore, roster.entries.get, (_value, args) =>
    args.personId === personId && args.slug === slug
      ? Option.some({ hasNisn: true, personId })
      : Option.none()
  );
};
