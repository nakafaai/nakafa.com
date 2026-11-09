import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import {
  BuildRefused,
  Cell,
  Operation,
} from "@repo/backend/confect/island/build";
import {
  FarmRefused,
  IslandStale,
  SnapshotRefused,
  Visibility,
} from "@repo/backend/confect/island/schema";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => ({ timeZone: Schema.TimeZoneNamedFromString }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "share",
      args: () => ({ visibility: Visibility }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({
        operations: Schema.Array(Operation).check(Schema.isMaxLength(64)),
        version: Schema.Int,
      }),
      returns: () => Schema.Struct({ version: Schema.Int }),
      error: () => Schema.Union([AuthFailure, BuildRefused, IslandStale]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "water",
      args: () => ({ version: Schema.Int }),
      returns: () => Schema.Struct({ version: Schema.Int }),
      error: () => Schema.Union([AuthFailure, FarmRefused, IslandStale]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "harvest",
      args: () => ({ at: Cell, version: Schema.Int }),
      returns: () => Schema.Struct({ version: Schema.Int }),
      error: () => Schema.Union([AuthFailure, FarmRefused, IslandStale]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reserveSnapshot",
      args: () => ({ byteSize: Schema.Int.check(Schema.isGreaterThan(0)) }),
      returns: () =>
        Schema.Struct({ address: Schema.String, fileId: Id("bucketFiles") }),
      error: () => Schema.Union([AuthFailure, SnapshotRefused, StorageFull]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "keepSnapshot",
      args: () => ({ fileId: Id("bucketFiles") }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, SnapshotRefused]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
