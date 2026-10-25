import { createServerFn } from "@tanstack/react-start";

/** Answers whether the request carries the signed-in hint, read on the server. */
export const signedInHintHandler = async () => {
  const { readRequestSignedInHint } = await import("@/lib/auth/hint.server");
  return readRequestSignedInHint();
};

/** Whether the request carries the signed-in hint, read by a route loader before its first HTML. */
export const readSignedInHintFn = createServerFn({ method: "GET" }).handler(
  signedInHintHandler
);
