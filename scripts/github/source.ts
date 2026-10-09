import { Array as Arr, Effect, FileSystem, Order, Path, Schema } from "effect";
import { parse as yamlParse } from "yaml";
import {
  collectActionUses,
  validateGithubActionPolicy,
} from "#scripts/github/policy";

const WORKFLOW_FILE_PATTERN = /\.ya?ml$/u;
/** Composite action definitions at any depth below .github/actions. */
const COMPOSITE_ACTION_PATTERN = /^actions\/(?:.+\/)?action\.ya?ml$/u;

/** Expected failure while reading or decoding repository workflow policy. */
export class GithubActionPolicyError extends Schema.TaggedError<GithubActionPolicyError>()(
  "GithubActionPolicyError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

function policyError(message: string, cause: unknown) {
  return new GithubActionPolicyError({ cause, message });
}

/** Keeps the names that match a pattern, sorted so policy problems report in a stable order. */
function matchingFiles(files: readonly string[], pattern: RegExp) {
  return Arr.sort(
    Arr.filter(files, (file) => pattern.test(file)),
    Order.String
  );
}

/** Reads the external action uses of YAML files at paths under the repository root. */
const readYamlActionUses = Effect.fnUntraced(function* (
  root: string,
  relativePaths: readonly string[]
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const uses = yield* Effect.forEach(
    relativePaths,
    Effect.fnUntraced(function* (relativePath) {
      const source = yield* fileSystem
        .readFileString(path.join(root, relativePath))
        .pipe(
          Effect.mapError((cause) =>
            policyError(`Unable to read ${relativePath}.`, cause)
          )
        );
      const document = yield* Effect.try({
        try: () => yamlParse(source),
        catch: (cause) =>
          policyError(`Unable to decode ${relativePath}.`, cause),
      });
      return collectActionUses(document, relativePath);
    })
  );

  return Arr.filter(
    Arr.flatten(uses),
    ({ reference }) => !reference.startsWith("./")
  );
});

/** Reads every external action used by first-party GitHub workflows. */
export const readWorkflowActionUses = Effect.fn(
  "RepositoryPolicy.readWorkflowActionUses"
)(function* (root: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workflowFiles = yield* fileSystem
    .readDirectory(path.join(root, ".github", "workflows"))
    .pipe(
      Effect.map((files) => matchingFiles(files, WORKFLOW_FILE_PATTERN)),
      Effect.mapError((cause) =>
        policyError("Unable to read GitHub workflow files.", cause)
      )
    );

  return yield* readYamlActionUses(
    root,
    Arr.map(workflowFiles, (fileName) =>
      path.join(".github", "workflows", fileName)
    )
  );
});

/** Reads every external action used by the composite actions under .github/actions. */
export const readCompositeActionUses = Effect.fn(
  "RepositoryPolicy.readCompositeActionUses"
)(function* (root: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const actionFiles = yield* fileSystem
    .readDirectory(path.join(root, ".github"), { recursive: true })
    .pipe(
      Effect.map((files) => matchingFiles(files, COMPOSITE_ACTION_PATTERN)),
      Effect.mapError((cause) =>
        policyError("Unable to read GitHub action files.", cause)
      )
    );

  return yield* readYamlActionUses(
    root,
    Arr.map(actionFiles, (file) => path.join(".github", file))
  );
});

/** Reads and validates the repository GitHub Action policy. */
export const inspectGithubActionPolicy = Effect.fn(
  "RepositoryPolicy.inspectGithubActions"
)((root: string) =>
  Effect.all([
    readWorkflowActionUses(root),
    readCompositeActionUses(root),
  ]).pipe(
    Effect.map(([workflowUses, compositeUses]) =>
      validateGithubActionPolicy(Arr.appendAll(workflowUses, compositeUses))
    ),
    Effect.catch((error) =>
      Effect.succeed([`Unable to inspect GitHub Actions: ${error.message}`])
    )
  )
);
