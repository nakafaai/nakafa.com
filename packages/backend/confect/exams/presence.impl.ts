import { FunctionImpl, GroupImpl } from "@confect/server";
import { Presence } from "@convex-dev/presence";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { Exam } from "@repo/backend/confect/exams/access";
import { examAccess } from "@repo/backend/confect/exams/authority";
import {
  EDITOR_LIMIT,
  PRESENCE_INTERVAL,
} from "@repo/backend/confect/exams/presence";
import spec from "@repo/backend/confect/exams/presence.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Array as Arr, Duration, Effect, Layer, Option, pipe } from "effect";

/** The presence component, whose rooms are exams and whose users are the school's Persons. */
const presence = new Presence(components.presence);

/**
 * One editor of the room as the header shows them, or none when the Person is no longer an
 * active member with an account: their session may still be open until it times out, but the
 * school no longer counts them. Only `join` writes a room's users, and it writes Person IDs,
 * so a user that names no Person is a defect.
 */
const editorOf = Effect.fn("exams.presence.editor")(function* (userId: string) {
  const ctx = yield* QueryCtx;
  const reader = yield* DatabaseReader;
  const personId = yield* Effect.fromNullishOr(
    ctx.db.normalizeId("tenantPeople", userId)
  ).pipe(Effect.orDie);
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  if (person.status !== "active" || person.account.state !== "claimed") {
    return Option.none();
  }
  const user = yield* reader
    .table("users")
    .get(person.account.userId)
    .pipe(Effect.orDie);
  const photo = photoOf(user);
  return Option.some({
    id: person._id,
    mascot: user.mascot,
    name: person.name,
    ...(photo === undefined ? {} : { image: photo }),
  });
});

/**
 * Joins the caller's session to the exam's room, or keeps it there: the component creates the
 * session or moves its deadline, and marks the Person online. The answer is the token that
 * closes the session.
 */
const join = FunctionImpl.make(
  databaseSchema,
  spec,
  "join",
  Effect.fn("exams.presence.join")(function* ({ session: sessionId }) {
    const exam = yield* Exam;
    const { person } = yield* Member;
    const ctx = yield* MutationCtx;
    const tokens = yield* Effect.tryPromise(() =>
      presence.heartbeat(
        ctx,
        exam._id,
        person._id,
        sessionId,
        Duration.toMillis(PRESENCE_INTERVAL)
      )
    ).pipe(Effect.orDie);
    return { token: tokens.sessionToken };
  })
);

/**
 * The other editors in the exam's room, in the order they first joined it. The caller is left
 * out, in every tab, and so is a Person the school no longer counts (`editorOf`). One read
 * holds at most `EDITOR_LIMIT` of them. A heartbeat writes only its session, so the list runs
 * again only when a teacher joins or leaves.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("exams.presence.list")(function* () {
    const exam = yield* Exam;
    const { person } = yield* Member;
    const ctx = yield* QueryCtx;
    const online = yield* Effect.tryPromise(() =>
      presence.listRoom(ctx, exam._id, true, EDITOR_LIMIT + 1)
    ).pipe(Effect.orDie);
    const others = pipe(
      online,
      Arr.filter((row) => row.userId !== person._id),
      Arr.take(EDITOR_LIMIT)
    );
    const editors = yield* Effect.forEach(others, (row) =>
      editorOf(row.userId)
    );
    return Arr.getSomes(editors);
  })
);

/** Closes the session that the token names. A token that names no session closes nothing. */
const leave = FunctionImpl.make(
  databaseSchema,
  spec,
  "leave",
  Effect.fn("exams.presence.leave")(function* ({ token }) {
    const ctx = yield* MutationCtx;
    yield* Effect.tryPromise(() => presence.disconnect(ctx, token)).pipe(
      Effect.orDie
    );
    return null;
  })
);

/** Implements the presence group of `presence.spec.ts`: joining an exam's room, listing it, and leaving it. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(join),
  Layer.provide(list),
  Layer.provide(leave),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
