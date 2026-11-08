import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/runtime/active.spec";
import { readSnapshotDates } from "@repo/backend/confect/contentRelease/snapshot/dates";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readRoutedPublicArtifact } from "@repo/backend/content/publication/public";
import {
  readActiveFrame,
  readActiveIdentity,
} from "@repo/backend/content/publication/read";
import { Effect, Layer } from "effect";

/** Returns the exact active release identity after full integrity validation. */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("contentRelease.runtime.active.read")(function* () {
    return yield* readActiveIdentity().pipe(Effect.provide(publicationLayer));
  })
);

/** Returns the signed release document and renderer manifest of the active release. */
const frame = FunctionImpl.make(
  databaseSchema,
  spec,
  "frame",
  Effect.fn("contentRelease.runtime.active.frame")(function* () {
    return yield* readActiveFrame().pipe(Effect.provide(publicationLayer));
  })
);

/** Returns one routed public body's signed artifact while the route's active head names its hash. */
const artifact = FunctionImpl.make(
  databaseSchema,
  spec,
  "artifact",
  Effect.fn("contentRelease.runtime.active.artifact")(function* (args) {
    return yield* readRoutedPublicArtifact(
      args.family,
      args.appLocale,
      args.publicPath,
      args.artifactHash
    ).pipe(Effect.provide(publicationLayer));
  })
);

/** Returns the day each snapshot family of the active release last changed. */
const dates = FunctionImpl.make(
  databaseSchema,
  spec,
  "dates",
  Effect.fn("contentRelease.runtime.active.dates")(function* () {
    return yield* readSnapshotDates();
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(read),
  Layer.provide(frame),
  Layer.provide(artifact),
  Layer.provide(dates),
  GroupImpl.finalize
);
