import { Effect, Schema } from "effect";

export interface WorkspaceArtifactPreflightLimits {
  contributionArtifactBytes: number;
  contributionArtifactLimit: number;
  workspaceArtifactBytes: number;
  workspaceArtifactLimit: number;
}

export class WorkspaceArtifactPreflightError extends Schema.TaggedError<WorkspaceArtifactPreflightError>()(
  "WorkspaceArtifactPreflightError",
  {
    message: Schema.String,
  }
) {}

/** Checks raw workspace artifact counts and bytes before deep schema decode. */
export function findWorkspaceArtifactPreflightIssue(
  input: unknown,
  limits: WorkspaceArtifactPreflightLimits
) {
  return Effect.gen(function* () {
    if (typeof input !== "object" || input === null) {
      return;
    }

    const contributions = readArrayField(input, "contributions");
    if (!contributions) {
      return;
    }

    let workspaceArtifactBytes = 0;
    let workspaceArtifactCount = 0;

    for (const contribution of contributions) {
      if (typeof contribution !== "object" || contribution === null) {
        continue;
      }

      const artifacts = readArrayField(contribution, "artifacts");
      if (!artifacts) {
        continue;
      }

      if (artifacts.length > limits.contributionArtifactLimit) {
        return "Invalid evidence workspace contract.";
      }

      let contributionArtifactBytes = 0;
      for (const artifact of artifacts) {
        const artifactBytes = yield* readJsonBytes(artifact);
        contributionArtifactBytes += artifactBytes;
        workspaceArtifactBytes += artifactBytes;
        workspaceArtifactCount += 1;
      }

      if (contributionArtifactBytes > limits.contributionArtifactBytes) {
        const capability = readStringField(contribution, "capability");
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
}

function readArrayField(value: object, field: string) {
  const fieldValue = Reflect.get(value, field);
  return Array.isArray(fieldValue) ? fieldValue : undefined;
}

function readStringField(value: object, field: string) {
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

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
