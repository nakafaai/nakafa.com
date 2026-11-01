import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { DeviceId } from "@repo/backend/confect/exams/sittings/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Duration, Effect, Schema } from "effect";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { SittingBody } from "@/components/exams/sitting/body";
import { PaperFrame } from "@/components/exams/sitting/recovery";
import { CardSection } from "@/components/shared/card/section";
import { reportClientException } from "@/lib/analytics/client";

/** Where a tab stands with its attempt's paper: still asking, holding it, or second to another tab. */
const PaperTab = Schema.Literals(["checking", "elsewhere", "held"]);

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
    "locks" in navigator ? "checking" : "held"
  );

  useEffect(() => {
    if (!("locks" in navigator)) {
      return;
    }
    const name = `nakafa-sitting-paper:${attemptId}`;
    const leaving = new AbortController();
    const left = new Promise<void>((resolve) => {
      leaving.signal.addEventListener("abort", () => resolve());
    });
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
  title,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly children: ReactNode;
  readonly deviceId: typeof DeviceId.Type;
  readonly slug: TenantSlug;
  /** The exam's name, for the paper's bar while this tab holds no paper. */
  readonly title: string;
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

  if (tab === "held") {
    return children;
  }

  return (
    <PaperFrame bar={<PaperBar back={<PaperBack />} title={title} />}>
      {tab === "elsewhere" ? <SecondTab /> : null}
    </PaperFrame>
  );
}

/** What a tab says while another tab of the browser holds the paper. */
function SecondTab() {
  const t = useTranslations("Exams");

  return (
    <SittingBody>
      <CardSection
        description={t("student-second-tab-description")}
        title={t("student-second-tab-title")}
      />
    </SittingBody>
  );
}
