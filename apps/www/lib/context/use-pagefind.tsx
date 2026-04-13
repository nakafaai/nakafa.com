"use client";

import { captureException } from "@repo/analytics/posthog";
import { addBasePath } from "next/dist/client/add-base-path";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

const PAGEFIND_SCRIPT_PATH = "/_pagefind/pagefind.js";

interface PagefindContextType {
  error: ReactElement | string;
  ready: boolean;
}

const PagefindContext = createContext<PagefindContextType | undefined>(
  undefined
);

/**
 * Provide the shared Pagefind readiness and initialization error state.
 */
export function PagefindProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ReactElement | string>("");

  useEffect(() => {
    async function init() {
      setError("");

      if (window.pagefind) {
        setReady(true);
        return;
      }

      try {
        await importPagefind();
        setReady(true);
      } catch (error) {
        if (await hasMissingDevelopmentPagefindBundle()) {
          setError(DEV_SEARCH_NOTICE);
          setReady(false);
          return;
        }

        captureException(error, {
          source: "pagefind-import",
        });
        setError(getErrorMessage(error));
        setReady(false);
      }
    }

    init();
  }, []);

  const values = useMemo(() => ({ ready, error }), [ready, error]);

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

/**
 * Format one unknown Pagefind error into a user-facing string.
 */
export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.constructor.name}: ${error.message}`;
  }

  return String(error);
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
 * Detect the expected development case where the generated Pagefind bundle does
 * not exist yet because `next dev` does not run the app's `postbuild` step.
 */
async function hasMissingDevelopmentPagefindBundle() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const response = await fetch(addBasePath(PAGEFIND_SCRIPT_PATH), {
      cache: "no-store",
    });

    return response.status === 404;
  } catch {
    return false;
  }
}

/**
 * Import and initialize the generated Pagefind browser bundle.
 */
async function importPagefind() {
  window.pagefind = await import(
    /* webpackIgnore: true */ addBasePath(PAGEFIND_SCRIPT_PATH)
  );

  if (!window.pagefind) {
    throw new Error("Pagefind not initialized correctly.");
  }

  window.pagefind.options({
    baseUrl: "/",
  });

  if (!window.pagefind.init) {
    throw new Error("Pagefind init not found.");
  }

  await window.pagefind.init();
}
