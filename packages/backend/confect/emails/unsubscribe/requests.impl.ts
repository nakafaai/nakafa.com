import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { applyUnsubscribe } from "@repo/backend/confect/emails/unsubscribe/apply";
import spec from "@repo/backend/confect/emails/unsubscribe/requests.spec";
import { readToken } from "@repo/backend/confect/emails/unsubscribe/token";
import { Effect, Layer } from "effect";

/** Reads the recipient the token names and stops the email Nakafa sends them on its own (`applyUnsubscribe`). */
const confirm = FunctionImpl.make(
  databaseSchema,
  spec,
  "confirm",
  Effect.fn("emails.unsubscribe.confirm")(function* ({ token }) {
    yield* applyUnsubscribe(yield* readToken(token));
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(confirm),
  GroupImpl.finalize
);
