import type { OptimisticUpdate } from "@confect/react";
import roster from "@repo/backend/confect/_generated/refs/roster";
import { Option } from "effect";

/** Shows a student's roster row as holding a NISN at once, wherever it is read. */
export const setRosterEntryChange: OptimisticUpdate<
  typeof roster.entries.set
> = (localStore, { personId, slug }) => {
  for (const query of localStore.getAllQueries(roster.entries.get)) {
    if (
      Option.isSome(query.value) &&
      query.args.personId === personId &&
      query.args.slug === slug
    ) {
      localStore.setQuery(
        roster.entries.get,
        query.args,
        Option.some({
          hasNisn: true,
          personId,
        })
      );
    }
  }
};
