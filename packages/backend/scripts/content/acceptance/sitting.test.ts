import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SittingFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import { createAcceptanceSitting } from "@repo/backend/scripts/content/acceptance/sitting";
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

/** A runtime whose backend folder sits under the test's own temporary root. */
const runtimeIn = (root: string) =>
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));

describe("acceptance sitting", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds one sitting through the seed function and writes its exam, its sitting, and its token",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-sitting-test-",
        });
        runtimeIn(root);
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(
              spec.stdoutPath,
              '{"examId":"exam-1","sittingId":"sitting-1","token":"K7Q4XM"}'
            );
          })
        );

        yield* createAcceptanceSitting(
          root,
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/sitting.json`
        );

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "exams/seed:sitting",
        ]);
        const args = yield* Schema.decodeEffect(SeedArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args).toEqual({
          email: "learner@acceptance.example.test",
          slug: "acc-1234abcd",
        });
        const seeded = yield* fs
          .readFileString(`${root}/sitting.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SittingFixture)));
        expect(seeded).toEqual({
          examId: "exam-1",
          sittingId: "sitting-1",
          token: "K7Q4XM",
        });
        expect((yield* fs.stat(`${root}/sitting.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds no sitting when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-sitting-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceSitting(
          root,
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/sitting.json`
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
