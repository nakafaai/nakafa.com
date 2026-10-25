import { withAnalyticsSink } from "@repo/backend/scripts/content/acceptance/analytics";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { leaseLocalRuntime } from "@repo/backend/scripts/content/acceptance/lease";
import {
  initializeLocalRuntime,
  leaseReservedLocalRuntime,
  localApplicationEnvironment,
  releaseLocalRuntime,
  reserveLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import type { AcceptanceMode } from "@repo/backend/scripts/content/acceptance/mode";
import { acceptanceOrigin } from "@repo/backend/scripts/content/acceptance/origin";
import {
  runBuildCommand,
  withLocalBackend,
} from "@repo/backend/scripts/content/acceptance/process";
import { publishAcceptanceSource } from "@repo/backend/scripts/content/acceptance/publication";
import { Effect, Exit, Option } from "effect";

/** Creates one signed local acceptance database without touching a cloud deployment. */
export const prepareAcceptance = Effect.fn("acceptance.prepare")(function* (
  root: string
) {
  const reservation = yield* reserveLocalRuntime(root);
  return yield* Effect.gen(function* () {
    yield* leaseLocalRuntime(root);
    const runtime = yield* initializeLocalRuntime(root);
    yield* withLocalBackend(runtime, publishAcceptanceSource(root, runtime));
  }).pipe(
    Effect.scoped,
    Effect.onExit((exit) =>
      Exit.isFailure(exit) ? releaseLocalRuntime(reservation) : Effect.void
    )
  );
});

/**
 * Convex runs functions on dedicated hosts, but acceptance shares one machine
 * between the local backend and the app. The build runs below the backend's
 * CPU priority so prerender workers cannot starve queries past Convex's
 * one-second limit, while the served app keeps normal priority for browsers.
 *
 * The build calls Turborepo directly. The root build script runs the policy
 * checks first, which prove nothing about the built app, and every browser
 * suite run would repeat what the local verification already runs on the same
 * commit.
 *
 * The start serves the build through Vite's preview server, which runs the Worker
 * in workerd (the Alchemy plugin of apps/www/vite.config.ts). The served app takes
 * the port of the origin that prepare recorded, which the browser suites open.
 * `--strictPort` fails an occupied port instead of moving to another, and
 * Portless stays out of acceptance.
 * @see https://man7.org/linux/man-pages/man1/nice.1.html
 */
const applicationCommands = {
  build: ["nice", "-n", "10", "bunx", "turbo", "run", "build"],
  start: ["bunx", "--cwd", "apps/www", "vite", "preview", "--strictPort"],
} as const;

/** Starts only the owned native database for a normal app build or start. */
export const runAcceptance = Effect.fn("acceptance.run")(function* (
  root: string,
  operation: "build" | "start",
  args: readonly string[]
) {
  const reserved = yield* leaseReservedLocalRuntime(root);
  if (Option.isNone(reserved)) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare before building or starting acceptance."
    );
  }
  const runtime = reserved.value;
  // The backend and the build carry the origin that prepare chose, so a
  // different ACCEPTANCE_PORT would send the browser suites somewhere else.
  const origin = yield* acceptanceOrigin;
  if (origin !== runtime.app) {
    return yield* acceptanceRuntimeError(
      `This runtime serves ${runtime.app}, but ACCEPTANCE_PORT names ${origin}. Set ACCEPTANCE_PORT to the port that prepare used, or clean the runtime and prepare it again.`
    );
  }
  const environment = localApplicationEnvironment(runtime);
  if (operation === "build") {
    return yield* withLocalBackend(
      runtime,
      runBuildCommand(
        root,
        [...applicationCommands.build, ...args],
        environment
      )
    );
  }
  // The served app proxies analytics to the stand-in reserved at prepare. It
  // claims its port first, so an occupied port fails before Convex starts.
  return yield* withAnalyticsSink(
    runtime.analytics,
    withLocalBackend(
      runtime,
      runBuildCommand(
        root,
        [
          ...applicationCommands.start,
          "--port",
          new URL(runtime.app).port,
          ...args,
        ],
        environment
      )
    )
  );
}, Effect.scoped);

/** The prepare mode of the acceptance command line: creates the local acceptance database. It takes no argument. */
export const prepareMode = {
  mode: "prepare",
  usage: "prepare",
  run: prepareAcceptance,
} satisfies AcceptanceMode;

/** The build mode: builds the app against the owned local backend, with the arguments after its word. */
export const buildMode = {
  mode: "build",
  usage: "build",
  run: Effect.fn("contentAcceptance.runBuild")(function* (
    root: string,
    args: readonly string[]
  ) {
    return yield* runAcceptance(root, "build", args);
  }),
} satisfies AcceptanceMode;

/** The start mode: starts the app against the owned local backend, with the arguments after its word. */
export const startMode = {
  mode: "start",
  usage: "start",
  run: Effect.fn("contentAcceptance.runStart")(function* (
    root: string,
    args: readonly string[]
  ) {
    return yield* runAcceptance(root, "start", args);
  }),
} satisfies AcceptanceMode;
