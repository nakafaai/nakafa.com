import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Path, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import ts from "typescript";
import {
  CONVEX_CONSUMERS,
  type ConvexConsumer,
  type ProductionDeployment,
  readProductionDeployments,
} from "./deployments.ts";
import {
  ensureGitRevision,
  listGitRevisionFiles,
  readGitRevisionFile,
} from "./history.ts";
import {
  type ConvexApiReference,
  collectConvexApiReferences,
  findMissingConvexApiReferences,
} from "./source.ts";

const CONVEX_API_MODULE = "@repo/backend/convex/_generated/api";
const TYPESCRIPT_SOURCE = /\.(?:ts|tsx)$/u;
const TEST_SOURCE = /\.(?:test|spec)\.(?:ts|tsx)$/u;
const EXCLUDED_PACKAGE_PATHS = [
  "packages/backend/convex/",
  "packages/backend/scripts/",
  "packages/backend/test/",
] as const;

interface DeployedConvexApiReference extends ConvexApiReference {
  readonly consumer: ConvexConsumer;
  readonly revision: string;
}

/** Expected failure while resolving the generated Convex API type. */
export class ConvexRolloutTypeError extends Schema.TaggedError<ConvexRolloutTypeError>()(
  "ConvexRolloutTypeError",
  { message: Schema.String }
) {}

/** A deployed API reference is absent from the proposed backend. */
export class ConvexRolloutMismatch extends Schema.TaggedError<ConvexRolloutMismatch>()(
  "ConvexRolloutMismatch",
  { message: Schema.String }
) {}

function isConsumerSource(sourcePath: string) {
  return (
    TYPESCRIPT_SOURCE.test(sourcePath) &&
    !TEST_SOURCE.test(sourcePath) &&
    !EXCLUDED_PACKAGE_PATHS.some((prefix) => sourcePath.startsWith(prefix))
  );
}

const readDeploymentReferences = Effect.fn(
  "ConvexRollout.readDeploymentReferences"
)(function* (repositoryRoot: string, deployment: ProductionDeployment) {
  yield* ensureGitRevision(repositoryRoot, deployment.revision);
  const sourcePaths = yield* listGitRevisionFiles(
    repositoryRoot,
    deployment.revision,
    CONVEX_API_MODULE,
    [`apps/${deployment.consumer}`, "packages"]
  );

  const references = yield* Effect.forEach(
    sourcePaths.filter(isConsumerSource),
    (sourcePath) =>
      readGitRevisionFile(repositoryRoot, deployment.revision, sourcePath).pipe(
        Effect.flatMap((source) =>
          collectConvexApiReferences(sourcePath, source)
        )
      ),
    { concurrency: 8 }
  );

  return references.flat().map(
    (reference): DeployedConvexApiReference => ({
      ...reference,
      consumer: deployment.consumer,
      revision: deployment.revision,
    })
  );
});

const readCurrentApi = Effect.fn("ConvexRollout.readCurrentApi")(function* (
  repositoryRoot: string
) {
  const path = yield* Path.Path;
  const backendRoot = path.join(repositoryRoot, "packages", "backend");
  const configPath = path.join(backendRoot, "tsconfig.json");
  const apiPath = path.join(backendRoot, "convex", "_generated", "api.d.ts");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    return yield* new ConvexRolloutTypeError({
      message: ts.flattenDiagnosticMessageText(
        configFile.error.messageText,
        "\n"
      ),
    });
  }
  const config = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    backendRoot
  );
  if (config.errors.length > 0) {
    return yield* new ConvexRolloutTypeError({
      message: ts.flattenDiagnosticMessageText(
        config.errors[0]?.messageText ?? "Invalid TypeScript configuration.",
        "\n"
      ),
    });
  }
  const program = yield* Effect.try({
    try: () =>
      ts.createProgram({ options: config.options, rootNames: [apiPath] }),
    catch: (cause) =>
      new ConvexRolloutTypeError({
        message:
          cause instanceof Error
            ? cause.message
            : "Unable to create the generated API program.",
      }),
  });
  const sourceFile = program.getSourceFile(apiPath);
  if (!sourceFile) {
    return yield* new ConvexRolloutTypeError({
      message: "The generated Convex API declaration is missing.",
    });
  }
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const apiSymbol = moduleSymbol
    ? checker
        .getExportsOfModule(moduleSymbol)
        .find((symbol) => symbol.name === "api")
    : undefined;
  if (!apiSymbol) {
    return yield* new ConvexRolloutTypeError({
      message: "The generated Convex API export is missing.",
    });
  }
  const apiType = checker.getTypeOfSymbolAtLocation(apiSymbol, sourceFile);

  return (segments: readonly string[]) => {
    let currentType = apiType;
    for (const segment of segments) {
      const property = currentType.getProperty(segment);
      if (!property) {
        return false;
      }
      currentType = checker.getTypeOfSymbolAtLocation(property, sourceFile);
    }
    return ["_type", "_visibility", "_args", "_returnType"].every((property) =>
      currentType.getProperty(property)
    );
  };
});

/** Blocks removal of a Convex function used by any live production consumer. */
export const inspectConvexRollout = Effect.fn("ConvexRollout.inspect")(
  function* (
    repositoryRoot: string,
    deployments: readonly ProductionDeployment[]
  ) {
    const [references, hasReference] = yield* Effect.all(
      [
        Effect.forEach(
          deployments,
          (deployment) => readDeploymentReferences(repositoryRoot, deployment),
          { concurrency: 3 }
        ).pipe(Effect.map((groups) => groups.flat())),
        readCurrentApi(repositoryRoot),
      ],
      { concurrency: 2 }
    );
    const missing = findMissingConvexApiReferences(references, hasReference);
    if (missing.length > 0) {
      const details = missing
        .map(
          ({ consumer, path, revision, sourcePath }) =>
            `${consumer} ${revision}: api.${path.join(".")} in ${sourcePath}`
        )
        .sort()
        .join("\n");
      return yield* new ConvexRolloutMismatch({
        message: `The proposed backend does not preserve live Convex function references:\n${details}\nAdd the successor first, switch every consumer in a later release, then remove the predecessor after production promotion.`,
      });
    }

    yield* Effect.log(
      `Convex rollout preserves ${references.length} rollout baseline API references.`
    );
    return references;
  }
);

export function localDeployments(revision: string) {
  return CONVEX_CONSUMERS.map(
    (consumer): ProductionDeployment => ({ consumer, revision })
  );
}

if (import.meta.main) {
  const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
  const revision = process.argv[2];
  NodeRuntime.runMain(
    Effect.gen(function* () {
      const live =
        revision === "--production"
          ? yield* readProductionDeployments()
          : localDeployments(revision ?? "origin/main");
      return yield* inspectConvexRollout(repositoryRoot, live);
    }).pipe(
      Effect.provide(Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer))
    )
  );
}
