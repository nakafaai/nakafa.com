import { createHmac } from "node:crypto";
import { tmpdir } from "node:os";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { createAcceptanceLearner } from "@repo/backend/scripts/content/acceptance/learner";
import { Effect, FileSystem, Schema } from "effect";

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

interface CommandSpec {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly sensitiveValues: readonly string[];
  readonly stdoutPath: string;
}

const CommandInput = Schema.fromJsonString(
  Schema.Struct({
    doc: Schema.optional(Schema.Struct({ _id: Schema.String })),
    input: Schema.optional(
      Schema.Struct({
        data: Schema.Struct({
          email: Schema.optional(Schema.String),
          token: Schema.optional(Schema.String),
          userId: Schema.optional(Schema.String),
        }),
        model: Schema.String,
      })
    ),
  })
);
const LEARNER_EMAIL = /^learner-[0-9a-f]{16}@acceptance\.invalid$/u;
const Cookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);

/** Answers each Convex command the way the local backend does. */
function answerCommands(createdUser = '{"_creationTime":1,"_id":"user-1"}') {
  const specs: CommandSpec[] = [];
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      specs.push(spec);
      const fs = yield* FileSystem.FileSystem;
      const output = spec.args.includes("auth/lifecycle:onCreate")
        ? "null"
        : createdUser;
      yield* fs.writeFileString(spec.stdoutPath, output);
    })
  );
  return specs;
}

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "acceptance-learner-test-",
  });
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  return { fs, root };
});

const readInput = (spec: CommandSpec | undefined) =>
  Schema.decodeEffect(CommandInput)(spec?.args.at(-1) ?? "");

describe("synthetic acceptance learner", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "signs a new learner in with a cookie only this runtime accepts",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands();

        yield* createAcceptanceLearner(root, `${root}/first.json`);
        yield* createAcceptanceLearner(root, `${root}/second.json`);

        expect(specs.map((spec) => spec.args.slice(1, -1))).toEqual([
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "auth/lifecycle:onCreate"],
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "auth/lifecycle:onCreate"],
          ["run", "--component", "betterAuth", "adapter:create"],
        ]);
        for (const spec of specs) {
          expect(spec.args[0]).toBe("node_modules/convex/bin/main.js");
          expect(spec.cwd).toBe(`${root}/backend`);
          expect(spec.env.TMPDIR).toEqual(expect.any(String));
          expect(spec.env.CONVEX_DEPLOY_KEY).toBeUndefined();
        }
        const [account, profile, session, other] = yield* Effect.forEach(
          [specs[0], specs[1], specs[2], specs[3]],
          readInput
        );
        expect(account?.input?.model).toBe("user");
        expect(account?.input?.data.email).toMatch(LEARNER_EMAIL);
        expect(other?.input?.data.email).not.toBe(account?.input?.data.email);
        expect(profile?.doc?._id).toBe("user-1");
        expect(session?.input?.model).toBe("session");
        expect(session?.input?.data.userId).toBe("user-1");
        const token = session?.input?.data.token ?? "";
        expect(token).toHaveLength(43);
        expect(specs[2]?.sensitiveValues).toEqual([token]);

        const cookie = yield* fs
          .readFileString(`${root}/first.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(Cookie)));
        const signature = createHmac("sha256", LOCAL_AUTH_SECRET)
          .update(token)
          .digest("base64");
        expect(cookie).toEqual({
          name: "better-auth.session_token",
          value: encodeURIComponent(`${token}.${signature}`),
        });
        expect((yield* fs.stat(`${root}/first.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("requires a prepared and running local runtime", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);

      const error = yield* createAcceptanceLearner(
        "/missing",
        "/missing/cookie.json"
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("acceptance:prepare"),
      });
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("stops before any session when the account was not created", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const specs = answerCommands("Uncaught ConvexError");

      const error = yield* createAcceptanceLearner(
        root,
        `${root}/cookie.json`
      ).pipe(Effect.flip);

      expect(error._tag).toBe("SchemaError");
      expect(specs).toHaveLength(1);
      expect(yield* fs.exists(`${root}/cookie.json`)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
