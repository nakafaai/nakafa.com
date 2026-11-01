import { useRouter } from "@tanstack/react-router";
import { Effect, Fiber } from "effect";
import { useEffect } from "react";
import { warmLinks } from "@/lib/routing/warm";

/**
 * Warms the pages a reader can press next, each time a page settles and each time
 * the reader stops scrolling. It draws nothing.
 */
export function NavigationWarmth() {
  const router = useRouter();

  useEffect(() => {
    let running = Effect.runFork(warmLinks(router));
    const warm = () => {
      Effect.runFork(Fiber.interrupt(running));
      running = Effect.runFork(warmLinks(router));
    };
    const stopFollowing = router.subscribe("onResolved", warm);
    // A page can scroll in an element, whose `scrollend` reaches the window on capture.
    window.addEventListener("scrollend", warm, {
      capture: true,
      passive: true,
    });
    return () => {
      stopFollowing();
      window.removeEventListener("scrollend", warm, { capture: true });
      Effect.runFork(Fiber.interrupt(running));
    };
  }, [router]);

  return null;
}
