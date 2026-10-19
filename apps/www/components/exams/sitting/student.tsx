"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  type Admission,
  useEnterSitting,
} from "@/components/exams/sitting/admit.client";
import { takesAnswers } from "@/components/exams/sitting/attempt";
import { readSittingDevice } from "@/components/exams/sitting/device";
import type { EntryMessage } from "@/components/exams/sitting/entry";
import {
  StudentOutcome,
  StudentPlayer,
} from "@/components/exams/sitting/player";
import { useConvexAuth } from "@/components/providers/convex";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { LayoutContent } from "@/components/shared/content/layout";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { SchoolHeader } from "@/components/tenant/header";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";

/** An admission that lets the student into the sitting, with the attempt it opened. */
type Admitted = Extract<Admission, { readonly _tag: "admitted" }>;

/**
 * The student's screen of one sitting, read from the sitting and the attempt the student
 * holds in it. Before the student is admitted it shows the room and the token field. A device
 * that the browser keeps enters without the token, because it already owns the attempt. An
 * admitted student sees the paper in the shared player while the attempt is open, and one
 * sentence for a lock, a closing, or a finished attempt. An attempt that no longer takes
 * answers shows its sentence without an entry, so a reload after a close or a finish still
 * shows how it ended.
 */
export function StudentSitting({
  sittingId,
  slug,
}: {
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  // The sitting needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const view = useQuery(
    exams.sittings.student,
    isSettled ? { sittingId, slug } : "skip"
  );
  const enter = useEnterSitting();
  const [admitted, setAdmitted] = useState<Admitted | null>(null);
  const [message, setMessage] = useState<typeof EntryMessage.Type | null>(null);
  const [tokenText, setTokenText] = useState("");
  const resumed = useRef(false);
  const tokenId = useId();
  // The entry waits for the server's answer: a second press would send a second device with the same token.
  const [entering, startEntering] = useTransition();
  const ready = QueryResult.isSuccess(view);

  /** Shows the admission, or the sentence that explains why the entry was refused. */
  const receive = useCallback((next: Admission) => {
    if (next._tag === "admitted") {
      setAdmitted(next);
      setMessage(null);
      return;
    }
    setMessage(next._tag === "refused" ? next.message : null);
  }, []);

  useEffect(() => {
    if (resumed.current || !ready) {
      return;
    }
    resumed.current = true;
    Effect.runPromise(
      readSittingDevice(sittingId).pipe(
        Effect.flatMap((stored) =>
          Option.isSome(stored)
            ? Effect.sync(() => {
                enter({ sittingId, slug, token: "" }, receive);
              })
            : Effect.void
        )
      )
    );
  }, [enter, ready, receive, sittingId, slug]);

  if (QueryResult.isFailure(view)) {
    if (isLostAccess(view.error)) {
      throw view.error;
    }
    return isDenied(view.error) ? <StudentRefusal /> : <StudentReadFailure />;
  }
  if (!QueryResult.isSuccess(view)) {
    return null;
  }
  const { attempt, sitting } = view.value;
  if (attempt !== null && admitted !== null) {
    return (
      <StudentPlayer
        attempt={attempt}
        deviceId={admitted.deviceId}
        sitting={sitting}
        slug={slug}
      />
    );
  }
  if (attempt !== null && !takesAnswers(attempt.state)) {
    return <StudentOutcome attempt={attempt} sitting={sitting} slug={slug} />;
  }

  /** Enters with the token that the student typed. */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startEntering(async () => {
      await enter({ sittingId, slug, token: tokenText.trim() }, receive);
    });
  }

  return (
    <>
      <SchoolHeader
        items={[{ label: sitting.examTitle }]}
        title={sitting.examTitle}
      />
      <LayoutContent className="w-full py-6">
        <form onSubmit={onSubmit}>
          <CardSection>
            <CardHeader>
              <CardTitle>{t("student-enter")}</CardTitle>
              <CardDescription>
                {t("student-room-line", { room: sitting.room })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor={tokenId}>{t("token")}</FieldLabel>
                <Input
                  autoComplete="off"
                  id={tokenId}
                  name="token"
                  onChange={(event) => setTokenText(event.currentTarget.value)}
                  placeholder={t("student-token-placeholder")}
                  value={tokenText}
                />
              </Field>
            </CardContent>
            <CardSectionFooter
              hint={message === null ? t("student-enter-footer") : t(message)}
              tone={message === null ? null : "destructive"}
            >
              <CardSectionActions>
                <Button disabled={entering} type="submit">
                  {t("student-enter")}
                </Button>
              </CardSectionActions>
            </CardSectionFooter>
          </CardSection>
        </form>
      </LayoutContent>
    </>
  );
}

/** The page when the sitting is not open to the student: the header, and why. */
function StudentRefusal() {
  const t = useTranslations("Exams");

  return (
    <>
      <SchoolHeader items={[{ label: t("sitting") }]} title={t("sitting")} />
      <LayoutContent className="w-full py-6">
        <p className="text-muted-foreground text-sm">
          {t("student-unavailable")}
        </p>
      </LayoutContent>
    </>
  );
}

/** The page when the sitting could not be read: the header, and Try again, since the read may succeed. */
function StudentReadFailure() {
  const t = useTranslations("Exams");

  return (
    <>
      <SchoolHeader items={[{ label: t("sitting") }]} title={t("sitting")} />
      <LayoutContent className="w-full py-6">
        <DataFailure onRetry={reloadPage} />
      </LayoutContent>
    </>
  );
}
