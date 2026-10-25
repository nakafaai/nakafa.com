import { Effect, Schema } from "effect";
import { QueryText } from "@/lib/routing/search";

/**
 * One optional text key of the sign-in query. The router parses each value of the
 * address, so a number or a boolean reads back as its text, and a repeated key,
 * which the router parses as a list, reads as absent.
 */
const AuthReturnText = Schema.optionalKey(
  QueryText.pipe(Schema.catchDecoding(() => Effect.succeedNone))
);

/**
 * The sign-in query of an address: the provider's failure, and the destination
 * that the sign-in resumes. The button renders under several routes, and a route
 * that does not declare these keys would drop them from its search, so the decoder
 * reads the parsed search of the address, which keeps every key.
 */
const AuthReturnQuery = Schema.Struct({
  error: AuthReturnText,
  redirect: AuthReturnText,
});

/** Reads the sign-in query from the parsed search of an address. A repeated key reads as absent. */
export function readAuthReturnQuery(search: unknown) {
  return Schema.decodeUnknownSync(AuthReturnQuery)(search);
}
