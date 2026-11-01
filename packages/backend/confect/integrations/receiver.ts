import {
  judgeAddress,
  normalizeHostname,
} from "@repo/backend/confect/nina/research/url";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

/** Cloudflare's public resolver, read as JSON over HTTPS. */
const RESOLVER = "https://cloudflare-dns.com/dns-query";

/** The DNS record types of an address: A and AAAA. */
const ADDRESS_RECORDS = [1, 28];

/** What the resolver answers: the records of a name, which a name without any leaves out. */
const ResolverAnswer = Schema.Struct({
  Answer: Schema.optionalKey(
    Schema.Array(Schema.Struct({ data: Schema.String, type: Schema.Finite }))
  ),
});

/** The addresses one record type of a name resolves to. */
const addressesOf = Effect.fn("integrations.receiver.addresses")(function* (
  host: string,
  type: number
) {
  const response = yield* (yield* HttpClient.HttpClient).get(RESOLVER, {
    headers: { accept: "application/dns-json" },
    urlParams: { name: host, type },
  });
  const answer =
    yield* HttpClientResponse.schemaBodyJson(ResolverAnswer)(response);
  return Arr.map(
    Arr.filter(answer.Answer ?? [], (record) =>
      Arr.contains(ADDRESS_RECORDS, record.type)
    ),
    (record) => record.data
  );
});

/**
 * Whether a receiver stands on public addresses only, checked before each attempt. An
 * address literal is judged as it is, and a name by every address it resolves to, the same
 * judgment as the research scrape guard. Convex lets an action connect only by name, so the
 * connection can still reach another address than this answer named. The attempt reads
 * nothing of the answer but its status, so such a name learns little (ADR 0029).
 */
export const standsOnPublicAddresses = Effect.fn(
  "integrations.receiver.public"
)(function* (url: string) {
  const host = normalizeHostname(new URL(url).hostname);
  const literal = judgeAddress(host);
  if (Option.isSome(literal)) {
    return literal.value === "public";
  }
  const addresses = Arr.flatten(
    yield* Effect.forEach(ADDRESS_RECORDS, (type) => addressesOf(host, type), {
      concurrency: "unbounded",
    })
  );
  return (
    Arr.isReadonlyArrayNonEmpty(addresses) &&
    Arr.every(addresses, (address) =>
      Option.exists(judgeAddress(address), (verdict) => verdict === "public")
    )
  );
});
