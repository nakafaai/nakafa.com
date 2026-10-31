import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SchoolFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceSchool,
  schoolMode,
} from "@repo/backend/scripts/content/acceptance/school";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  Effect,
  Exit,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

/** The address of a school that the acceptance command opens: `acc-` and eight hex digits. */
const SCHOOL_SLUG = /^acc-[0-9a-f]{8}$/u;

const ProvisionArgs = Schema.fromJsonString(
  Schema.Struct({
    kind: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  })
);

/** A runtime whose backend folder sits under the test's own temporary root. */
const runtimeIn = (root: string) =>
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));

describe("acceptance school", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "opens one school through the provisioning function and writes its address and name",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-school-test-",
        });
        runtimeIn(root);
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(spec.stdoutPath, "null");
          })
        );

        yield* createAcceptanceSchool(root, `${root}/school.json`);

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "tenancy/provision:open",
        ]);
        const args = yield* Schema.decodeEffect(ProvisionArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args.kind).toBe("school");
        const school = yield* fs
          .readFileString(`${root}/school.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SchoolFixture)));
        expect(school).toEqual({ name: args.name, slug: args.slug });
        expect(school.slug).toMatch(SCHOOL_SLUG);
        expect((yield* fs.stat(`${root}/school.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect("opens no school when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-school-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceSchool(root, `${root}/school.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "opens a school into the file that the school mode names and ignores an extra argument",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-school-test-",
        });
        runtimeIn(root);
        mocks.command.mockImplementation((spec: CommandSpec) =>
          fs.writeFileString(spec.stdoutPath, "null")
        );

        yield* schoolMode.run(root, [`${root}/mode.json`, "ignored"]);

        expect(mocks.command).toHaveBeenCalledOnce();
        const school = yield* fs
          .readFileString(`${root}/mode.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SchoolFixture)));
        expect(school.slug).toMatch(SCHOOL_SLUG);
      }).pipe(Effect.scoped, Effect.provide(nodePlatform))
  );

  it.effect(
    "refuses the school mode without its file before any operation",
    () =>
      Effect.gen(function* () {
        expect(
          yield* schoolMode.run("/root", []).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: "Usage: acceptance school <school-file>",
        });
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.provide(nodePlatform))
  );
});
