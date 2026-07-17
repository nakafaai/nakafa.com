import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";

/** Native Effect Platform filesystem service for content directory scans. */
export class ContentIO extends Effect.Service<ContentIO>()(
  "@repo/contents/ContentIO",
  {
    accessors: true,
    dependencies: [NodeFileSystem.layer],
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      return {
        readDirectory: fileSystem.readDirectory,
      };
    }),
  }
) {}
