import { useMutation } from "@confect/react";
import { useCallbackRef } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type {
  PresenceSession,
  PresenceToken,
} from "@repo/backend/confect/exams/presence";
import { Data, Effect, Fiber } from "effect";
import { useEffect } from "react";
import { makeHeartbeat } from "@/components/tenant/exams/heartbeat";
import { reportClientException } from "@/lib/analytics/client";

/** A leave that did not reach the server. */
class LeaveFailed extends Data.TaggedError("LeaveFailed")<{
  readonly cause: unknown;
}> {}

/**
 * Keeps a session in its room while `isOpen` holds: it joins at once, beats every interval while the tab shows, joins
 * again a moment after the tab shows once a beat found it hidden, and leaves when the page goes away or the room
 * closes (`makeHeartbeat`). A failure is reported to `source`.
 */
export function useHeartbeat<E>({
  isOpen,
  join,
  source,
}: {
  readonly isOpen: boolean;
  /** Joins the session to its room, or keeps it there, and answers the token that closes it. */
  readonly join: (
    session: typeof PresenceSession.Type
  ) => Effect.Effect<typeof PresenceToken.Type, E>;
  readonly source: string;
}) {
  const leave = useMutation(exams.presence.leave);
  const latestJoin = useCallbackRef(join);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const report = (error: unknown) => reportClientException(error, { source });
    const heartbeat = Effect.runSync(
      makeHeartbeat({
        isVisible: () => document.visibilityState === "visible",
        join: (session) => latestJoin(session),
        leave: (token) =>
          Effect.tryPromise({
            catch: (cause) => new LeaveFailed({ cause }),
            try: () => leave({ token }),
          }).pipe(Effect.asVoid, Effect.catch(report)),
      })
    );
    const running = Effect.runFork(heartbeat.run.pipe(Effect.catch(report)));

    function onVisibility() {
      if (document.visibilityState === "visible") {
        Effect.runFork(heartbeat.returned.pipe(Effect.catch(report)));
      }
    }

    function onPageHide() {
      Effect.runFork(heartbeat.leave);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        Effect.runFork(heartbeat.returned.pipe(Effect.catch(report)));
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      Effect.runFork(Fiber.interrupt(running));
    };
  }, [isOpen, latestJoin, leave, source]);
}
