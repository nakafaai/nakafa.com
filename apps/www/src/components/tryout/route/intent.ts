import { Option } from "effect";
import { readPlayerModeParam } from "@/components/player/mode";
import {
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";

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
