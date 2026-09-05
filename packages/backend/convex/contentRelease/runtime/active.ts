import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  activeIdentityValidator,
  readActiveIdentity,
} from "@repo/backend/content/publication/read";
import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/** Returns the exact active release identity after full integrity validation. */
export const read = query({
  args: {},
  returns: activeIdentityValidator,
  handler: (ctx) =>
    runConvexProgram(
      readActiveIdentity().pipe(Effect.provide(convexPublicationLayer(ctx)))
    ),
});
