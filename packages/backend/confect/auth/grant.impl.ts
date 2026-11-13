import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  listAgents,
  revokeAgent,
} from "@repo/backend/confect/auth/grant/agents";
import {
  authorizeAgent,
  describeAgent,
} from "@repo/backend/confect/auth/grant/authorize";
import {
  exchangeCode,
  refreshGrant,
} from "@repo/backend/confect/auth/grant/exchange";
import { registerAgent } from "@repo/backend/confect/auth/grant/register";
import { sweepAgents } from "@repo/backend/confect/auth/grant/sweep";
import spec from "@repo/backend/confect/auth/grant.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(FunctionImpl.make(schema, spec, "register", registerAgent)),
  Layer.provide(
    FunctionImpl.make(
      schema,
      spec,
      "describe",
      Effect.fn("auth.grant.describeQuery")(function* ({ clientId }) {
        return yield* describeAgent(clientId);
      })
    )
  ),
  Layer.provide(FunctionImpl.make(schema, spec, "authorize", authorizeAgent)),
  Layer.provide(FunctionImpl.make(schema, spec, "exchange", exchangeCode)),
  Layer.provide(FunctionImpl.make(schema, spec, "refresh", refreshGrant)),
  Layer.provide(FunctionImpl.make(schema, spec, "list", listAgents)),
  Layer.provide(FunctionImpl.make(schema, spec, "revoke", revokeAgent)),
  Layer.provide(FunctionImpl.make(schema, spec, "sweep", sweepAgents)),
  Layer.provide(session),
  GroupImpl.finalize
);
