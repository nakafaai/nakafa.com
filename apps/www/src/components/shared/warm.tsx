import { useLocation, useRouter } from "@tanstack/react-router";
import { Effect, Fiber } from "effect";
import { useEffect } from "react";
import { warmLinks } from "@/lib/routing/warm";

/**
 * Warms the pages a reader can press next, each time a page settles and each time
 * the reader stops scrolling. It draws nothing.
 */
export function NavigationWarmth() {
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });

  useEffect(() => {
    const warm = () => {
      running = Effect.runFork(warmLinks(router));
    };
    let running = Effect.runFork(warmLinks(router));
    // A page can scroll in an element, whose `scrollend` reaches the window on capture.
    window.addEventListener("scrollend", warm, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scrollend", warm, { capture: true });
      Effect.runFork(Fiber.interrupt(running));
    };
  }, [pathname, router]);

  return null;
}
