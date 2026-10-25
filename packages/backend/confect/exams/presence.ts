import { Id } from "@repo/backend/confect/_generated/id";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { MascotCode } from "@repo/mascot/code";
import { Duration, Schema } from "effect";

/**
 * How often an open editor tells the server it is still in the exam. A session that sends
 * nothing for 2.5 intervals is closed by the presence component (`heartbeat` in its
 * `component/public.ts`). An editor leaves at once when it closes or its tab is hidden, so
 * the interval only times how long a lost connection still shows its teacher. ADR 0028
 * (Bounds) records the measured cost that sets it.
 */
export const PRESENCE_INTERVAL = Duration.seconds(30);

/** The most other editors that one read of an exam's room lists. */
export const EDITOR_LIMIT = 25;

/** Most characters in a presence session id or token. A v4 UUID from `randomUuid` has 36. */
const MAX_TOKEN_LENGTH = 64;

/**
 * The id of one open editor, which the browser makes with `randomUuid` when the editor
 * opens. Each tab is its own session, and a teacher in two tabs is one editor.
 */
export const PresenceSession = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(MAX_TOKEN_LENGTH)
);

/**
 * The secret that closes one session, which the server returns when the session joins. Only
 * the editor that joined holds it, so leaving needs no other proof.
 */
export const PresenceToken = Schema.String.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(MAX_TOKEN_LENGTH)
);

/**
 * One other teacher in the exam's editor, as the header shows them: their name in the
 * school, their animal, and their photo while the account shows it.
 */
export const ExamEditor = Schema.Struct({
  id: Id("tenantPeople"),
  image: Schema.optionalKey(Schema.String),
  mascot: MascotCode,
  name: PersonName,
});
