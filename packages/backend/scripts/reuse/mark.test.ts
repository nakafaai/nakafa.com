import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { markModules } from "@repo/backend/scripts/reuse/mark";
import { Effect, FileSystem, Path } from "effect";

const CONFECT_SOURCE = `import registeredFunctions from "../confect/_generated/registeredFunctions/notes";

export const list = registeredFunctions.list;
`;
const REUSED_SOURCE = `${CONFECT_SOURCE}export const experimental_reuseContext = true;\n`;
const NODE_SOURCE = `"use node";\n\n${CONFECT_SOURCE}`;
const HANDWRITTEN_SOURCE = "export default {};\n";

/** Writes the named files under a fresh folder, runs the marker, and reads each file back. */
const markFiles = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs.makeTempDirectoryScoped();
    yield* fs.makeDirectory(path.join(directory, "_generated"));
    yield* Effect.forEach(Object.entries(files), ([name, source]) =>
      fs.writeFileString(path.join(directory, name), source)
    );
    yield* markModules(directory);
    return yield* Effect.forEach(Object.keys(files), (name) =>
      fs.readFileString(path.join(directory, name))
    );
  });

describe("markModules", () => {
  it.effect("adds the reuse export to a module Confect wrote", () =>
    Effect.gen(function* () {
      const [marked] = yield* markFiles({ "notes.ts": CONFECT_SOURCE });
      expect(marked).toBe(REUSED_SOURCE);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("keeps a module that already holds the export as it is", () =>
    Effect.gen(function* () {
      const [marked] = yield* markFiles({ "notes.ts": REUSED_SOURCE });
      expect(marked).toBe(REUSED_SOURCE);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "leaves Node modules, hand-written modules, and generated files alone",
    () =>
      Effect.gen(function* () {
        const sources = {
          "_generated/api.ts": CONFECT_SOURCE,
          "http.ts": HANDWRITTEN_SOURCE,
          "notes.md": CONFECT_SOURCE,
          "render.ts": NODE_SOURCE,
        };
        const marked = yield* markFiles(sources);
        expect(marked).toEqual(Object.values(sources));
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});
