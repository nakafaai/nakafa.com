import { ResearchUnsafeUrlError } from "@repo/backend/confect/nina/research/schema";
import {
  isPublicHttpUrlSyntax,
  judgeAddress,
  normalizeHostname,
} from "@repo/backend/confect/nina/research/url";
import { Effect, Option } from "effect";

const unsafeUrlMessage =
  "Only public http(s) URLs can be scraped by the research agent.";

/**
 * Validates a scrape URL before any fetch happens, and names the one native
 * fetch it may get. A public address literal keeps its native fetch, which is
 * the only fetch Nakafa makes itself. A host name gets none and is never looked
 * up in DNS: Firecrawl's servers fetch it, so a DNS answer would protect no
 * Nakafa network.
 */
export const assertPublicResearchUrl = Effect.fn(
  "research.assertPublicResearchUrl"
)(function* (value: string) {
  if (!isPublicHttpUrlSyntax(value)) {
    return yield* rejectUnsafeUrl();
  }

  const url = new URL(value);
  const hostname = normalizeHostname(url.hostname);

  return {
    nativeFetchUrl: isPublicAddress(hostname) ? url.toString() : null,
    publicUrl: url.toString(),
  };
});

/** Fails with one public error message for every unsafe scrape target. */
function rejectUnsafeUrl() {
  return Effect.fail(new ResearchUnsafeUrlError({ message: unsafeUrlMessage }));
}

/** True only when the judge calls the text a public address. */
function isPublicAddress(text: string) {
  return Option.exists(judgeAddress(text), (verdict) => verdict === "public");
}
