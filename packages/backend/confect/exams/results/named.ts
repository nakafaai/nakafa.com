import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

/**
 * One page of the people of a school whose names match a search, best match first: each word of the search matches a
 * word of the name whole, and its last word matches as a prefix, so a search reads as it is typed. A results list
 * that a viewer searches by name reads its rows through these people, so the search reaches every page of the list.
 */
export const namedPeople = Effect.fn("exams.results.named")(function* (
  tenantId: TenantPeopleDoc["tenantId"],
  search: string,
  paginationOpts: PaginationOptions
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .search("search_name", (index) =>
      index.search("name", search).eq("tenantId", tenantId)
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
});
