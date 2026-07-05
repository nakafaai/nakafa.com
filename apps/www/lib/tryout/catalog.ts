import { fetchConvexRuntimeQuery } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { env } from "@/env";

type ListCountriesArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.listCountries
>;
type ListExamsArgs = FunctionArgs<typeof api.tryouts.queries.catalog.listExams>;
type ListSetsArgs = FunctionArgs<typeof api.tryouts.queries.catalog.listSets>;
type GetSetArgs = FunctionArgs<typeof api.tryouts.queries.catalog.getSet>;
type GetSectionArgs = FunctionArgs<
  typeof api.tryouts.queries.catalog.getSection
>;

/** Reads active try-out countries through the public Convex catalog query. */
export function fetchTryoutCountries(args: ListCountriesArgs) {
  return fetchConvexRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.tryouts.queries.catalog.listCountries,
    args
  );
}

/** Reads active exam families for one country through the public Convex catalog query. */
export function fetchTryoutExams(args: ListExamsArgs) {
  return fetchConvexRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.tryouts.queries.catalog.listExams,
    args
  );
}

/** Reads active try-out sets for one country and exam family. */
export function fetchTryoutSets(args: ListSetsArgs) {
  return fetchConvexRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.tryouts.queries.catalog.listSets,
    args
  );
}

/** Reads one active try-out set with its ordered section rows. */
export function fetchTryoutSet(args: GetSetArgs) {
  return fetchConvexRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.tryouts.queries.catalog.getSet,
    args
  );
}

/** Reads one active try-out section with its public question rows. */
export function fetchTryoutSection(args: GetSectionArgs) {
  return fetchConvexRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.tryouts.queries.catalog.getSection,
    args
  );
}
