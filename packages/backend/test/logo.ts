import type { GenericId } from "@confect/core";
import type schema from "@repo/backend/convex/schema";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

/** Stores a file the way an upload does, and answers with its storage ID. */
export const storeFile = (convex: TestConvex<typeof schema>, file: Blob) =>
  Effect.promise(() => convex.run((ctx) => ctx.storage.store(file)));

/** The address of a stored file, as the storage answers it. */
export const storageUrl = (
  convex: TestConvex<typeof schema>,
  storageId: GenericId.GenericId<"_storage">
) => Effect.promise(() => convex.run((ctx) => ctx.storage.getUrl(storageId)));
