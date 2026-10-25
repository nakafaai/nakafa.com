import { Schema } from "effect";
import { TextSearchParam } from "@/lib/entry/search";

/**
 * The sign-in query of an address: the provider's failure, and the destination
 * that the sign-in resumes. The button renders under several routes, and a route
 * that does not declare these keys would drop them from its search, so the
 * decoder reads the address's own query text.
 */
const AuthReturnQuery = Schema.fromURLSearchParams(
  Schema.Struct({
    error: TextSearchParam,
    redirect: TextSearchParam,
  })
);

/** Reads the sign-in query of one raw query string. A repeated key reads as absent. */
export function readAuthReturnQuery(search: string) {
  return Schema.decodeSync(AuthReturnQuery)(new URLSearchParams(search));
}
