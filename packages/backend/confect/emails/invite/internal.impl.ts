import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { readInviteInput } from "@repo/backend/confect/emails/invite/input";
import { enqueueRenderedInviteProgram } from "@repo/backend/confect/emails/invite/internal";
import spec from "@repo/backend/confect/emails/invite/internal.spec";
import { Effect, Layer } from "effect";

const readInput = FunctionImpl.make(
  databaseSchema,
  spec,
  "readInput",
  Effect.fn("emails.invite.internal.readInput")(function* ({
    inviteId,
    locale,
  }) {
    return yield* readInviteInput(inviteId, locale);
  })
);
const enqueueRendered = FunctionImpl.make(
  databaseSchema,
  spec,
  "enqueueRendered",
  Effect.fn("emails.invite.internal.enqueueRendered")(function* ({
    inviteId,
    ...message
  }) {
    return yield* enqueueRenderedInviteProgram(inviteId, message);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readInput),
  Layer.provide(enqueueRendered),
  GroupImpl.finalize
);
