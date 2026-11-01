import type { JournalEntriesDoc } from "@repo/backend/confect/_generated/docs";
import { guardianLinkAuthority } from "@repo/backend/confect/guardians/authority";
import type { clientRead } from "@repo/backend/confect/integrations/reads";
import { gradeAuthority } from "@repo/backend/confect/records/authority";
import {
  personAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Match } from "effect";

/** A client and its school, the principal a delivery decides for. */
type ClientRead = Effect.Success<ReturnType<typeof clientRead>>;

/**
 * Whether a client may read the subject of a journal entry now, through that kind's
 * authority. A delivery decides this for each attempt (ADR 0016), so a client that lost an
 * action or a subject that left its scope gets nothing more. A subject that is gone is
 * closed, as a kind that publishes no change is.
 */
export const readsSubject = Effect.fn("integrations.subject.reads")(function* (
  entry: Pick<JournalEntriesDoc, "subject">,
  read: ClientRead
) {
  return yield* Match.value(entry.subject).pipe(
    Match.when({ kind: "grade" }, ({ id }) =>
      gradeAuthority.allowsClientOn("grade.export", id, read)
    ),
    Match.when({ kind: "guardianLink" }, ({ id }) =>
      guardianLinkAuthority.allowsClientOn("guardian.view", id, read)
    ),
    Match.when({ kind: "person" }, ({ id }) =>
      personAuthority.allowsClientOn("person.view", id, read)
    ),
    Match.when({ kind: "unit" }, ({ id }) =>
      unitAuthority.allowsClientOn("unit.view", id, read)
    ),
    Match.orElse(() => Effect.succeed(false))
  );
});
