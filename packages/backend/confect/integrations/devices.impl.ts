import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { Integration } from "@repo/backend/confect/integrations/access";
import { integrationAccess } from "@repo/backend/confect/integrations/authority";
import {
  authorizeDevice,
  denyDevice,
  pollDevice,
  startDevice,
  sweepDevices,
} from "@repo/backend/confect/integrations/device";
import spec from "@repo/backend/confect/integrations/devices.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Effect, Layer } from "effect";

/** Authorizes a pending device for the client, as the school's Admin. */
const authorize = FunctionImpl.make(
  databaseSchema,
  spec,
  "authorize",
  Effect.fn("integrations.devices.authorize")(function* ({ userCode }) {
    const { person } = yield* Member;
    yield* authorizeDevice(personActor(person), yield* Integration, userCode);
    return {};
  })
);

/** Denies a pending device of the school, as its Admin. */
const deny = FunctionImpl.make(
  databaseSchema,
  spec,
  "deny",
  Effect.fn("integrations.devices.deny")(function* ({ userCode }) {
    const { tenant } = yield* Member;
    yield* denyDevice(tenant._id, userCode);
    return {};
  })
);

/** The device grant: start, poll, and sweep for the routes and the cron, authorize and deny for the Admin. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "start", ({ slug }) =>
      startDevice(slug)
    )
  ),
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "poll", ({ deviceCode }) =>
      pollDevice(deviceCode)
    )
  ),
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "sweep", () => sweepDevices())
  ),
  Layer.provide(authorize),
  Layer.provide(deny),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(integrationAccess),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
