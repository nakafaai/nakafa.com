import { decodeLocale } from "@repo/internationalization/src/locale";
import { Option } from "effect";
import { PROFILE_ROUTE_SEGMENT, SETTINGS_SEGMENT } from "@/lib/profile/href";
import { notFoundAnswer } from "@/lib/tenant/gate";

/**
 * Answers a raw address `/{locale}/user/{name}` with not found, unless the name
 * is the settings page. A profile has no address below `user`: it lives at
 * `/{locale}/@{username}`, which the profile rewrite maps to the router. A
 * retired id address is redirected before this gate runs, so only the address
 * of a profile that the browser asks for by its username reaches the router.
 */
export function answerProfileGate(request: Request): Option.Option<Response> {
  const [, localeSegment, root = "", name = ""] = new URL(
    request.url
  ).pathname.split("/");
  if (
    root !== PROFILE_ROUTE_SEGMENT ||
    name === "" ||
    name === SETTINGS_SEGMENT ||
    Option.isNone(decodeLocale(localeSegment))
  ) {
    return Option.none();
  }
  return Option.some(notFoundAnswer(request, {}));
}
