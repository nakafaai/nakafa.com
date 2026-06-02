import { FileSystem, HttpClient } from "@effect/platform";
import { NodeFileSystem, NodeHttpClient } from "@effect/platform-node";
import { Effect } from "effect";

/** Native Effect Platform IO service for content file and remote text reads. */
export class ContentIO extends Effect.Service<ContentIO>()(
  "@repo/contents/ContentIO",
  {
    accessors: true,
    dependencies: [NodeFileSystem.layer, NodeHttpClient.layerUndici],
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const httpClient = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk
      );

      return {
        readFileString: (filePath: string) =>
          fileSystem.readFileString(filePath, "utf8"),
        readDirectory: fileSystem.readDirectory,
        stat: fileSystem.stat,
        fetchText: (url: string) =>
          Effect.gen(function* () {
            const response = yield* httpClient.get(url);

            return yield* response.text;
          }),
      };
    }),
  }
) {}
