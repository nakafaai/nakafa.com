import { Option, Struct } from "effect";
import { readPlayerModeParam } from "@/components/player/mode";
import type { TryoutRouteSearchParams } from "@/components/tryout/route/path";
import { readTryoutRouteAttemptCapability } from "@/components/tryout/route/path";
import type { TryoutAttemptSearch } from "@/components/tryout/route/search";

/**
 * Reads the attempt capability and the player view of one address. Either one
 * being invalid makes the page not found, as the reference answers it.
 */
export function readAddressIntent(search: TryoutRouteSearchParams) {
  const capability = readTryoutRouteAttemptCapability(search);
  const view = readPlayerModeParam(search);
  if (capability.kind === "invalid" || view.kind === "invalid") {
    return Option.none();
  }
  return Option.some({
    attemptId: capability.kind === "valid" ? capability.attemptId : undefined,
    view,
  });
}

/** The attempt a URL names, if it names one. */
export function attemptOf(search: TryoutAttemptSearch) {
  return Option.getOrUndefined(
    Option.flatMapNullishOr(
      readAddressIntent(Struct.pick(search, ["attemptId", "view"])),
      (value) => value.attemptId
    )
  );
}
