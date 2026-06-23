import { findRawArtifactArrayIssue } from "@repo/math/schema/artifact/safety";
import { Effect, Schema } from "effect";

/** Schema-owned raw artifact budget limits enforced before workspace decode. */
export const WorkspaceArtifactPreflightLimits = Schema.Struct({
  artifactBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  contributionLimit: Schema.Number.pipe(Schema.int(), Schema.positive()),
  contributionArtifactBytes: Schema.Number.pipe(
    Schema.int(),
    Schema.positive()
  ),
  contributionArtifactLimit: Schema.Number.pipe(
    Schema.int(),
    Schema.positive()
  ),
  workspaceArtifactBytes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  workspaceArtifactLimit: Schema.Number.pipe(Schema.int(), Schema.positive()),
});

export type WorkspaceArtifactPreflightLimits = Schema.Schema.Type<
  typeof WorkspaceArtifactPreflightLimits
>;

export class WorkspaceArtifactPreflightError extends Schema.TaggedError<WorkspaceArtifactPreflightError>()(
  "WorkspaceArtifactPreflightError",
  {
    message: Schema.String,
  }
) {}

/**
 * Checks raw workspace artifact counts and bytes before deep schema decode.
 */
export const findWorkspaceArtifactPreflightIssue = Effect.fn(
  "nina.workspace.findWorkspaceArtifactPreflightIssue"
)(function* (input: unknown, limits: WorkspaceArtifactPreflightLimits) {
  if (typeof input !== "object" || input === null) {
    return;
  }

  const contributions = yield* readArrayField(input, "contributions");
  if (!contributions) {
    return;
  }

  const contributionCount = yield* readArrayLength(contributions);
  if (contributionCount > limits.contributionLimit) {
    return "Invalid evidence workspace contract.";
  }

  let workspaceArtifactBytes = 0;
  let workspaceArtifactCount = 0;

  for (let index = 0; index < contributionCount; index += 1) {
    const contribution = yield* readArrayItem(contributions, index);
    if (typeof contribution !== "object" || contribution === null) {
      continue;
    }

    const artifacts = yield* readArrayField(contribution, "artifacts");
    if (!artifacts) {
      continue;
    }

    const artifactCount = yield* readArrayLength(artifacts);
    if (artifactCount > limits.contributionArtifactLimit) {
      return "Invalid evidence workspace contract.";
    }

    let contributionArtifactBytes = 0;
    for (
      let artifactIndex = 0;
      artifactIndex < artifactCount;
      artifactIndex += 1
    ) {
      const artifact = yield* readArrayItem(artifacts, artifactIndex);
      const artifactArrayIssue = yield* findRawArtifactArrayIssue(
        artifact
      ).pipe(
        Effect.mapError(
          () =>
            new WorkspaceArtifactPreflightError({
              message: "Invalid evidence workspace contract.",
            })
        )
      );
      if (artifactArrayIssue) {
        return artifactArrayIssue;
      }

      const artifactBytes = yield* readJsonBytes(artifact);
      if (artifactBytes > limits.artifactBytes) {
        return `Evidence workspace artifact exceeds ${limits.artifactBytes} bytes.`;
      }

      contributionArtifactBytes += artifactBytes;
      workspaceArtifactBytes += artifactBytes;
      workspaceArtifactCount += 1;
    }

    if (contributionArtifactBytes > limits.contributionArtifactBytes) {
      const capability = yield* readStringField(contribution, "capability");
      return capability
        ? `Contribution ${capability} artifact payload exceeds ${limits.contributionArtifactBytes} bytes.`
        : `Contribution artifact payload exceeds ${limits.contributionArtifactBytes} bytes.`;
    }

    if (workspaceArtifactCount > limits.workspaceArtifactLimit) {
      return `Evidence workspace artifact count exceeds ${limits.workspaceArtifactLimit}.`;
    }

    if (workspaceArtifactBytes > limits.workspaceArtifactBytes) {
      return `Evidence workspace artifact payload exceeds ${limits.workspaceArtifactBytes} bytes.`;
    }
  }
});

/**
 * Reads one array slot by checked length instead of trusting custom iterators.
 */
function readArrayItem(value: readonly unknown[], index: number) {
  return readFieldValue(value, `${index}`);
}

/**
 * Snapshots checked array length before producer-controlled slot reads can mutate it.
 */
function readArrayLength(value: readonly unknown[]) {
  return readFieldValue(value, "length").pipe(
    Effect.flatMap((length) =>
      typeof length === "number" && Number.isSafeInteger(length) && length >= 0
        ? Effect.succeed(length)
        : Effect.fail(
            new WorkspaceArtifactPreflightError({
              message: "Invalid evidence workspace contract.",
            })
          )
    )
  );
}

/**
 * Reads an array property without trusting producer-controlled prototypes.
 */
function readArrayField(value: object, field: string) {
  return readFieldValue(value, field).pipe(
    Effect.map((fieldValue) =>
      Array.isArray(fieldValue) ? fieldValue : undefined
    )
  );
}

/**
 * Reads optional capability labels for user-facing preflight diagnostics.
 */
function readStringField(value: object, field: string) {
  return readFieldValue(value, field).pipe(
    Effect.map((fieldValue) =>
      typeof fieldValue === "string" ? fieldValue : undefined
    )
  );
}

/**
 * Accesses producer-controlled raw properties in the typed preflight channel.
 */
function readFieldValue(value: object, field: string) {
  return Effect.try({
    catch: () =>
      new WorkspaceArtifactPreflightError({
        message: "Invalid evidence workspace contract.",
      }),
    try: () => Reflect.get(value, field),
  });
}

/**
 * Serializes one raw artifact to bytes as a typed preflight Effect.
 */
function readJsonBytes(value: unknown) {
  return Effect.try({
    catch: () =>
      new WorkspaceArtifactPreflightError({
        message: "Invalid evidence workspace contract.",
      }),
    try: () => JSON.stringify(value),
  }).pipe(
    Effect.map((json) =>
      json === undefined ? 0 : new TextEncoder().encode(json).byteLength
    )
  );
}
