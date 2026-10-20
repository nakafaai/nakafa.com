import { createServerFn } from "@tanstack/react-start";

/**
 * The session of the current visitor, read by the page that needs it. Only this
 * wiring is in the client graph: the handler loads from the server module when
 * the server runs the function.
 */
export const sessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const { sessionHandler } = await import("@/lib/auth/session.server");
  return sessionHandler({ data: undefined });
});
