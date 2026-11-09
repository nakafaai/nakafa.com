import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { BuildRefused } from "@repo/backend/confect/island/build";
import { IslandStale } from "@repo/backend/confect/island/schema";
import { Edit } from "@repo/backend/confect/island/world";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** The most edits one build sends (ADR 0047, D6). */
export const BUILD_BATCH = 128;

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
      name: "build",
      args: () => ({
        edits: Schema.Array(Edit).check(Schema.isMaxLength(BUILD_BATCH)),
        version: Schema.Int,
      }),
      returns: () => Schema.Struct({ version: Schema.Int }),
      error: () => Schema.Union([AuthFailure, BuildRefused, IslandStale]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
