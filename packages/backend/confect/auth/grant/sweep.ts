import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { GRANT_LIFETIME } from "@repo/backend/confect/auth/grant/token";
import { Clock, Duration, Effect, Option } from "effect";

/** How often the sweep runs, which bounds how long a spent code or an ended grant lingers. */
export const AGENT_SWEEP_INTERVAL = Duration.hours(1);

/** The most rows of each kind one sweep deletes, well inside one transaction. */
const SWEEP_LIMIT = 100;

/** How long a registered agent may stay without any grant before it goes. */
const IDLE_CLIENT_LIFETIME = Duration.days(30);

/**
 * Deletes what an agent left behind: codes past their lifetime, grants unused
 * for `GRANT_LIFETIME`, and registrations that no grant holds after
 * `IDLE_CLIENT_LIFETIME`. Each kind takes at most one page per run, and the
 * hourly schedule takes the rest. A failed read or write is a defect, which
 * the next run takes again.
 */
export const sweepAgents = Effect.fn("auth.grant.sweep")(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const codes = yield* reader
    .table("agentCodes")
    .index("by_expiresAt", (query) => query.lt("expiresAt", now))
    .take(SWEEP_LIMIT);
  yield* Effect.forEach(
    codes,
    (code) => writer.table("agentCodes").delete(code._id),
    { discard: true }
  );
  const grants = yield* reader
    .table("agentGrants")
    .index("by_refreshedAt", (query) =>
      query.lt("refreshedAt", now - Duration.toMillis(GRANT_LIFETIME))
    )
    .take(SWEEP_LIMIT);
  yield* Effect.forEach(
    grants,
    (grant) =>
      writer.table("agentGrants").delete(grant._id),
    { discard: true }
  );
  const clients = yield* reader
    .table("agentClients")
    .index("by_creation_time", (query) =>
      query.lt("_creationTime", now - Duration.toMillis(IDLE_CLIENT_LIFETIME))
    )
    .take(SWEEP_LIMIT);
  yield* Effect.forEach(
    clients,
    (client) =>
      Effect.gen(function* () {
        const held = yield* reader
          .table("agentGrants")
          .index("by_clientId", (query) => query.eq("clientId", client._id))
          .first();
        if (Option.isNone(held)) {
          yield* writer
            .table("agentClients")
            .delete(client._id);
        }
      }),
    { discard: true }
  );
  return null;
}, Effect.orDie);
