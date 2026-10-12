import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import {
  inspectDeploySource,
  inspectIgnoreSource,
} from "#scripts/check/deploy";
import { parseSources } from "#scripts/check/source";

const CONFIG = "apps/www/vercel.ts";
const REPORT = `${CONFIG}: set git.deploymentEnabled of the exported config to { "**": false, main: true }, so only the main branch deploys and Vercel creates no Preview deployment.`;

/** Inspects one module with the deployment policy alone. */
function inspect(sourceText: string, file = CONFIG) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectDeploySource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

/** Writes a Vercel configuration whose `git` property has the given text. */
function configWith(git: string) {
  return `import type { VercelConfig } from "@vercel/config/v1";
const region = "iad1";
export const config: VercelConfig = {
  regions: [region],
  ...shared,
  ${git}
};
`;
}

describe("Vercel deployment policy", () => {
  it.effect("accepts a configuration in which only main deploys", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          configWith('git: { deploymentEnabled: { "**": false, main: true } },')
        ),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          configWith(
            '"git": { deploymentEnabled: { main: true, "**": false } },'
          )
        ),
        []
      );
    })
  );

  it.effect("reports a configuration that lets another branch deploy", () =>
    Effect.gen(function* () {
      for (const git of [
        "",
        "git: {},",
        "git: settings,",
        "git: { deploymentEnabled: true },",
        'git: { deploymentEnabled: { "**": true, main: true } },',
        'git: { deploymentEnabled: { "**": false, main: false } },',
        'git: { deploymentEnabled: { "**": false } },',
        "git: { deploymentEnabled: { main: true, staging: true } },",
        'git: { deploymentEnabled: { "**": false, main: true, staging: true } },',
        'git: { deploymentEnabled: { ...policy, "**": false, main: true } },',
      ]) {
        assert.deepStrictEqual(yield* inspect(configWith(git)), [REPORT], git);
      }
    })
  );

  it.effect("reports a module without a config object", () =>
    Effect.gen(function* () {
      for (const sourceText of [
        "export const settings = {};\n",
        "export const config = createConfig();\n",
        "export let config;\n",
        "const [config] = [{}];\nexport function build() {}\n",
      ]) {
        assert.deepStrictEqual(
          yield* inspect(sourceText),
          [REPORT],
          sourceText
        );
      }
    })
  );

  it.effect("judges only the Vercel configuration of an app", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect("export const config = {};\n", "apps/www/lib/vercel.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          "export const config = {};\n",
          "packages/backend/vercel.ts"
        ),
        []
      );
    })
  );
});

/** Inspects one module with the Ignored Build Step policy alone. */
function inspectIgnore(sourceText: string, file = CONFIG) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectIgnoreSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

/** Writes a Vercel configuration whose `ignoreCommand` property has the given text. */
function configIgnoring(ignoreCommand: string) {
  return `export const config = {
  buildCommand: "pnpm build",
  ${ignoreCommand}
};
`;
}

const WWW_COMMAND =
  'node "$(git rev-parse --show-toplevel)/scripts/vercel/ignore.mjs" www';

describe("Vercel Ignored Build Step", () => {
  it.effect("accepts the command of the project that the file configures", () =>
    Effect.gen(function* () {
      for (const project of ["www", "api", "mcp", "cas"]) {
        const command = WWW_COMMAND.replace("www", project);
        assert.deepStrictEqual(
          yield* inspectIgnore(
            configIgnoring(`ignoreCommand: '${command}',`),
            `apps/${project}/vercel.ts`
          ),
          [],
          project
        );
      }
      assert.deepStrictEqual(
        yield* inspectIgnore(
          configIgnoring(`"ignoreCommand": '${WWW_COMMAND}',`)
        ),
        []
      );
    })
  );

  it.effect("reports a configuration that does not name its own command", () =>
    Effect.gen(function* () {
      const report = `${CONFIG}: set ignoreCommand of the exported config to '${WWW_COMMAND}', so Vercel skips a build that nothing the project is built from changed.`;
      for (const ignoreCommand of [
        "",
        "ignoreCommand: null,",
        'ignoreCommand: "npx turbo-ignore",',
        'ignoreCommand: "node " + script,',
        "ignoreCommand: command,",
        `ignoreCommand: '${WWW_COMMAND.replace("www", "api")}',`,
        `ignoreCommand: '${WWW_COMMAND} --force',`,
      ]) {
        assert.deepStrictEqual(
          yield* inspectIgnore(configIgnoring(ignoreCommand)),
          [report],
          ignoreCommand
        );
      }
    })
  );

  it.effect("reports a module without a config object", () =>
    Effect.gen(function* () {
      assert.strictEqual(
        (yield* inspectIgnore("export const settings = {};\n")).length,
        1
      );
    })
  );

  it.effect("judges only the Vercel configuration of an app", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspectIgnore(
          "export const config = {};\n",
          "apps/www/lib/vercel.ts"
        ),
        []
      );
      assert.deepStrictEqual(
        yield* inspectIgnore(
          "export const config = {};\n",
          "packages/backend/vercel.ts"
        ),
        []
      );
    })
  );
});
