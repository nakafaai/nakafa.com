import { lookup } from "node:dns/promises";
import { ResearchUnsafeUrlError } from "@repo/ai/agents/research/schema";
import {
  isBlockedIpAddress,
  isIpAddress,
  isPublicHttpUrlSyntax,
  normalizeHostname,
} from "@repo/ai/agents/research/url";
import { Effect } from "effect";

const unsafeUrlMessage =
  "Only public http(s) URLs can be scraped by the research agent.";

/** Resolves and validates a scrape URL before any server-side fetch happens. */
export const assertPublicResearchUrl = Effect.fn(
  "research.assertPublicResearchUrl"
)(function* (value: string) {
  if (!isPublicHttpUrlSyntax(value)) {
    return yield* rejectUnsafeUrl();
  }

  const url = new URL(value);
  const hostname = normalizeHostname(url.hostname);

  if (isIpAddress(hostname)) {
    return url.toString();
  }

  const addresses = yield* Effect.tryPromise({
    try: () => lookup(hostname, { all: true, verbatim: true }),
    catch: () => new ResearchUnsafeUrlError({ message: unsafeUrlMessage }),
  });

  if (addresses.length === 0) {
    return yield* rejectUnsafeUrl();
  }

  if (addresses.some((address) => isBlockedIpAddress(address.address))) {
    return yield* rejectUnsafeUrl();
  }

  return url.toString();
});

/** Fails with one public error message for every unsafe scrape target. */
function rejectUnsafeUrl() {
  return Effect.fail(new ResearchUnsafeUrlError({ message: unsafeUrlMessage }));
}
