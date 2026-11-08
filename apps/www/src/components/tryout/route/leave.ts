import { useNavigate } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import {
  getTryoutPageTarget,
  type TryoutPageAddress,
} from "@/components/tryout/route/path";

/**
 * Leaving for one try-out page, which completes once the router has shown it. An address that names no page
 * leaves the page on screen, and a navigation that fails leaves it too, since the learner is still on a page.
 */
export function useTryoutLeave(address: TryoutPageAddress) {
  const navigate = useNavigate();

  return Option.match(getTryoutPageTarget(address), {
    onNone: () => Effect.void,
    onSome: (target) =>
      Effect.tryPromise(() => navigate(target)).pipe(Effect.ignore),
  });
}
