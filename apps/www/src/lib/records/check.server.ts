import { HttpClient } from "@confect/js";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import records from "@repo/backend/confect/_generated/refs/records";
import { Effect } from "effect";
import { httpLayer } from "@/lib/convex/http";
import type { CheckInput } from "@/lib/records/check";
import { serverHandler } from "@/lib/server/fn";

/**
 * Checks a report card's hash on Convex for the public check page (ADR 0033, S5). It is a
 * framework seam: the page answers on its first request, with no session, and the check
 * is a mutation so it counts against the one rate limit of the checks. One attempt within
 * the shared deadline, as every mutation the Worker sends.
 */
export const checkReportHandler = serverHandler(
  ({ hash }: typeof CheckInput.Type) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return yield* client.mutation(records.checks.report, { hash });
    }).pipe(
      Effect.timeout(NETWORK_ATTEMPT_DEADLINE),
      Effect.provide(httpLayer()),
      Effect.orDie
    )
);
