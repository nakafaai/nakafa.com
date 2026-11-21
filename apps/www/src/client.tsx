// From the module itself: the entry runs before the first phase, and Effect's
// index would start every module of the library in that task.
import { all, andThen, gen, promise, runFork, yieldNow } from "effect/Effect";
import { StrictMode, startTransition } from "react";

/**
 * Runs a phase's module, then ends the task, so the browser can paint and answer
 * input before the next phase. Effect's default scheduler resumes a yielded
 * fiber from a timer in a browser, which is a task of its own.
 */
function phase(load: () => Promise<unknown>) {
  return andThen(promise(load), yieldNow);
}

/**
 * The browser entry. Every module the first load runs sits in the boot chunk
 * (ADR 0039 D9), and evaluating the chunk ran every module's top level in one
 * task: about 330 ms of a slow phone's thread on the home page. The entry starts
 * those modules in phases instead, each in a task of its own, then hydrates, so
 * no task holds the thread much past 80 ms (ADR 0039 D18).
 *
 * Each phase imports a module of the boot chunk, so it fetches nothing: Rolldown
 * runs the module and every module under it that no earlier phase ran.
 * `verifyBootChunk` fails a build whose phase lies outside the boot chunk. The
 * phases follow the measured weight: Effect's schema tree, the schemas the app
 * builds on, the address rewrites, the localized states with the design system's
 * parts, the root route, the rest of the route tree, and Start's client with
 * React's DOM renderer.
 */
const start = gen(function* () {
  yield* phase(() => import("effect/SchemaAST"));
  yield* phase(() => import("@repo/internationalization/src/locale"));
  yield* phase(() => import("@/lib/routing/rewrite"));
  yield* phase(() => import("@/components/state/localized"));
  yield* phase(() => import("@/routes/__root"));
  yield* phase(() => import("@/routeTree.gen"));
  const [{ StartClient }, { hydrateRoot }] = yield* all(
    [
      promise(() => import("@tanstack/react-start/client")),
      promise(() => import("react-dom/client")),
    ],
    { concurrency: "unbounded" }
  );
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>
    );
  });
});

runFork(start);
