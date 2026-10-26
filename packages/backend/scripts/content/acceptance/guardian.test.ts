import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { GuardianFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceGuardian,
  guardianMode,
} from "@repo/backend/scripts/content/acceptance/guardian";
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

/** The arguments of the seed function, as the Convex CLI receives them. */
const SeedArgs = Schema.fromJsonString(
  Schema.Struct({
    email: Schema.String,
    nisn: Schema.String,
    slug: Schema.String,
  })
);

/** A runtime whose backend folder sits under the test's own temporary root. */
const runtimeIn = (root: string) =>
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));

describe("acceptance guardian", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds a parent's code through the seed function and writes it to the file",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-guardian-test-",
        });
        runtimeIn(root);
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(spec.stdoutPath, '{"code":"042917"}');
          })
        );

        yield* guardianMode.run(root, [
          "acc-1234abcd",
          "ibu@example.com",
          "0012345678",
          `${root}/code.json`,
        ]);

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "guardians/seed:code",
        ]);
        const args = yield* Schema.decodeEffect(SeedArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args).toEqual({
          email: "ibu@example.com",
          nisn: "0012345678",
          slug: "acc-1234abcd",
        });
        const seeded = yield* fs
          .readFileString(`${root}/code.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(GuardianFixture)));
        expect(seeded).toEqual({ code: "042917" });
        expect((yield* fs.stat(`${root}/code.json`)).mode % 0o1000).toBe(0o600);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds nothing when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-guardian-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceGuardian(
          root,
          "acc-1234abcd",
          "ibu@example.com",
          "0012345678",
          `${root}/code.json`
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses the mode without its four arguments before any operation", () =>
    Effect.gen(function* () {
      expect(
        yield* guardianMode.run("/root", ["acc-1234abcd"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message:
          "Usage: acceptance guardian <school-slug> <email> <nisn> <code-file>",
      });
      expect(mocks.read).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
