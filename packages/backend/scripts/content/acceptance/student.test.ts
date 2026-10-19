import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import {
  createAcceptanceStudent,
  studentMode,
} from "@repo/backend/scripts/content/acceptance/student";
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

describe("acceptance student", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "grants the student role through the seed function of the school and address it names",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-student-test-",
        });
        runtimeIn(root);
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(spec.stdoutPath, "null");
          })
        );

        yield* createAcceptanceStudent(
          root,
          "acc-1234abcd",
          "learner@acceptance.example.test"
        );

        const [spec] = MutableList.toArray(specs);
        expect(Arr.take(Arr.drop(spec?.args ?? [], 1), 2)).toEqual([
          "run",
          "tenancy/seed:student",
        ]);
        const args = yield* Schema.decodeEffect(SeedArgs)(
          Option.getOrThrow(Arr.last(spec?.args ?? []))
        );
        expect(args).toEqual({
          email: "learner@acceptance.example.test",
          slug: "acc-1234abcd",
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("grants nothing when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-student-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceStudent(
          root,
          "acc-1234abcd",
          "learner@acceptance.example.test"
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "grants the student the mode names, ignoring the arguments after its address",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-student-test-",
        });
        runtimeIn(root);
        const specs = MutableList.make<CommandSpec>();
        mocks.command.mockImplementation((spec: CommandSpec) =>
          Effect.gen(function* () {
            MutableList.append(specs, spec);
            yield* fs.writeFileString(spec.stdoutPath, "null");
          })
        );

        yield* studentMode.run(root, [
          "acc-1234abcd",
          "learner@acceptance.example.test",
          "ignored",
        ]);

        const [spec] = MutableList.toArray(specs);
        expect(
          yield* Schema.decodeEffect(SeedArgs)(
            Option.getOrThrow(Arr.last(spec?.args ?? []))
          )
        ).toEqual({
          email: "learner@acceptance.example.test",
          slug: "acc-1234abcd",
        });
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "refuses the student mode without its learner address before any operation",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-student-test-",
        });

        expect(
          yield* studentMode.run(root, ["acc-1234abcd"]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: "Usage: acceptance student <school-slug> <learner-address>",
        });
        expect(mocks.read).not.toHaveBeenCalled();
        expect(mocks.command).not.toHaveBeenCalled();
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
