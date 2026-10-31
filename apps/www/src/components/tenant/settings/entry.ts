import type { OptimisticUpdate } from "@confect/react";
import roster from "@repo/backend/confect/_generated/refs/roster";
import { Option } from "effect";

/**
 * Shows a student's roster row as set at once, wherever it is read: a NISN typed now counts as stored, and a call
 * without one keeps whether one was stored, as the server keeps the NISN on file.
 */
export const setRosterEntryChange: OptimisticUpdate<
  typeof roster.entries.set
> = (localStore, { nisn, personId, slug, underAgeLimit }) => {
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
          hasNisn: query.value.value.hasNisn || nisn !== undefined,
          personId,
          underAgeLimit,
        })
      );
    }
  }
};
