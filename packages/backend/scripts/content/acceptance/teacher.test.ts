import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import {
  classTeacherAddress,
  createAcceptanceClassTeacher,
  createAcceptanceTeacher,
  teacherAddress,
} from "@repo/backend/scripts/content/acceptance/teacher";
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

const SLUG = "acc-1a2b3c4d";
const SeedArguments = Schema.fromJsonString(
  Schema.Struct({
    email: Schema.String,
    locale: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  })
);
const ClassSeedArguments = Schema.fromJsonString(
  Schema.Struct({
    email: Schema.String,
    locale: Schema.String,
    name: Schema.String,
    slug: Schema.String,
    subject: Schema.String,
  })
);
const CreatedAccount = Schema.fromJsonString(
  Schema.Struct({
    input: Schema.Struct({
      data: Schema.Struct({ email: Schema.optional(Schema.String) }),
    }),
  })
);

/** The text one Convex command prints, as the local backend answers it. */
function answerOf(args: readonly string[], users: string) {
  if (Arr.contains(args, "data")) {
    return users;
  }
  if (
    Arr.contains(args, "auth/lifecycle:onCreate") ||
    Arr.contains(args, "tenancy/claims:run") ||
    Arr.contains(args, "tenancy/seed:teacher") ||
    Arr.contains(args, "classroom/seed:teacher")
  ) {
    return "null";
  }
  return '{"_creationTime":1,"_id":"user-1"}';
}

/** Answers every command and keeps the commands in the order they ran. */
function answerCommands(users: string) {
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(spec.stdoutPath, answerOf(spec.args, users));
    })
  );
  return specs;
}

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-teacher-test-",
  });
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  return { fs, root };
});

/** The JSON argument that the command takes last. */
const lastArgument = (spec: CommandSpec) =>
  Option.getOrThrow(Arr.last(spec.args));

describe("acceptance teacher", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "seeds the Teacher of the school, then signs the account of the address in as a member",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands(
          '[{"_id":"app-user-0","authId":"someone-else"},{"_id":"app-user-1","authId":"user-1"}]'
        );

        yield* createAcceptanceTeacher(root, SLUG, `${root}/teacher.json`);

        const calls = MutableList.toArray(specs);
        const seedCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "tenancy/seed:teacher")
          )
        );
        expect(
          yield* Schema.decodeEffect(SeedArguments)(lastArgument(seedCall))
        ).toEqual({
          email: teacherAddress(SLUG),
          locale: "id",
          name: "Acceptance Teacher",
          slug: SLUG,
        });
        const accountCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "adapter:create")
          )
        );
        const account = yield* Schema.decodeEffect(CreatedAccount)(
          lastArgument(accountCall)
        );
        expect(account.input.data.email).toBe(teacherAddress(SLUG));
        const cookie = yield* fs
          .readFileString(`${root}/teacher.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds no Teacher when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-teacher-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceTeacher(root, SLUG, `${root}/teacher.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "seeds a Teacher of a class with the classroom seed, then signs the account of the address in",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands(
          '[{"_id":"app-user-0","authId":"someone-else"},{"_id":"app-user-1","authId":"user-1"}]'
        );

        yield* createAcceptanceClassTeacher(
          root,
          SLUG,
          `${root}/class-teacher.json`
        );

        const calls = MutableList.toArray(specs);
        const seedCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "classroom/seed:teacher")
          )
        );
        expect(
          yield* Schema.decodeEffect(ClassSeedArguments)(lastArgument(seedCall))
        ).toEqual({
          email: classTeacherAddress(SLUG),
          locale: "id",
          name: "Acceptance Class Teacher",
          slug: SLUG,
          subject: "Fisika",
        });
        const accountCall = Option.getOrThrow(
          Arr.findFirst(calls, (spec) =>
            Arr.contains(spec.args, "adapter:create")
          )
        );
        const account = yield* Schema.decodeEffect(CreatedAccount)(
          lastArgument(accountCall)
        );
        expect(account.input.data.email).toBe(classTeacherAddress(SLUG));
        const cookie = yield* fs
          .readFileString(`${root}/class-teacher.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(SessionCookie)));
        expect(cookie.name).toBe("better-auth.session_token");
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("seeds no class Teacher when no local runtime is running", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "acceptance-teacher-test-",
      });
      mocks.read.mockReturnValue(Effect.void);

      const exit = yield* Effect.exit(
        createAcceptanceClassTeacher(root, SLUG, `${root}/class-teacher.json`)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
