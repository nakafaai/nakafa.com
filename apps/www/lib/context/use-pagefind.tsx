"use client";

import { addBasePath } from "next/dist/client/add-base-path";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface PagefindContextType {
  ready: boolean;
  error: ReactElement | string;
}

const PagefindContext = createContext<PagefindContextType | undefined>(
  undefined
);

export function PagefindProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ReactElement | string>("");

  // Initialize Pagefind on mount
  useEffect(() => {
    async function init() {
      setError(""); // Reset error on attempt
      if (window.pagefind) {
        setReady(true);
        return;
      }
      try {
        await importPagefind();
        setReady(true);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        setReady(false); // Explicitly set to false on error
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

export function usePagefind<T>(selector: (context: PagefindContextType) => T) {
  const context = useContextSelector(PagefindContext, (value) => value);
  if (context === undefined) {
    throw new Error("usePagefind must be used within a PagefindProvider.");
  }
  return selector(context);
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      process.env.NODE_ENV !== "production" &&
      error.message.includes("Failed to fetch")
    ) {
      return DEV_SEARCH_NOTICE; // This error will be tree-shaked in production
    }
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

// Fix React Compiler (BuildHIR::lowerExpression) Handle Import expressions
async function importPagefind() {
  try {
    window.pagefind = await import(
      /* webpackIgnore: true */ addBasePath("/_pagefind/pagefind.js")
    );
    if (!window.pagefind) {
      throw new Error("Pagefind not initialized correctly.");
    }
    window.pagefind?.options({
      baseUrl: "/",
      // ... more search options
    });
    if (!window.pagefind.init) {
      throw new Error("Pagefind init not found.");
    }
    await window.pagefind.init();
  } catch {
    window.pagefind = {
      debouncedSearch: () => Promise.resolve(null),
      destroy: () => Promise.resolve(),
      init: () => Promise.resolve(),
      options: () => Promise.resolve(),
    };
  }
}
