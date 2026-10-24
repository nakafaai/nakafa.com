import { createServerFn } from "@tanstack/react-start";

/** Reads the locale of the standalone not-found page on the server, for the route's loader. */
export const readNotFoundLocaleFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readNotFoundLocaleHandler } = await import(
      "@/lib/routing/not-found.server"
    );
    return readNotFoundLocaleHandler();
  }
);
