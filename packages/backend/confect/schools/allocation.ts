import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { isReservedSchoolSlug } from "@repo/backend/confect/schools/slug";
import { Effect, Option } from "effect";

/** Reserve a route-safe slug within the school creation transaction. */
export const generateUniqueSlug = Effect.fn("schools.allocateSlug")(function* (
  baseSlug: string
) {
  const database = yield* DatabaseReader;
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
