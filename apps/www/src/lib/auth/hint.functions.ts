import { createServerFn } from "@tanstack/react-start";

/** Whether the request carries the signed-in hint, read by a route loader before its first HTML. */
export const readSignedInHintFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readRequestSignedInHint } = await import("@/lib/auth/hint.server");
    return readRequestSignedInHint();
  }
);
