import { sha256Hex } from "@repo/utilities/digest";
import {
  Array as Arr,
  Effect,
  Option,
  pipe,
  Record as Rec,
  Schema,
} from "effect";
import { parseDocument } from "yaml";
import { problemWhen } from "#scripts/problem";

const WorkflowStepSchema = Schema.StructWithRest(
  Schema.Struct({
    env: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    run: Schema.optional(Schema.String),
    uses: Schema.optional(Schema.String),
    with: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

const WorkflowJobSchema = Schema.StructWithRest(
  Schema.Struct({
    environment: Schema.optional(Schema.String),
    if: Schema.optional(Schema.String),
    needs: Schema.optional(
      Schema.Union([Schema.String, Schema.Array(Schema.String)])
    ),
    outputs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    permissions: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    steps: Schema.Array(WorkflowStepSchema),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

const CliWorkflowSchema = Schema.StructWithRest(
  Schema.Struct({
    defaults: Schema.optional(Schema.Unknown),
    env: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    jobs: Schema.Record(Schema.String, WorkflowJobSchema),
    permissions: Schema.Record(Schema.String, Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

type WorkflowJob = typeof WorkflowJobSchema.Type;

const WorkflowJobJson = Schema.fromJsonString(WorkflowJobSchema);

const SETUP_NODE_ACTION =
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const UPLOAD_ACTION =
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
/** Digest of the decoded publish job after a complete OIDC boundary review. */
const TRUSTED_PUBLISH_SHA256 =
  "d988620486eb3377efba2610c9dd5edbda0146d47c49cbc7a39616bc919924b8";
/** Digest of the decoded verification job after a complete execution review. */
const TRUSTED_VERIFY_SHA256 =
  "5bd8ae7a5a7be3c859bca497b1b921efc06675325107c07abd5976586c2ff92a";
const REQUIRED_BUILD_SOURCE = [
  "pnpm test:scripts",
  "pnpm --filter @nakafa/cli typecheck",
  "pnpm --filter @nakafa/cli test:coverage",
  "pnpm --filter @nakafa/cli build",
  "npm pack ./packages/cli",
  "pnpm exec esbuild scripts/github/provenance/main.ts",
  "createRequire(import.meta.url)",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "cli-package",
  "cli-verifier",
  "provenance.mjs",
] as const;
const REQUIRED_PUBLISH_SOURCE = [
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  SETUP_NODE_ACTION,
  "cli-package",
  "EXPECTED_SHA256",
  "EXPECTED_SIZE",
  "NPM_CLI",
  "npm@12.0.2",
  "NPM_CONFIG_REGISTRY",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "expected_shasum",
  "expected_integrity",
  "npm error code E404",
  "for attempt in {1..5}",
  'npx --yes "$NPM_CLI" publish "$TARBALL"',
  "--ignore-scripts",
  "--provenance",
] as const;
const REQUIRED_VERIFY_SOURCE = [
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  SETUP_NODE_ACTION,
  "cli-package",
  "cli-verifier",
  "EXPECTED_VERIFIER_SHA256",
  "EXPECTED_VERIFIER_SIZE",
  "NPM_CONFIG_REGISTRY",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "npm/v1/attestations/",
  "audit signatures --json",
  "--include-attestations",
  'node "$VERIFIER"',
  '".github/workflows/cli-publish.yml"',
  '"refs/heads/main"',
  '"npm-production"',
  "for attempt in {1..10}",
] as const;

const FORBIDDEN_CREDENTIALS = [
  "NODE_AUTH_TOKEN",
  "NPM_TOKEN",
  "_authToken",
] as const;
const FORBIDDEN_PROVENANCE = [
  "@base64d",
  "bundle.dsseEnvelope.payload",
  "is_exact_provenance()",
] as const;
const SHELL_COMMENT = /(^|[ \t])#.*$/u;

export class CliWorkflowPolicyError extends Schema.TaggedError<CliWorkflowPolicyError>()(
  "CliWorkflowPolicyError",
  { problems: Schema.NonEmptyArray(Schema.String) }
) {}

function executableSource(run: string | undefined) {
  return pipe(
    (run ?? "").split("\n"),
    Arr.map((line) => line.replace(SHELL_COMMENT, "$1").trimEnd()),
    Arr.filter((line) => line.trim().length > 0),
    Arr.join("\n")
  );
}

function stepSource(step: WorkflowJob["steps"][number]) {
  return pipe(
    [
      executableSource(step.run),
      step.uses,
      ...Arr.flatten(Rec.toEntries(step.env ?? {})),
      ...Arr.flatten(Rec.toEntries(step.with ?? {})),
    ],
    Arr.filter((value) => value !== undefined),
    Arr.map(String),
    Arr.join("\n")
  );
}

function jobSource(job: WorkflowJob) {
  return pipe(job.steps, Arr.map(stepSource), Arr.join("\n"));
}

function hasRerunnableArtifacts(build: WorkflowJob) {
  const uploads = Arr.filter(build.steps, ({ uses }) => uses === UPLOAD_ACTION);
  return (
    uploads.length === 2 &&
    Arr.every(uploads, ({ with: inputs }) => inputs?.overwrite === true) &&
    Arr.every(["cli-package", "cli-verifier"], (name) =>
      Arr.some(uploads, ({ with: inputs }) => inputs?.name === name)
    )
  );
}

function decodeWorkflow(source: string) {
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return Option.none();
  }
  return Schema.decodeUnknownOption(CliWorkflowSchema)(document.toJS());
}

/** Reports each required source fragment a job no longer contains. */
function missingSource(
  owner: "build" | "publish" | "verify",
  source: string,
  fragments: readonly string[]
) {
  return Arr.flatMap(fragments, (fragment) =>
    problemWhen(
      !source.includes(fragment),
      `CLI ${owner} job is missing required contract: ${fragment}`
    )
  );
}

const trustedPublishProblems = Effect.fn("GithubCli.trustedPublishProblems")(
  function* (publish: WorkflowJob, source: string) {
    const commands = pipe(
      publish.steps,
      Arr.flatMap(({ run }) => (run === undefined ? [] : [run])),
      Arr.map(executableSource),
      Arr.join("\n")
    );
    const json = yield* Schema.encodeEffect(WorkflowJobJson)(publish).pipe(
      Effect.orDie
    );
    const sha256 = yield* sha256Hex(json);
    return Arr.flatten([
      problemWhen(
        commands.split('npx --yes "$NPM_CLI" publish "$TARBALL"').length !== 2,
        "CLI publication may execute only one npm publish command."
      ),
      problemWhen(
        sha256 !== TRUSTED_PUBLISH_SHA256,
        "CLI publication must match the exact trusted job."
      ),
      problemWhen(
        source.includes("cli-verifier") ||
          source.includes("provenance.mjs") ||
          source.includes("VERIFIER"),
        "CLI publication must not receive the verifier artifact."
      ),
      problemWhen(
        Arr.some(
          publish.steps,
          ({ uses }) => uses?.startsWith("actions/checkout@") === true
        ),
        "CLI publication must not checkout repository code."
      ),
    ]);
  }
);

const trustedVerifyProblems = Effect.fn("GithubCli.trustedVerifyProblems")(
  function* (verify: WorkflowJob) {
    const json = yield* Schema.encodeEffect(WorkflowJobJson)(verify).pipe(
      Effect.orDie
    );
    const sha256 = yield* sha256Hex(json);
    return sha256 === TRUSTED_VERIFY_SHA256
      ? []
      : ["CLI verification must match the exact trusted job."];
  }
);

/** Reports a publication or verification job that leaves the repository runtime. */
function runtimeProblems(
  owner: "publication" | "verification",
  job: WorkflowJob
) {
  const setup = Option.getOrUndefined(
    Arr.findFirst(job.steps, ({ uses }) => uses === SETUP_NODE_ACTION)
  );
  return Arr.appendAll(
    problemWhen(
      setup?.with?.["node-version"] !== "24.21.0",
      `CLI ${owner} must use the repository Node runtime.`
    ),
    problemWhen(
      setup?.with?.["package-manager-cache"] !== false,
      `CLI ${owner} must disable package-manager caching.`
    )
  );
}

/** Keeps OIDC publication isolated from build and transported verification. */
function executionBoundaryProblems(
  jobs: (typeof CliWorkflowSchema.Type)["jobs"],
  publish: WorkflowJob,
  verify: WorkflowJob
) {
  const publishNeeds = publish.needs;
  const consumesBuild =
    publishNeeds === "build" ||
    (Arr.isArray(publishNeeds) && Arr.contains(publishNeeds, "build"));
  const verifyNeeds = Arr.isArray(verify.needs)
    ? verify.needs
    : Arr.filter([verify.needs], (need) => need !== undefined);
  return Arr.flatten([
    problemWhen(
      publish.permissions?.["id-token"] !== "write",
      "Only the publish job must receive npm OIDC identity."
    ),
    problemWhen(
      publish.environment !== "npm-production",
      "CLI publication must use the protected npm-production environment."
    ),
    problemWhen(
      verify.environment !== undefined,
      "CLI verification must not use a protected environment."
    ),
    problemWhen(
      Rec.keys(verify.permissions ?? {}).length > 0,
      "CLI verification permissions must remain empty."
    ),
    Arr.flatMap(Rec.toEntries(jobs), ([name, job]) =>
      problemWhen(
        name !== "publish" && job.permissions?.["id-token"] !== undefined,
        `${name} must not receive npm OIDC identity.`
      )
    ),
    problemWhen(
      !consumesBuild,
      "CLI publication must consume the verified build job."
    ),
    problemWhen(
      verifyNeeds.length !== 2 ||
        !Arr.contains(verifyNeeds, "build") ||
        !Arr.contains(verifyNeeds, "publish"),
      "CLI verification must consume build and publication."
    ),
    runtimeProblems("publication", publish),
    runtimeProblems("verification", verify),
  ]);
}

/** Reports forbidden credentials and unauthenticated provenance parsing in the workflow text. */
function forbiddenSourceProblems(source: string) {
  return Arr.appendAll(
    Arr.flatMap(FORBIDDEN_CREDENTIALS, (snippet) =>
      problemWhen(
        source.includes(snippet),
        `CLI workflow contains forbidden credential: ${snippet}`
      )
    ),
    Arr.flatMap(FORBIDDEN_PROVENANCE, (snippet) =>
      problemWhen(
        source.includes(snippet),
        `CLI workflow contains unauthenticated provenance parsing: ${snippet}`
      )
    )
  );
}

const BUILD_OUTPUTS = [
  "archive",
  "sha256",
  "size",
  "verifier_sha256",
  "verifier_size",
];

export const validateCliWorkflow = Effect.fn("GithubCli.validate")(function* (
  source: string
) {
  const sourceProblems = forbiddenSourceProblems(source);
  const decoded = decodeWorkflow(source);
  if (Option.isNone(decoded)) {
    return Arr.append(
      sourceProblems,
      "CLI workflow must contain a valid jobs mapping."
    );
  }

  const { defaults, env, jobs, permissions } = decoded.value;
  const rootProblems = Arr.flatten([
    sourceProblems,
    problemWhen(
      Rec.keys(permissions).length > 0,
      "CLI workflow root permissions must remain empty."
    ),
    problemWhen(
      defaults !== undefined,
      "CLI workflow must not inherit root run defaults."
    ),
    problemWhen(
      env !== undefined,
      "CLI workflow must not inherit root environment values."
    ),
  ]);
  const { build, publish, verify } = jobs;
  if (!(build && publish && verify)) {
    return Arr.append(
      rootProblems,
      "CLI workflow requires separate build, publish, and verify jobs."
    );
  }

  const publishSource = jobSource(publish);
  const verifyCommands = pipe(
    verify.steps,
    Arr.flatMap(({ run }) => (run === undefined ? [] : [run])),
    Arr.map(executableSource),
    Arr.join("\n")
  );
  return Arr.flatten([
    rootProblems,
    problemWhen(
      build.if !==
        "github.ref == 'refs/heads/main' && github.repository == 'nakafaai/nakafa.com'",
      "CLI build must target protected Nakafa main."
    ),
    Arr.flatMap(BUILD_OUTPUTS, (name) =>
      problemWhen(
        build.outputs?.[name] !== `\${{ steps.archive.outputs.${name} }}`,
        `CLI build must export exact output: ${name}`
      )
    ),
    missingSource("build", jobSource(build), REQUIRED_BUILD_SOURCE),
    missingSource("publish", publishSource, REQUIRED_PUBLISH_SOURCE),
    missingSource("verify", jobSource(verify), REQUIRED_VERIFY_SOURCE),
    problemWhen(
      !hasRerunnableArtifacts(build),
      "CLI build artifacts must be replaceable on rerun."
    ),
    executionBoundaryProblems(jobs, publish, verify),
    yield* trustedPublishProblems(publish, publishSource),
    problemWhen(
      verifyCommands.split('node "$VERIFIER"').length !== 2,
      "CLI verification must execute one transported verifier."
    ),
    yield* trustedVerifyProblems(verify),
  ]);
});

export const verifyCliWorkflow = Effect.fn("GithubCli.verify")(function* (
  source: string
) {
  const problems = yield* validateCliWorkflow(source);
  const [first, ...rest] = problems;
  if (first) {
    return yield* new CliWorkflowPolicyError({
      problems: [first, ...rest],
    });
  }
});
