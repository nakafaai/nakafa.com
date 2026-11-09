"use client";

import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import contents from "@repo/backend/confect/_generated/refs/contents";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { Array as Arr, Effect, Result } from "effect";
import { createContext, use, useRef } from "react";
import type { Locale as RouteLocale } from "use-intl";
import { SignedInIsland } from "@/components/providers/island";
import { isActiveLocale } from "@/lib/i18n/active";

/** The lesson whose end the sentinel watches, with its route locale narrowed. */
const LessonContext = createContext<{
  contentId: string;
  locale: Locale;
  publicPath: string;
} | null>(null);

/**
 * Marks the end of a lesson. Once a signed-in learner scrolls it into view, the
 * island grants the lesson's Stars, which the server allows only when the
 * learner opened the lesson at least 45 seconds earlier (ADR 0042, D9). A
 * visitor's page has no client, so nothing mounts for them.
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
        <LessonEnd />
      </SignedInIsland>
    </LessonContext>
  );
}

/** An empty element at the end of the lesson that finishes it once it is seen. */
function LessonEnd() {
  const lesson = use(LessonContext);
  const finishLesson = useMutation(contents.mutations.views.finishLesson);
  const sent = useRef(false);
  if (lesson === null) {
    throw new Error("LessonEnd must be used within LessonFinish");
  }
  return (
    <div
      aria-hidden="true"
      ref={(node) => {
        if (node === null || sent.current) {
          return;
        }
        const observer = new IntersectionObserver((entries) => {
          if (!Arr.some(entries, (entry) => entry.isIntersecting)) {
            return;
          }
          observer.disconnect();
          sent.current = true;
          Effect.runFork(
            Effect.tryPromise(() => finishLesson(lesson)).pipe(
              Effect.flatMap((result) =>
                Result.match(result, {
                  onFailure: (error) =>
                    Effect.sync(() =>
                      captureException(error, {
                        contentId: lesson.contentId,
                        locale: lesson.locale,
                        source: "finish-lesson",
                      })
                    ),
                  onSuccess: () => Effect.void,
                })
              ),
              // A dropped connection leaves the lesson for its next visit.
              Effect.catchTag("UnknownError", () =>
                Effect.sync(() => {
                  sent.current = false;
                })
              )
            )
          );
        });
        observer.observe(node);
        return () => observer.disconnect();
      }}
    />
  );
}
