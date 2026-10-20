import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SittingFixture } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  createAcceptanceSitting,
  sittingMode,
} from "@repo/backend/scripts/content/acceptance/sitting";
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
    crowd: Schema.optionalKey(Schema.Finite),
    email: Schema.String,
    slug: Schema.String,
  })
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
              '{"examId":"exam-1","sittingId":"sitting-1","title":"Ujian Acceptance","token":"K7Q4XM"}'
            );
          })
        );

        yield* createAcceptanceSitting(
          root,
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/sitting.json`,
          undefined
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
          title: "Ujian Acceptance",
          token: "K7Q4XM",
        });
        expect((yield* fs.stat(`${root}/sitting.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("passes a crowd to the seed as a number", () =>
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
            '{"examId":"exam-1","sittingId":"sitting-1","title":"Ujian Acceptance","token":"K7Q4XM"}'
          );
        })
      );

      yield* createAcceptanceSitting(
        root,
        "acc-1234abcd",
        "learner@acceptance.example.test",
        `${root}/sitting.json`,
        101
      );

      const [spec] = MutableList.toArray(specs);
      const args = yield* Schema.decodeEffect(SeedArgs)(
        Option.getOrThrow(Arr.last(spec?.args ?? []))
      );
      expect(args).toEqual({
        crowd: 101,
        email: "learner@acceptance.example.test",
        slug: "acc-1234abcd",
      });
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
          `${root}/sitting.json`,
          undefined
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "seeds the sitting with the crowd that the sitting mode names, into the file it names",
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
              '{"examId":"exam-1","sittingId":"sitting-1","title":"Ujian Acceptance","token":"K7Q4XM"}'
            );
          })
        );

        yield* sittingMode.run(root, [
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/mode.json`,
          "101",
          "ignored",
        ]);

        const [spec] = MutableList.toArray(specs);
        const args = yield* Schema.decodeEffect(SeedArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args).toEqual({
          crowd: 101,
          email: "learner@acceptance.example.test",
          slug: "acc-1234abcd",
        });
        const seeded = yield* fs
          .readFileString(`${root}/mode.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SittingFixture)));
        expect(seeded.token).toBe("K7Q4XM");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "seeds the sitting without a crowd when the sitting mode names none",
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
              '{"examId":"exam-1","sittingId":"sitting-1","title":"Ujian Acceptance","token":"K7Q4XM"}'
            );
          })
        );

        yield* sittingMode.run(root, [
          "acc-1234abcd",
          "learner@acceptance.example.test",
          `${root}/mode.json`,
        ]);

        const [spec] = MutableList.toArray(specs);
        const args = yield* Schema.decodeEffect(SeedArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args).toEqual({
          email: "learner@acceptance.example.test",
          slug: "acc-1234abcd",
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "refuses the sitting mode without its sitting file before any operation",
    () =>
      Effect.gen(function* () {
        expect(
          yield* sittingMode
            .run("/root", ["acc-1234abcd", "learner@acceptance.example.test"])
            .pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message:
            "Usage: acceptance sitting <school-slug> <learner-email> <sitting-file> [crowd]",
        });
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "refuses a crowd that is not a number with the sitting usage before any operation",
    () =>
      Effect.gen(function* () {
        runtimeIn("/root");
        expect(
          yield* sittingMode
            .run("/root", [
              "acc-1234abcd",
              "learner@acceptance.example.test",
              "/root/mode.json",
              "abc",
            ])
            .pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message:
            "Usage: acceptance sitting <school-slug> <learner-email> <sitting-file> [crowd]",
        });
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});
