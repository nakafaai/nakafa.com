import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { api } from "@repo/backend/convex/_generated/api";
import { describe, expect, it } from "@repo/testing/effect";
import { getFunctionName } from "convex/server";
import { Effect, FileSystem, Path } from "effect";
import packageJson from "@/package.json";
import { config, staticBuildRoutes } from "@/vercel";

/** Finds every Page or Layout that contributes static params to Next build. */
const findStaticBuildRoutes = Effect.fn("www.vercel.findStaticBuildRoutes")(
  function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const modulePath = yield* path.fromFileUrl(new URL(import.meta.url));
    const moduleRoot = path.dirname(modulePath);
    const appRoot = path.resolve(moduleRoot, "app");
    const entries = yield* fileSystem.readDirectory(appRoot, {
      recursive: true,
    });
    const routes = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function* () {
        const fileName = path.basename(entry);
        if (!(fileName === "layout.tsx" || fileName === "page.tsx")) {
          return;
        }
        const sourcePath = path.resolve(appRoot, entry);
        const source = yield* fileSystem.readFileString(sourcePath);
        if (!source.includes("function generateStaticParams")) {
          return;
        }
        return path.relative(moduleRoot, sourcePath);
      })
    );

    return routes
      .flatMap((source) => (source === undefined ? [] : [source]))
      .sort();
  }
);

/** Reads the installed Convex deploy implementation through typed IO. */
const readConvexDeploySource = Effect.fn("www.vercel.readConvexDeploySource")(
  function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const serverModule = yield* path.fromFileUrl(
      new URL(import.meta.resolve("convex/server"))
    );
    const packageRoot = path.resolve(path.dirname(serverModule), "../../..");

    return yield* fileSystem.readFileString(
      path.resolve(packageRoot, "src/cli/lib/deploy2.ts")
    );
  }
);

describe("www Vercel configuration", () => {
  it("builds only affected production commits", () => {
    expect(config.ignoreCommand).toBe(
      'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages www --exit-code || exit 1'
    );
    expect(config.git?.deploymentEnabled).toEqual({
      "**": false,
      "changeset-release/main": false,
      main: true,
    });
  });

  it("expands Convex before any production route build can use successors", () => {
    const buildCommand = config.buildCommand ?? "";
    const deploymentCommand = packageJson.scripts["build:vercel"];
    const backendTypecheck = "pnpm --dir ../../packages/backend typecheck";
    const convexDeploy = "pnpm --dir ../../packages/backend exec convex deploy";
    const webBuild = "pnpm --dir ../../apps/www build";
    const stages = deploymentCommand.split(" && ");
    const firstDeploy = deploymentCommand.indexOf(convexDeploy);
    const secondDeploy = deploymentCommand.indexOf(
      convexDeploy,
      firstDeploy + convexDeploy.length
    );
    const webBuildIndex = deploymentCommand.indexOf(webBuild);

    expect(buildCommand).toBe("pnpm run build:vercel");
    expect(buildCommand.length).toBeLessThanOrEqual(256);
    expect(deploymentCommand).toContain("--yes");
    expect(deploymentCommand).toContain("--typecheck disable");
    expect(deploymentCommand).toContain("--typecheck-components");
    expect(deploymentCommand).toContain(
      'NEXT_PUBLIC_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL"'
    );
    expect(deploymentCommand).toContain(
      "--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL"
    );
    expect(deploymentCommand.indexOf(backendTypecheck)).toBe(0);
    expect(stages).toHaveLength(3);
    expect(stages[0]).toBe(backendTypecheck);
    expect(stages[1]).toContain(convexDeploy);
    expect(stages[2]).toContain(convexDeploy);
    expect(deploymentCommand).not.toContain(";");
    expect(deploymentCommand).not.toContain("--preview");
    expect(firstDeploy).toBeGreaterThan(
      deploymentCommand.indexOf(backendTypecheck)
    );
    expect(secondDeploy).toBeGreaterThan(firstDeploy);
    expect(webBuildIndex).toBeGreaterThan(secondDeploy);
    expect(deploymentCommand.slice(firstDeploy, secondDeploy)).not.toContain(
      "--cmd"
    );
    expect(deploymentCommand.slice(secondDeploy, webBuildIndex)).toContain(
      "--cmd"
    );
    expect(deploymentCommand.indexOf(convexDeploy, secondDeploy + 1)).toBe(-1);
  });

  it.effect("proves the installed Convex command runs before its push", () =>
    Effect.gen(function* () {
      const source = yield* readConvexDeploySource();
      const commandIndex = source.indexOf("await runCommand(ctx");
      const pushIndex = source.indexOf("await runPush(ctx");

      expect(commandIndex).toBeGreaterThan(-1);
      expect(pushIndex).toBeGreaterThan(commandIndex);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("inventories every production static-param route", () =>
    Effect.gen(function* () {
      const sources = staticBuildRoutes.map(({ source }) => source).sort();
      const contracts = new Set(
        staticBuildRoutes.flatMap((route) => route.contracts)
      );
      const requiredBridgeContracts = [
        getFunctionName(api.contentRelease.article.publications),
        getFunctionName(api.contentRelease.article.route),
        getFunctionName(api.contentRelease.material.publications),
        getFunctionName(api.contentRelease.material.publication),
        PUBLIC_CONTENT_RUNTIME_PATH,
      ];

      expect(yield* findStaticBuildRoutes()).toEqual(sources);
      expect(PUBLIC_CONTENT_RUNTIME_BATCH_PATH).toBe(
        `${PUBLIC_CONTENT_RUNTIME_PATH}/batch`
      );
      for (const contract of requiredBridgeContracts) {
        expect(contracts).toContain(contract);
      }
      expect(staticBuildRoutes).toContainEqual(
        expect.objectContaining({
          contracts: expect.arrayContaining([
            "contentRelease/article:route",
            "/internal/content/runtime/v2",
          ]),
          source:
            "app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/page.tsx",
        })
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
