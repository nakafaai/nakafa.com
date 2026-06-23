import {
  ArtifactSafetyReadError,
  findRawArtifactSizeIssue,
  MAX_COORDINATE_ARTIFACT_BYTES,
} from "@repo/math/schema/artifact/safety";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("artifact raw safety preflight", () => {
  it("bounds raw serialized artifact bytes before schema traversal", async () => {
    await expectRawSizeIssue(
      { oversized: "x".repeat(MAX_COORDINATE_ARTIFACT_BYTES + 1) },
      `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("maps unserializable raw artifacts into the typed preflight failure", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    const exit = await Effect.runPromiseExit(findRawArtifactSizeIssue(cyclic));
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(ArtifactSafetyReadError);
    if (failure instanceof ArtifactSafetyReadError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects raw values that cannot produce JSON", async () => {
    const exit = await Effect.runPromiseExit(
      findRawArtifactSizeIssue(undefined)
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(ArtifactSafetyReadError);
    if (failure instanceof ArtifactSafetyReadError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });
});

async function expectRawSizeIssue(input: unknown, message: string) {
  const issue = await Effect.runPromise(findRawArtifactSizeIssue(input));
  expect(issue).toBe(message);
}

function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
