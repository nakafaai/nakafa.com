import { lookup } from "node:dns/promises";
import { ResearchUnsafeUrlError } from "@repo/backend/confect/nina/research/schema";
import {
  isPublicHttpUrlSyntax,
  judgeAddress,
  normalizeHostname,
} from "@repo/backend/confect/nina/research/url";
import { Array as Arr, Effect, Option } from "effect";

const unsafeUrlMessage =
  "Only public http(s) URLs can be scraped by the research agent.";

/**
 * Resolves and validates a scrape URL before any server-side fetch happens.
 * Hostname URLs keep native server fetching disabled so they cannot rebind
 * between validation and the actual fetch.
 */
export const assertPublicResearchUrl = Effect.fn(
  "research.assertPublicResearchUrl"
)(function* (value: string) {
  if (!isPublicHttpUrlSyntax(value)) {
    return yield* rejectUnsafeUrl();
  }

  const url = new URL(value);
  const hostname = normalizeHostname(url.hostname);

  // A public address literal needs no lookup. Any other host goes to DNS. A
  // literal the judge calls refused never gets here, because
  // isPublicHttpUrlSyntax has already refused it.
  if (isPublicAddress(hostname)) {
    return {
      nativeFetchUrl: url.toString(),
      publicUrl: url.toString(),
    };
  }

  const addresses = yield* Effect.tryPromise({
    try: () => lookup(hostname, { all: true, verbatim: true }),
    catch: () => ResearchUnsafeUrlError.make({ message: unsafeUrlMessage }),
  });

  if (addresses.length === 0) {
    return yield* rejectUnsafeUrl();
  }

  // Fail closed: every answer must judge as a public address. An answer the
  // address parser does not understand, such as a zone-suffixed IPv6 text, is
  // not public, so it refuses the URL.
  if (!Arr.every(addresses, (address) => isPublicAddress(address.address))) {
    return yield* rejectUnsafeUrl();
  }

  return {
    nativeFetchUrl: null,
    publicUrl: url.toString(),
  };
});

/** Fails with one public error message for every unsafe scrape target. */
function rejectUnsafeUrl() {
  return Effect.fail(
    ResearchUnsafeUrlError.make({ message: unsafeUrlMessage })
  );
}

/** True only when the judge calls the text a public address. */
function isPublicAddress(text: string) {
  return Option.exists(judgeAddress(text), (verdict) => verdict === "public");
}
