import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import {
  appendEnvironmentValues,
  EnvironmentContextError,
  environmentEntries,
  loadDeployEnvironment,
} from "#scripts/github/environment";

/** The first GITHUB_ENV entry of the deploy key, under its random delimiter. */
const DEPLOY_KEY_ENTRY = /^CONVEX_DEPLOY_KEY<<NAKAFA_ENV_[\w-]+\ndeploy-key\n/u;

describe("environmentEntries", () => {
  it("keeps every line of a multi-line value under one delimiter", () => {
    expect(
      environmentEntries({ AKSARA_AGENT_SIGNING_PUBLIC_KEY: "a\nb" }, "EOF")
    ).toEqual(["AKSARA_AGENT_SIGNING_PUBLIC_KEY<<EOF\na\nb\nEOF\n"]);
  });

  it("exports no unset value and never the automatic token", () => {
    expect(
      environmentEntries(
        {
          OPENWEATHER_API_KEY: "",
          SITE_URL: "https://nakafa.com",
          github_token: "token",
        },
        "EOF"
      )
    ).toEqual(["SITE_URL<<EOF\nhttps://nakafa.com\nEOF\n"]);
  });
});

describe("appendEnvironmentValues", () => {
  it.effect(
    "appends the secrets and the variables of the environment to GITHUB_ENV",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const file = yield* fileSystem.makeTempFileScoped();
        yield* appendEnvironmentValues(
          file,
          JSON.stringify({
            CONVEX_DEPLOY_KEY: "deploy-key",
            github_token: "token",
          }),
          JSON.stringify({ VITE_CONVEX_URL: "https://example.convex.cloud" })
        );

        const written = yield* fileSystem.readFileString(file);
        expect(written).toMatch(DEPLOY_KEY_ENTRY);
        expect(written).toContain("VITE_CONVEX_URL<<NAKAFA_ENV_");
        expect(written).not.toContain("github_token");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "refuses a context that is not a JSON object of text, and names no value",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const file = yield* fileSystem.makeTempFileScoped();
        const error = yield* Effect.flip(
          appendEnvironmentValues(
            file,
            '{"SITE_URL": 42, "TOKEN": "s3cr3t"}',
            "{}"
          )
        );

        expect(error).toBeInstanceOf(EnvironmentContextError);
        expect(error.message).toContain("secrets");
        expect(error.message).not.toContain("s3cr3t");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

describe("loadDeployEnvironment", () => {
  it.effect(
    "reads the job's context from the GitHub Actions environment and exports it",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const file = yield* fileSystem.makeTempFileScoped();
        vi.stubEnv("GITHUB_ENV", file);
        vi.stubEnv(
          "ENVIRONMENT_SECRETS",
          JSON.stringify({ SITE_URL: "https://nakafa.com" })
        );
        vi.stubEnv(
          "ENVIRONMENT_VARIABLES",
          JSON.stringify({ VITE_APP_URL: "https://nakafa.com" })
        );

        expect(yield* loadDeployEnvironment).toBe(0);
        const written = yield* fileSystem.readFileString(file);
        expect(written).toContain("SITE_URL<<NAKAFA_ENV_");
        expect(written).toContain("VITE_APP_URL<<NAKAFA_ENV_");
      }).pipe(
        Effect.scoped,
        Effect.provide(NodeServices.layer),
        Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs()))
      )
  );
});
