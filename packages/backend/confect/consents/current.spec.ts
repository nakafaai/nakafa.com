import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  ConsentPersistenceErrorWire,
  consentCategoryValidator,
  consentDecisionValidator,
  consentWriteValidator,
  currentConsentStateValidator,
} from "@repo/backend/confect/consents/schema";
import { failureWire } from "@repo/backend/confect/failure";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
/** The browser's pending decision belongs to a different signed-in account. */
export class ConsentAccountChanged extends Schema.TaggedError<ConsentAccountChanged>()(
  "ConsentAccountChanged",
  {
    code: Schema.Literal("CONSENT_ACCOUNT_CHANGED"),
    message: Schema.Literal(
      "The active account changed before consent could be saved."
    ),
  }
) {}
export const ConsentAccountChangedWire = failureWire(ConsentAccountChanged);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({
        category: consentCategoryValidator,
      }),
      returns: () => currentConsentStateValidator,
      error: () => Schema.Union([AuthFailure, ConsentPersistenceErrorWire]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({
        decision: consentWriteValidator,
        expectedUserId: IdSchema("users"),
      }),
      returns: () => consentDecisionValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          ConsentPersistenceErrorWire,
          ConsentAccountChangedWire,
        ]),
    }).middleware(Atomic)
  );
