import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/tenancy/expiry.spec";
import {
  expireDueInvites,
  expireInvite,
} from "@repo/backend/confect/tenancy/invite";
import { Effect, Layer } from "effect";

/** Expires a still-pending invite and records it under its Person; any other invite is left as it is. */
const invite = FunctionImpl.make(
  databaseSchema,
  spec,
  "invite",
  Effect.fn("tenancy.expiry.invite")(function* ({ inviteId }) {
    const reader = yield* DatabaseReader;
    const stored = yield* reader
      .table("tenantInvites")
      .get(inviteId)
      .pipe(Effect.orDie);
    const person = yield* reader
      .table("tenantPeople")
      .get(stored.personId)
      .pipe(Effect.orDie);
    yield* expireInvite(stored, person);
    return null;
  })
);

/** The hourly backstop: expires every due invite whose own run never happened. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("tenancy.expiry.sweep")(function* () {
    yield* expireDueInvites();
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(invite),
  Layer.provide(sweep),
  GroupImpl.finalize
);
