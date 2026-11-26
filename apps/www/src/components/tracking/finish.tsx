"use client";

import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import contents from "@repo/backend/confect/_generated/refs/contents";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { useRequired } from "@repo/design-system/hooks/required";
import type { Cause } from "effect";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Fiber,
  Result,
} from "effect";
import { createContext, useRef } from "react";
import type { Locale as RouteLocale } from "use-intl";
import { SignedInIsland } from "@/components/providers/island";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Total time from page mount until the server accepts `finishLesson`: the
 * view tracker records after 3 seconds and the server requires 45 seconds of
 * reading after that view, plus a 1 second margin.
 */
const READ_WINDOW_MS = 49_000;
const MINIMUM_RETRY_MS = 5000;

/** The lesson whose end the sentinel watches, with its route locale narrowed. */
const LessonContext = createContext<{
  contentId: string;
  locale: Locale;
  publicPath: string;
} | null>(null);

/**
 * Marks the end of a lesson. Once a signed-in learner scrolls it into view, the
 * progress grants the lesson's Stars, which the server allows only when the
 * learner opened the lesson at least 45 seconds earlier (ADR 0042, D9). If the
 * learner reaches the end before 45 seconds have passed, one delayed check runs
 * once the read window completes while they remain on the page. A visitor's
 * page has no client, so nothing mounts for them.
 */
export function LessonFinish({
  contentId,
  locale,
  publicPath,
}: {
  contentId: string | null | undefined;
  locale: RouteLocale;
  publicPath: string;
}) {
  if (!(contentId && isActiveLocale(locale))) {
    return null;
  }
  return (
    <LessonContext value={{ contentId, locale, publicPath }}>
      <SignedInIsland>
        <LessonEnd key={`${locale}:${contentId}`} />
      </SignedInIsland>
    </LessonContext>
  );
}

/** An empty element at the end of the lesson that finishes it once it is seen. */
function LessonEnd() {
  const lesson = useRequired(LessonContext, "LessonEnd");
  const finishLesson = useMutation(contents.mutations.views.finishLesson);
  const mountedAt = useRef<number | null>(null);
  const tried = useRef(false);
  const sent = useRef(false);
  return (
    <div
      aria-hidden="true"
      ref={(node) => {
        if (node === null || sent.current) {
          return;
        }
        if (mountedAt.current === null) {
          mountedAt.current = DateTime.toEpochMillis(DateTime.nowUnsafe());
        }
        const startedAt = mountedAt.current;
        let activeFiber: Fiber.Fiber<void> | undefined;
        const submit = () =>
          Effect.tryPromise(() => finishLesson(lesson)).pipe(
            Effect.flatMap((result) =>
              Result.match(result, {
                onFailure: (error) =>
                  Effect.sync(() => {
                    captureException(error, {
                      contentId: lesson.contentId,
                      locale: lesson.locale,
                      source: "finish-lesson",
                    });
                  }).pipe(Effect.as("done" as const)),
                onSuccess: (outcome) =>
                  Effect.succeed(
                    outcome._tag === "unread"
                      ? ("unread" as const)
                      : ("done" as const)
                  ),
              })
            )
          );
        const scheduleRetry = () => {
          const elapsed =
            DateTime.toEpochMillis(DateTime.nowUnsafe()) - startedAt;
          const waitMs = Math.max(MINIMUM_RETRY_MS, READ_WINDOW_MS - elapsed);
          return Effect.sleep(Duration.millis(waitMs)).pipe(
            Effect.andThen(submit()),
            Effect.andThen(
              Effect.sync(() => {
                sent.current = true;
              })
            )
          );
        };
        const run = (effect: Effect.Effect<void, Cause.UnknownError>) => {
          activeFiber = Effect.runFork(
            // A dropped connection leaves the lesson for its next visit.
            effect.pipe(
              Effect.catchTag("UnknownError", () =>
                Effect.sync(() => {
                  sent.current = true;
                })
              )
            )
          );
        };
        if (tried.current) {
          run(scheduleRetry());
          return () => {
            if (activeFiber !== undefined) {
              Effect.runFork(Fiber.interrupt(activeFiber));
            }
          };
        }
        const observer = new IntersectionObserver((entries) => {
          if (!Arr.some(entries, (entry) => entry.isIntersecting)) {
            return;
          }
          observer.disconnect();
          tried.current = true;
          run(
            submit().pipe(
              Effect.flatMap((status) => {
                if (status === "unread") {
                  return scheduleRetry();
                }
                return Effect.sync(() => {
                  sent.current = true;
                });
              })
            )
          );
        });
        observer.observe(node);
        return () => {
          observer.disconnect();
          if (activeFiber !== undefined) {
            Effect.runFork(Fiber.interrupt(activeFiber));
          }
        };
      }}
    />
  );
}
