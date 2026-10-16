import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { createAcceptanceLearner } from "@repo/backend/scripts/content/acceptance/learner";
import { makeSignature } from "better-auth/crypto";
import {
  Array as Arr,
  Effect,
  FileSystem,
  MutableList,
  Option,
  Schema,
} from "effect";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock("better-auth/crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("better-auth/crypto")>();
  return { ...original, makeSignature: vi.fn(original.makeSignature) };
});
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
  const specs = MutableList.make<CommandSpec>();
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      MutableList.append(specs, spec);
      const fs = yield* FileSystem.FileSystem;
      const output = Arr.contains(spec.args, "auth/lifecycle:onCreate")
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
    prefix: "acceptance-learner-test-",
  });
  mocks.read.mockReturnValue(Effect.succeed({ backend: `${root}/backend` }));
  return { fs, root };
});

const readInput = (spec: CommandSpec) =>
  Schema.decodeEffect(CommandInput)(Option.getOrThrow(Arr.last(spec.args)));

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

        const calls = MutableList.toArray(specs);
        expect(
          Arr.map(calls, (spec) => Arr.dropRight(Arr.drop(spec.args, 1), 1))
        ).toEqual([
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "auth/lifecycle:onCreate"],
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "--component", "betterAuth", "adapter:create"],
          ["run", "auth/lifecycle:onCreate"],
        ]);
        for (const spec of calls) {
          expect(spec.args[0]).toBe("node_modules/convex/bin/main.js");
          expect(spec.cwd).toBe(`${root}/backend`);
          expect(spec.env?.TMPDIR).toEqual(expect.any(String));
          expect(spec.env?.CONVEX_DEPLOY_KEY).toBeUndefined();
        }
        const [account, session, profile, other] = yield* Effect.forEach(
          Arr.take(calls, 4),
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
        expect(calls[1]?.sensitiveValues).toEqual([token]);

        const cookie = yield* fs
          .readFileString(`${root}/first.json`)
          .pipe(Effect.flatMap(Schema.decodeEffect(Cookie)));
        // Node's Buffer encodes the HMAC bytes, so no Effect code vouches for itself.
        const signature = Buffer.from(
          yield* Effect.promise(() =>
            crypto.subtle
              .importKey(
                "raw",
                new TextEncoder().encode(LOCAL_AUTH_SECRET),
                { hash: "SHA-256", name: "HMAC" },
                false,
                ["sign"]
              )
              .then((key) =>
                crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token))
              )
          )
        ).toString("base64");
        expect(cookie).toEqual({
          name: "better-auth.session_token",
          value: encodeURIComponent(`${token}.${signature}`),
        });
        expect((yield* fs.stat(`${root}/first.json`)).mode % 0o1000).toBe(
          0o600
        );
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("writes no cookie when the session cannot be signed", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      answerCommands();
      vi.mocked(makeSignature).mockRejectedValueOnce(
        new Error("Web Crypto is unavailable")
      );

      const error = yield* createAcceptanceLearner(
        root,
        `${root}/cookie.json`
      ).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The session cookie could not be signed.",
      });
      expect(yield* fs.exists(`${root}/cookie.json`)).toBe(false);
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

  it.live(
    "creates the learner again after the local backend timed out, and only then",
    () =>
      Effect.gen(function* () {
        const { fs, root } = yield* fixture;
        const specs = answerCommands();
        mocks.command.mockImplementationOnce((spec: CommandSpec) =>
          Effect.andThen(
            Effect.sync(() => MutableList.append(specs, spec)),
            acceptanceRuntimeError(
              'Learner account failed: ✖ Failed to run function "adapter:create": Error: [Request ID: 1] Server Error Function execution timed out (maximum duration: 1s)'
            )
          )
        );

        yield* createAcceptanceLearner(root, `${root}/cookie.json`);

        expect(MutableList.toArray(specs)).toHaveLength(4);
        expect(yield* fs.exists(`${root}/cookie.json`)).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.effect("does not create the learner again after any other failure", () =>
    Effect.gen(function* () {
      const { fs, root } = yield* fixture;
      const specs = MutableList.make<CommandSpec>();
      mocks.command.mockImplementation((spec: CommandSpec) =>
        Effect.andThen(
          Effect.sync(() => MutableList.append(specs, spec)),
          acceptanceRuntimeError(
            'Learner account failed: ✖ Failed to run function "adapter:create": Uncaught ConvexError: invalid'
          )
        )
      );

      const error = yield* createAcceptanceLearner(
        root,
        `${root}/cookie.json`
      ).pipe(Effect.flip);

      expect(error._tag).toBe("AcceptanceRuntimeError");
      expect(MutableList.toArray(specs)).toHaveLength(1);
      expect(yield* fs.exists(`${root}/cookie.json`)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );
});
