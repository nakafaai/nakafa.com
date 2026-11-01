import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { tenantOf } from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { GOOGLE_MANIFEST } from "@repo/backend/confect/connectors/google/manifest";
import spec from "@repo/backend/confect/connectors/seed.spec";
import { Effect, Layer } from "effect";

/**
 * Stores a Classroom connection of a school that `createSchool` opened, in the state a browser
 * test asks for, so the test sees a connected school without Google. It holds no token, so a call
 * to Google through it fails as a real lost token does.
 */
const connection = FunctionImpl.make(
  databaseSchema,
  spec,
  "connection",
  Effect.fn("connectors.seed.connection")(function* ({ slug, status }) {
    yield* requireAcceptanceSeed();
    const tenant = yield* tenantOf(slug);
    yield* (yield* DatabaseWriter)
      .table("connectorConnections")
      .insert({
        connector: "classroom",
        googleAccountKey: null,
        lastSyncedAt: null,
        nextSyncAt: null,
        owner: { kind: "tenant", tenantId: tenant._id },
        scopes: GOOGLE_MANIFEST.classroom.scopes,
        status,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Implements the acceptance seed of `seed.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(connection),
  GroupImpl.finalize
);
