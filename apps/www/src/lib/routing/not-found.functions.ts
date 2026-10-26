import { createServerFn } from "@tanstack/react-start";

/** Reads what the request names for the standalone not-found page on the server, for the route's loader. */
export const readNotFoundPageFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readNotFoundPageHandler } = await import(
      "@/lib/routing/not-found.server"
    );
    return readNotFoundPageHandler();
  }
);
