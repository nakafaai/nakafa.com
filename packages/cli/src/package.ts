import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Schema } from "effect";
import { CliStartupError } from "./error.js";

export const REQUIRED_PACKED_FILES = [
  "LICENSE",
  "README.md",
  "dist/main.js",
  "package.json",
];

const PackageMetadataSchema = Schema.Struct({ version: Schema.String });

/** Reads and validates the version bundled with the installed CLI package. */
export const readPackageVersion = Effect.fn("NakafaCli.readPackageVersion")(
  function* (packageUrl: URL) {
    const fileSystem = yield* FileSystem.FileSystem;
    const source = yield* fileSystem
      .readFileString(fileURLToPath(packageUrl))
      .pipe(
        Effect.mapError(
          (cause) =>
            new CliStartupError({
              cause,
              message: "Unable to read the Nakafa CLI package metadata.",
            })
        )
      );
    const metadata = yield* Schema.decodeEffect(
      Schema.fromJsonString(PackageMetadataSchema)
    )(source).pipe(
      Effect.mapError(
        (cause) =>
          new CliStartupError({
            cause,
            message: "The Nakafa CLI package metadata is invalid.",
          })
      )
    );
    return metadata.version;
  }
);

/** Keeps source, tests, and workspace-only files out of the npm tarball. */
export function isAllowedPackedFile(path: string) {
  return (
    path === "LICENSE" ||
    path === "README.md" ||
    path === "package.json" ||
    path.startsWith("dist/")
  );
}
