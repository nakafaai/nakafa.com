import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { GraduationFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceGraduation,
  graduationMode,
} from "@repo/backend/scripts/content/acceptance/graduation";
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
  Schema.Struct({ email: Schema.String, slug: Schema.String })
);

/** What the seed function prints: the seeded class group. */
const SEEDED = '{"cohort":"12-Lulus","cohortId":"cohort-1"}';

/** A runtime whose backend folder sits under the test's own temporary root, and a command that records its call. */
const runtimeIn = (root: string, fs: FileSystem.FileSystem) => {
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      yield* fs.writeFileString(spec.stdoutPath, SEEDED);
    })
  );
  return specs;
};

describe("acceptance graduation", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds the graduation that the mode names through the seed function and writes the class group",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-graduation-test-",
        });
        const specs = runtimeIn(root, fs);

        yield* graduationMode.run(root, [
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/graduation.json`,
        ]);

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "records/seed:graduation",
        ]);
        expect(
          yield* Schema.decodeEffect(SeedArgs)(
            Option.getOrThrow(Arr.last(spec?.args ?? []))
          )
        ).toEqual({
          email: "learner@acceptance.example.test",
          slug: "acc-1234abcd",
        });
        expect(
          yield* fs
            .readFileString(`${root}/graduation.json`)
            .pipe(Effect.flatMap(Schema.decodeEffect(GraduationFixture)))
        ).toEqual({ cohort: "12-Lulus", cohortId: "cohort-1" });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds no graduation when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-graduation-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceGraduation(
          root,
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/graduation.json`
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
