import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { localConvexEnvironment } from "@repo/backend/scripts/content/acceptance/process";
import source from "@repo/backend/scripts/content/acceptance/source.json" with {
  type: "json",
};
import { Effect, FileSystem, Schema } from "effect";

const AcceptanceSourceSchema = Schema.Struct({
  repository: Schema.Literal("https://github.com/nakafaai/aksara.git"),
  revision: GitCommitShaSchema,
});

/** Installs only the reviewed Aksara revision owned by this acceptance reservation. */
export const prepareAcceptanceSource = Effect.fn("acceptance.prepareSource")(
  function* (runtime: LocalRuntime) {
    const fs = yield* FileSystem.FileSystem;
    const selected = yield* Schema.decodeUnknownEffect(AcceptanceSourceSchema)(
      source
    );
    const checkout = `${runtime.directory}/source`;
    yield* fs.makeDirectory(checkout, { mode: 0o700 });
    const command = Effect.fn("acceptance.sourceCommand")(function* (
      executable: string,
      args: readonly string[]
    ) {
      yield* runAcceptanceCommand({
        command: executable,
        args,
        cwd: checkout,
        env: localConvexEnvironment,
        operation: "Pinned Aksara acceptance source",
        reportStderr: true,
        stdoutPath: `${runtime.directory}/source.log`,
        stderrPath: `${runtime.directory}/source.log`,
      });
    });
    yield* command("git", ["init", "--quiet"]);
    yield* command("git", ["remote", "add", "origin", selected.repository]);
    yield* command("git", [
      "fetch",
      "--quiet",
      "--depth",
      "1",
      "origin",
      selected.revision,
    ]);
    yield* command("git", [
      "-c",
      "core.hooksPath=/dev/null",
      "checkout",
      "--quiet",
      "--detach",
      selected.revision,
    ]);
    yield* command("pnpm", [
      "install",
      "--frozen-lockfile",
      "--prefer-offline",
    ]);
    return { checkout, revision: selected.revision };
  }
);

/** Seeds a new local database through Aksara's signed production publication protocol. */
export const publishAcceptanceSource = Effect.fn("acceptance.publishSource")(
  function* (root: string, runtime: LocalRuntime) {
    const fs = yield* FileSystem.FileSystem;
    const renderer = `${runtime.directory}/renderer.json`;
    yield* fs.writeFileString(renderer, "", { mode: 0o600 });
    yield* runAcceptanceCommand({
      command: "pnpm",
      args: ["--silent", "--filter", "www", "renderer:manifest"],
      cwd: root,
      operation: "Acceptance renderer export",
      reportStderr: true,
      stdoutPath: renderer,
      stderrPath: `${runtime.directory}/renderer.log`,
    });
    const pinned = yield* prepareAcceptanceSource(runtime);
    yield* runAcceptanceCommand({
      command: "pnpm",
      args: ["--filter", "@nakafa/aksara-cli", "acceptance"],
      cwd: pinned.checkout,
      env: {
        ...localConvexEnvironment,
        AKSARA_ACCEPTANCE_ENDPOINT: `${runtime.site}/internal/content/releases`,
        AKSARA_ACCEPTANCE_PRIVATE_KEY: runtime.signing.privateKeyPath,
        AKSARA_ACCEPTANCE_RENDERER: renderer,
        AKSARA_ACCEPTANCE_REVISION: pinned.revision,
        AKSARA_ACCEPTANCE_SOURCE: pinned.checkout,
        AKSARA_AGENT_SIGNING_KEY_ID: runtime.signing.keyId,
        AKSARA_PUBLICATION_TOKEN: runtime.publicationToken,
      },
      operation: "Signed acceptance publication",
      reportStderr: true,
      sensitiveValues: [runtime.publicationToken],
      stdoutPath: `${runtime.directory}/publication.log`,
      stderrPath: `${runtime.directory}/publication.log`,
    });
    // Authored sources and the private signer belong only to this isolated lifecycle.
    // The database and its key remain until explicit ownership-checked cleanup.
  }
);
