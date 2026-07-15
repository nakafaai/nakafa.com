"use client";

import { captureException } from "@repo/analytics/posthog";
import type { SidebarStatePersistenceError } from "@repo/design-system/lib/sidebar/persistence";
import { Effect } from "effect";

/** Runs sidebar persistence at a React boundary and reports typed failures. */
export function runSidebarStateProgram(
  program: Effect.Effect<void, SidebarStatePersistenceError>
) {
  Effect.runSync(
    program.pipe(
      Effect.catchTag("SidebarStatePersistenceError", (error) =>
        Effect.sync(() => {
          captureException(error.cause, {
            cookie_name: error.cookieName,
            source: "sidebar-state-persistence",
          });
        })
      )
    )
  );
}
