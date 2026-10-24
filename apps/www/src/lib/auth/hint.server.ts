import { getRequest } from "@tanstack/react-start/server";
import { Option } from "effect";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * Whether this request's cookies carry the signed-in hint. The browser sends the
 * hint with every page, so the server knows the visitor's state before the first
 * HTML, without asking the auth service.
 */
export function readRequestSignedInHint(): boolean {
  return Option.match(
    Option.fromNullishOr(getRequest().headers.get("cookie")),
    {
      onNone: () => false,
      onSome: hasSignedInHint,
    }
  );
}
