import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { isReservedSchoolSlug } from "@repo/backend/confect/schools/slug";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Option } from "effect";

/** Reserve a route-safe slug within the school creation transaction. */
export const generateUniqueSlug = Effect.fn("schools.allocateSlug")(function* (
  ctx: MutationCtx,
  baseSlug: string
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  let counter = 0;
  while (true) {
    const slug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    counter += 1;
    if (isReservedSchoolSlug(slug)) {
      continue;
    }
    const existing = yield* database
      .table("schools")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(existing)) {
      return slug;
    }
  }
});
