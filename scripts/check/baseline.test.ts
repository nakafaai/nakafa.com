import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Layer,
  Path,
  PlatformError,
  Record as Rec,
  Ref,
  Sink,
  Stdio,
} from "effect";
import {
  BASELINE_FILE,
  countFindings,
  exceededMessages,
  ratchet,
  readBaseline,
  staleMessages,
  updateBaseline,
} from "#scripts/check/baseline";
import type { Finding } from "#scripts/check/effect";
import { RULES } from "#scripts/check/rules";

const FINDINGS: readonly (typeof Finding.Type)[] = [
  { file: "a.ts", line: 1, rule: "json" },
  { file: "a.ts", line: 2, rule: "console" },
  { file: "a.ts", line: 3, rule: "json" },
  { file: "a.ts", line: 4, rule: "console" },
  { file: "b.ts", line: 1, rule: "map-set" },
  { file: "c.ts", line: 7, rule: "fetch" },
];

/** Writes fixture files below one repository root. */
const writeFixtures = Effect.fn("BaselineTest.writeFixtures")(function* (
  root: string,
  files: Readonly<Record<string, string>>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(
    Rec.toEntries(files),
    ([file, content]) =>
      Effect.andThen(
        fileSystem.makeDirectory(path.dirname(path.join(root, file)), {
          recursive: true,
        }),
        fileSystem.writeFileString(path.join(root, file), content)
      ),
    { discard: true }
  );
});

/** Creates a fixture repository with one baseline text and authored files. */
const fixture = Effect.fn("BaselineTest.fixture")(function* (
  baseline: string,
  files: Readonly<Record<string, string>>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "effect-baseline-",
  });
  yield* writeFixtures(root, { ...files, [BASELINE_FILE]: baseline });
  return root;
});

/** Appends captured stream chunks to `chunks`. */
function capture(chunks: Ref.Ref<readonly (string | Uint8Array)[]>) {
  return () =>
    Sink.forEachArray((written: readonly (string | Uint8Array)[]) =>
      Ref.update(chunks, Arr.appendAll(written))
    );
}

/** Runs the baseline writer with captured standard streams. */
const update = Effect.fn("BaselineTest.update")(function* (root: string) {
  const stdout = yield* Ref.make<readonly (string | Uint8Array)[]>([]);
  const stderr = yield* Ref.make<readonly (string | Uint8Array)[]>([]);
  const status = yield* updateBaseline(root).pipe(
    Effect.provide(
      Stdio.layerTest({ stderr: capture(stderr), stdout: capture(stdout) })
    )
  );
  return {
    status,
    stderr: yield* Ref.get(stderr),
    stdout: yield* Ref.get(stdout),
  };
});

/** Fails one file system operation on `path` as permission denied. */
function denied(method: string, path: string) {
  return Effect.fail(
    PlatformError.systemError({
      _tag: "PermissionDenied",
      method,
      module: "FileSystem",
      pathOrDescriptor: path,
    })
  );
}

/** Delegates to the Node file system except where `override` replaces an operation. */
function overriding(override: Partial<FileSystem.FileSystem>) {
  return Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (fileSystem) => ({
      ...fileSystem,
      ...override,
    }))
  ).pipe(Layer.provide(NodeServices.layer));
}

const UNREADABLE = overriding({
  readFileString: (path) => denied("readFileString", path),
});
const UNWRITABLE = overriding({
  writeFileString: (path) => denied("writeFileString", path),
});

describe("Effect-native baseline", () => {
  it("counts findings per module and rule in rule order", () => {
    assert.deepStrictEqual(countFindings(FINDINGS), {
      "a.ts": { console: 2, json: 2 },
      "b.ts": { "map-set": 1 },
      "c.ts": { fetch: 1 },
    });
  });

  it("reports findings beyond the baseline and counts that must shrink", () => {
    const { exceeded, stale } = ratchet(FINDINGS, {
      "a.ts": { console: 1, json: 2 },
      "b.ts": { "map-set": 2 },
      "gone.ts": { env: 1 },
    });
    assert.deepStrictEqual(exceeded, [
      { allowed: 1, count: 2, file: "a.ts", line: 2, rule: "console" },
      { allowed: 1, count: 2, file: "a.ts", line: 4, rule: "console" },
      { allowed: 0, count: 1, file: "c.ts", line: 7, rule: "fetch" },
    ]);
    assert.deepStrictEqual(stale, [
      { allowed: 2, file: "b.ts", remaining: 1, rule: "map-set" },
      { allowed: 1, file: "gone.ts", remaining: 0, rule: "env" },
    ]);
    assert.deepStrictEqual(exceededMessages(exceeded), [
      `a.ts:2: ${RULES.console.message} (console) This module has 2 console findings and ${BASELINE_FILE} allows 1.`,
      `a.ts:4: ${RULES.console.message} (console) This module has 2 console findings and ${BASELINE_FILE} allows 1.`,
      `c.ts:7: ${RULES.fetch.message} (fetch)`,
    ]);
    assert.deepStrictEqual(staleMessages(stale), [
      `${BASELINE_FILE}: b.ts allows 2 map-set findings but 1 remain. Run pnpm check:baseline to shrink it.`,
      `${BASELINE_FILE}: gone.ts allows 1 env findings but 0 remain. Run pnpm check:baseline to shrink it.`,
    ]);
  });

  it.effect("reads a valid baseline and allows nothing without one", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const empty = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-baseline-empty-",
      });
      const root = yield* fixture(
        '{\n  "a.ts": {\n    "json": 2\n  }\n}\n',
        {}
      );
      assert.deepStrictEqual(yield* readBaseline(empty), {});
      assert.deepStrictEqual(yield* readBaseline(root), {
        "a.ts": { json: 2 },
      });
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("rejects a baseline it cannot read or decode", () =>
    Effect.gen(function* () {
      const failures = yield* Effect.forEach(
        ["not json", '{"a.ts":{"jsonn":1}}', '{"a.ts":{"json":0}}'],
        (text) =>
          Effect.flatMap(fixture(text, {}), (root) =>
            Effect.flip(readBaseline(root))
          )
      );
      const unreadable = yield* Effect.flatMap(fixture("{}", {}), (root) =>
        Effect.flip(readBaseline(root))
      ).pipe(Effect.provide(UNREADABLE));
      assert.deepStrictEqual(
        Arr.map(Arr.append(failures, unreadable), ({ _tag, message }) => [
          _tag,
          message,
        ]),
        [
          ["BaselineError", `${BASELINE_FILE} is not a valid baseline.`],
          ["BaselineError", `${BASELINE_FILE} is not a valid baseline.`],
          ["BaselineError", `${BASELINE_FILE} is not a valid baseline.`],
          ["BaselineError", `Unable to read ${BASELINE_FILE}.`],
        ]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});

describe("baseline writer", () => {
  const SOURCES = {
    "apps/web/store.ts": "export const store = new Map();\nJSON.parse(text);\n",
    "scripts/tool.ts": "export const ids = rows.map(String);\n",
  };

  it.effect("shrinks the baseline to the findings that remain", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fixture(
        '{"apps/web/gone.ts":{"console":2},"apps/web/store.ts":{"json":2,"map-set":1},"scripts/tool.ts":{"array-method":1}}',
        SOURCES
      );
      assert.deepStrictEqual(yield* update(root), {
        status: 0,
        stderr: [],
        stdout: [`${BASELINE_FILE} records 3 findings in 2 modules.\n`],
      });
      assert.strictEqual(
        yield* fileSystem.readFileString(path.join(root, BASELINE_FILE)),
        '{\n  "apps/web/store.ts": {\n    "json": 1,\n    "map-set": 1\n  },\n  "scripts/tool.ts": {\n    "array-method": 1\n  }\n}\n'
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("refuses to record a finding the baseline does not allow", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseline = '{"apps/web/store.ts":{"json":1}}';
      const root = yield* fixture(baseline, SOURCES);
      const result = yield* update(root);
      assert.deepStrictEqual(result, {
        status: 1,
        stderr: [
          `apps/web/store.ts:1: ${RULES["map-set"].message} (map-set)\nscripts/tool.ts:1: ${RULES["array-method"].message} (array-method)\nFix these findings first; the baseline never records a new one.\n`,
        ],
        stdout: [],
      });
      assert.strictEqual(
        yield* fileSystem.readFileString(path.join(root, BASELINE_FILE)),
        baseline
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("fails with a typed error when it cannot write the baseline", () =>
    Effect.gen(function* () {
      const root = yield* fixture(
        '{"apps/web/store.ts":{"json":1,"map-set":1},"scripts/tool.ts":{"array-method":1}}',
        SOURCES
      );
      const failure = yield* update(root).pipe(
        Effect.flip,
        Effect.provide(UNWRITABLE)
      );
      assert.deepStrictEqual(
        [failure._tag, failure.message],
        ["BaselineError", `Unable to write ${BASELINE_FILE}.`]
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
