import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { sendWelcomeEmail } from "@repo/backend/confect/modules/notifications/email.service";
import { Effect, Layer } from "effect";

const emails_mutations_sendWelcomeEmailImpl = FunctionImpl.make(
  api,
  "emails.mutations",
  "sendWelcomeEmail",
  (args) => sendWelcomeEmail(args).pipe(Effect.orDie)
);
const emailsMutationsImpl = GroupImpl.make(api, "emails.mutations").pipe(
  Layer.provide(emails_mutations_sendWelcomeEmailImpl)
);
const emailsImpl = GroupImpl.make(api, "emails").pipe(
  Layer.provide(emailsMutationsImpl)
);
export const emailsLayer = Layer.mergeAll(emailsImpl);
