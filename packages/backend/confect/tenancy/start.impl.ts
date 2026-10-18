import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import { readAddress } from "@repo/backend/confect/tenancy/address";
import { foundSchool } from "@repo/backend/confect/tenancy/found";
import spec from "@repo/backend/confect/tenancy/start.spec";
import { Clock, Effect, Layer, Match, Option, Struct } from "effect";

/** The account's saved draft row, if it started the questionnaire. */
const draftRow = Effect.fn("tenancy.start.row")(function* () {
  const { appUser } = yield* requireAuth();
  const row = yield* (yield* DatabaseReader)
    .table("tenantDrafts")
    .index("by_userId", (query) => query.eq("userId", appUser._id))
    .first()
    .pipe(Effect.orDie);
  return { appUser, row };
});

/** The answers the account saved, or null before its first answer. */
const draft = FunctionImpl.make(
  databaseSchema,
  spec,
  "draft",
  Effect.fn("tenancy.start.draft")(function* () {
    const { row } = yield* draftRow();
    return Option.match(row, {
      onNone: () => null,
      onSome: (found) => Struct.omit(found, ["_creationTime", "_id", "userId"]),
    });
  })
);

/**
 * Saves one answer over the account's draft, so the questionnaire resumes at
 * the first question left. The name answer carries its address with it.
 */
const save = FunctionImpl.make(
  databaseSchema,
  spec,
  "save",
  Effect.fn("tenancy.start.save")(function* ({ answer }) {
    const { appUser, row } = yield* draftRow();
    const updatedAt = yield* Clock.currentTimeMillis;
    const fields = Match.value(answer).pipe(
      Match.discriminatorsExhaustive("kind")({
        country: ({ value }) => ({ country: value }),
        levels: ({ value }) => ({ levels: value }),
        name: ({ name, slug }) => ({ name, slug }),
        role: ({ value }) => ({ role: value }),
        size: ({ value }) => ({ size: value }),
      })
    );
    const writer = yield* DatabaseWriter;
    const next = Option.match(row, {
      onNone: () => ({ ...fields, updatedAt }),
      onSome: (found) => ({
        ...Struct.omit(found, ["_creationTime", "_id", "userId"]),
        ...fields,
        updatedAt,
      }),
    });
    yield* Option.match(row, {
      onNone: () =>
        writer
          .table("tenantDrafts")
          .insert({ ...next, userId: appUser._id })
          .pipe(Effect.orDie, Effect.asVoid),
      onSome: (found) =>
        writer
          .table("tenantDrafts")
          .replace(found._id, { ...next, userId: appUser._id })
          .pipe(Effect.orDie),
    });
    return next;
  })
);

/** Whether an address can name a new school, checked while the founder types. */
const address = FunctionImpl.make(
  databaseSchema,
  spec,
  "address",
  Effect.fn("tenancy.start.address")(function* ({ slug }) {
    yield* requireAuth();
    return yield* readAddress(slug);
  })
);

/** Opens the school the account founds, and names the address it opens at. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("tenancy.start.open")(function* (args) {
    const { appUser } = yield* requireAuth();
    return yield* foundSchool(appUser, args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(draft),
  Layer.provide(save),
  Layer.provide(address),
  Layer.provide(open),
  Layer.provide(session),
  GroupImpl.finalize
);
