"use client";

import { captureException } from "@repo/analytics/posthog";
import { Effect } from "effect";
import { addBasePath } from "next/dist/client/add-base-path";
import {
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { getErrorMessage } from "@/lib/utils/error";

const PAGEFIND_SCRIPT_PATH = "/_pagefind/pagefind.js";

interface PagefindContextType {
  error: ReactElement | string;
  ready: boolean;
}

interface PagefindStateSetters {
  setError: Dispatch<SetStateAction<ReactElement | string>>;
  setReady: Dispatch<SetStateAction<boolean>>;
}

const PagefindContext = createContext<PagefindContextType | undefined>(
  undefined
);

/**
 * Provide the shared Pagefind readiness and initialization error state.
 *
 * Source of truth:
 * `apps/www/package.json` runs `tsx scripts/pagefind/index.ts` in `postbuild`.
 * `apps/www/scripts/pagefind/build.ts` writes the browser bundle to
 * `public/_pagefind`.
 *
 * Related docs:
 * https://pagefind.app/docs/indexing/
 */
export function PagefindProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ReactElement | string>("");

  useEffect(() => {
    Effect.runFork(initializePagefind({ setError, setReady }));
  }, []);

  const values = { ready, error };

  return (
    <PagefindContext.Provider value={values}>
      {children}
    </PagefindContext.Provider>
  );
}

/**
 * Read one selected value from the shared Pagefind provider.
 */
export function usePagefind<T>(selector: (context: PagefindContextType) => T) {
  const context = useContextSelector(PagefindContext, (value) => value);

  if (context === undefined) {
    throw new Error("usePagefind must be used within a PagefindProvider.");
  }

  return selector(context);
}

const DEV_SEARCH_NOTICE = (
  <>
    <p>
      Search isn&apos;t available in development because Nakafa uses Pagefind
      package, which indexes built `.html` files instead of `.md`/`.mdx`.
    </p>
    <p className="x:mt-2">
      To test search during development, run `next build` and then restart your
      app with `next dev`.
    </p>
  </>
);

/**
 * Initialize Pagefind and publish its readiness state for search consumers.
 */
const initializePagefind = Effect.fn("www.pagefind.initialize")(function* ({
  setError,
  setReady,
}: PagefindStateSetters) {
  yield* Effect.sync(() => setError(""));

  if (window.pagefind) {
    yield* Effect.sync(() => setReady(true));
    return;
  }

  yield* importPagefind().pipe(
    Effect.tap(() => Effect.sync(() => setReady(true))),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const hasMissingBundle = yield* hasMissingDevelopmentPagefindBundle();

        if (hasMissingBundle) {
          yield* Effect.sync(() => {
            setError(DEV_SEARCH_NOTICE);
            setReady(false);
          });
          return;
        }

        yield* Effect.sync(() => {
          captureException(error, {
            source: "pagefind-import",
          });
          setError(getErrorMessage(error));
          setReady(false);
        });
      })
    )
  );
});

/**
 * Detect the expected development case where the generated Pagefind bundle does
 * not exist yet because `next dev` does not run the app's `postbuild` step.
 *
 * Source of truth:
 * `apps/www/package.json` only runs the Pagefind build in `postbuild`.
 * `apps/www/scripts/pagefind/build.ts` writes the runtime bundle to
 * `public/_pagefind`.
 *
 * Related docs:
 * https://pagefind.app/docs/indexing/
 */
function hasMissingDevelopmentPagefindBundle() {
  if (process.env.NODE_ENV === "production") {
    return Effect.succeed(false);
  }

  return Effect.tryPromise({
    try: () =>
      fetch(addBasePath(PAGEFIND_SCRIPT_PATH), {
        cache: "no-store",
      }),
    catch: (error) => error,
  }).pipe(
    Effect.map((response) => response.status === 404),
    Effect.catchAll(() => Effect.succeed(false))
  );
}

/**
 * Import and initialize the generated Pagefind browser bundle.
 *
 * Source of truth:
 * `apps/www/scripts/pagefind/build.ts` writes the browser assets to
 * `public/_pagefind`, which the app serves at `/_pagefind`.
 *
 * Related docs:
 * https://pagefind.app/docs/indexing/
 */
const importPagefind = Effect.fn("www.pagefind.import")(function* () {
  const pagefind = yield* Effect.tryPromise({
    try: () =>
      // react-doctor-disable-next-line react-doctor/no-dynamic-import-path
      import(/* webpackIgnore: true */ addBasePath(PAGEFIND_SCRIPT_PATH)),
    catch: (error) => error,
  });

  yield* Effect.sync(() => {
    window.pagefind = pagefind;
  });

  const pagefindRuntime = window.pagefind;

  if (!pagefindRuntime) {
    return yield* Effect.fail(new Error("Pagefind not initialized correctly."));
  }

  yield* Effect.try({
    try: () =>
      pagefindRuntime.options({
        baseUrl: "/",
      }),
    catch: (error) => error,
  });

  if (!pagefindRuntime.init) {
    return yield* Effect.fail(new Error("Pagefind init not found."));
  }

  const initializeRuntime = pagefindRuntime.init;

  yield* Effect.tryPromise({
    try: () => initializeRuntime(),
    catch: (error) => error,
  });
});
