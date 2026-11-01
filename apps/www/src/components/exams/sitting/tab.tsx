import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { DeviceId } from "@repo/backend/confect/exams/sittings/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Duration, Effect, Schema } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { SittingBody, SittingNotice } from "@/components/exams/sitting/body";
import { reportClientException } from "@/lib/analytics/client";

/** Where a tab stands with its attempt's paper: still asking, holding it, or second to another tab. */
const PaperTab = Schema.Literals(["checking", "elsewhere", "held"]);

/** Where this tab stands with the paper, for the parts of the guard. */
const PaperTabContext = createContext<typeof PaperTab.Type>("checking");

/** How long a tab asks before it calls itself second, which covers the moment a reload's old page lets go. */
const HANDOVER = Duration.seconds(1);

/**
 * One tab of a browser holds an attempt's paper, through a Web Lock named by the attempt. Both tabs share the
 * browser's device, so the server admits them alike, and a second paper would report every switch between
 * the two as the student leaving the exam. The lock goes with its tab, however the tab closes, and a tab that
 * waits takes the paper over then. A browser without Web Locks runs the paper as it always did.
 */
function usePaperTab(attemptId: GenericId.GenericId<"examAttempts">) {
  const [tab, setTab] = useState<typeof PaperTab.Type>(() =>
    typeof navigator === "undefined" || "locks" in navigator
      ? "checking"
      : "held"
  );

  useEffect(() => {
    if (!("locks" in navigator)) {
      return;
    }
    const name = `nakafa-sitting-paper:${attemptId}`;
    const leaving = new AbortController();
    const left = Effect.runPromise(
      Effect.callback<void>((resume) => {
        leaving.signal.addEventListener("abort", () => resume(Effect.void));
      })
    );
    const hold = () => {
      setTab("held");
      return left;
    };
    Effect.runPromise(
      Effect.tryPromise(() =>
        navigator.locks.request(name, { ifAvailable: true }, (lock) => {
          if (lock !== null) {
            return hold();
          }
          Effect.runPromise(
            Effect.sleep(HANDOVER).pipe(
              Effect.andThen(
                Effect.sync(() =>
                  setTab((now) => (now === "held" ? now : "elsewhere"))
                )
              )
            )
          );
          return navigator.locks.request(
            name,
            { signal: leaving.signal },
            hold
          );
        })
      ).pipe(Effect.ignore)
    );
    return () => leaving.abort();
  }, [attemptId]);

  return tab;
}

/**
 * Keeps an attempt's paper to one tab. A second tab says where the paper is and takes over once that tab
 * closes, and it reports itself once to the proctor as a second tab, the one signal it sends, so switching
 * between the two never reads as leaving the exam.
 */
export function SittingTabGuard({
  attemptId,
  children,
  deviceId,
  slug,
  waiting,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  /** The paper, which this tab draws while it holds it. */
  readonly children: ReactNode;
  readonly deviceId: typeof DeviceId.Type;
  readonly slug: TenantSlug;
  /** What this tab draws while it holds no paper. */
  readonly waiting: ReactNode;
}) {
  const tab = usePaperTab(attemptId);
  const signal = useMutation(exams.sittings.signal);

  useEffect(() => {
    if (tab !== "elsewhere") {
      return;
    }
    Effect.runPromise(
      Effect.tryPromise(() =>
        signal({ attemptId, deviceId, kind: "secondTab", slug })
      ).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.catch((error) =>
          reportClientException(error, {
            source: "components/exams/sitting/tab",
          })
        ),
        Effect.asVoid
      )
    );
  }, [attemptId, deviceId, signal, slug, tab]);

  return (
    <PaperTabContext value={tab}>
      {tab === "held" ? children : waiting}
    </PaperTabContext>
  );
}

/** What a tab says while another tab of the browser holds the paper. */
export function SittingTabElsewhere() {
  const tab = use(PaperTabContext);
  const t = useTranslations("Exams");

  if (tab !== "elsewhere") {
    return null;
  }

  return (
    <SittingBody>
      <SittingNotice
        description={t("student-second-tab-description")}
        title={t("student-second-tab-title")}
      />
    </SittingBody>
  );
}
