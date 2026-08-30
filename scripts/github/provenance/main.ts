import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Schema } from "effect";
import { SigstoreProvenanceBundleVerifierLive } from "#scripts/github/provenance/bundle";
import {
  CliArgumentsSchema,
  ProvenanceVerificationError,
} from "#scripts/github/provenance/schema";
import { verifyProvenance } from "#scripts/github/provenance/verify";
import { writeOutput } from "#scripts/output";

const runProvenanceMain = Effect.fn("GithubProvenance.runMain")(function* () {
  const args = yield* Schema.decodeUnknownEffect(CliArgumentsSchema)(
    process.argv.slice(2)
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ProvenanceVerificationError({
          cause,
          message: "Provenance verification arguments are invalid.",
        })
    )
  );
  const [
    auditPath,
    packageName,
    packageVersion,
    packageSha512,
    repository,
    workflow,
    ref,
    sourceSha,
    environment,
  ] = args;
  const fileSystem = yield* FileSystem.FileSystem;
  const source = yield* fileSystem.readFileString(auditPath).pipe(
    Effect.mapError(
      (cause) =>
        new ProvenanceVerificationError({
          cause,
          message: "Unable to read the npm signature audit.",
        })
    )
  );
  yield* verifyProvenance(source, {
    environment,
    packageName,
    packageSha512,
    packageVersion,
    ref,
    repository,
    sourceSha,
    workflow,
  });
  yield* writeOutput(
    `Verified ${packageName}@${packageVersion} with exact trusted-publisher provenance.\n`
  );
});

if (import.meta.main) {
  NodeRuntime.runMain(
    runProvenanceMain().pipe(
      Effect.provide(
        Layer.mergeAll(SigstoreProvenanceBundleVerifierLive, NodeServices.layer)
      )
    )
  );
}
