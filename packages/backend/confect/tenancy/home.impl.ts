import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tenancy/home.spec";
import { readSetup } from "@repo/backend/confect/tenancy/setup";
import { Effect, Layer } from "effect";

/** The school's setup for its home, which the setup tile subscribes to live after its first screen. */
const setup = FunctionImpl.make(
  databaseSchema,
  spec,
  "setup",
  Effect.fn("tenancy.home.setup")(function* () {
    const { tenant } = yield* Member;
    return yield* readSetup(tenant._id);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setup),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
