import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
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
import { buttonVariants } from "@repo/design-system/lib/button";
import { Effect, Option } from "effect";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  type Admission,
  useEnterSitting,
} from "@/components/exams/sitting/admit";
import { isActive, takesAnswers } from "@/components/exams/sitting/attempt";
import { SittingBar } from "@/components/exams/sitting/bar";
import { SittingBody } from "@/components/exams/sitting/body";
import { readSittingDevice } from "@/components/exams/sitting/device";
import type { EntryMessage } from "@/components/exams/sitting/entry";
import { StudentOutcome } from "@/components/exams/sitting/outcome";
import { StudentPlayer } from "@/components/exams/sitting/player";
import { SittingRetry } from "@/components/exams/sitting/retry";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { useLastValue } from "@/lib/data/kept";
import { Link } from "@/lib/routing/link";

/** An admission that lets the student into the sitting, with the attempt it opened. */
type Admitted = Extract<Admission, { readonly _tag: "admitted" }>;

/**
 * The student's screen of one sitting, read from the sitting and the attempt the student holds in it. A
 * sitting that has not opened shows its opening time and no token field. Before the student is admitted,
 * the screen shows the token field, and a device that the browser keeps enters without a token, because it
 * already owns the attempt. An admitted student sees the paper while the attempt is open, and one sentence
 * for a lock. Any attempt that no longer takes answers shows its sentence and its results, so a reload after
 * a close or a finish still shows how it ended. Every screen keeps the school's header, so a phone can return
 * to the school home.
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
  // A sitting cancelled, or closed to the student, while its page is open keeps its exam's title above the refusal.
  const kept = useLastValue(view);

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
    return (
      <>
        <SittingBar
          examTitle={Option.match(kept, {
            onNone: () => t("sitting"),
            onSome: (last) => last.sitting.examTitle,
          })}
        />
        <StudentFailure error={view.error} />
      </>
    );
  }
  if (!QueryResult.isSuccess(view)) {
    return <SittingBar examTitle={t("sitting")} />;
  }
  const { attempt, sitting } = view.value;
  if (attempt !== null && admitted !== null && isActive(attempt.state)) {
    return (
      <StudentPlayer
        attempt={attempt}
        clockOffset={admitted.clockOffset}
        deviceId={admitted.deviceId}
        sitting={sitting}
        slug={slug}
      />
    );
  }
  if (attempt !== null && !takesAnswers(attempt.state)) {
    return <StudentOutcome attempt={attempt} sitting={sitting} />;
  }
  if (attempt === null && sitting.state === "scheduled") {
    return <StudentScheduled sitting={sitting} />;
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
      <SittingBar examTitle={sitting.examTitle} />
      <SittingBody>
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
                <Button disabled={!isSettled || entering} type="submit">
                  {t("student-enter")}
                </Button>
              </CardSectionActions>
            </CardSectionFooter>
          </CardSection>
        </form>
      </SittingBody>
    </>
  );
}

/** A sitting that has not opened: its opening time, and no token field until it opens. */
function StudentScheduled({
  sitting,
}: {
  readonly sitting: typeof SittingView.Type;
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();

  return (
    <>
      <SittingBar examTitle={sitting.examTitle} />
      <SittingBody>
        <CardSection>
          <CardHeader>
            <CardTitle>{t("sitting")}</CardTitle>
            <CardDescription>
              {t("student-room-line", { room: sitting.room })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {t("student-opens-at", {
                time:
                  schoolDateTimeText({
                    at: sitting.opensAt,
                    locale,
                    timeZone: sitting.timeZone,
                  }) ?? "",
              })}
            </p>
          </CardContent>
          <CardSectionFooter hint={t("student-scheduled-footer")} />
        </CardSection>
      </SittingBody>
    </>
  );
}

/**
 * The body when the sitting could not be read, under its bar. A lost membership is thrown, which sends the school to its
 * refused page. A sitting the student may not enter, or an item the student may not see, shows its refusal,
 * and any other failure shows the retry, which reports it.
 */
function StudentFailure({
  error,
}: {
  readonly error: { readonly _tag: string };
}) {
  if (isLostAccess(error)) {
    throw error;
  }
  return error._tag === "NotInSitting" || isDenied(error) ? (
    <StudentRefusal />
  ) : (
    <SittingBody>
      <SittingRetry error={error} />
    </SittingBody>
  );
}

/** The body when the sitting is not open to the student, under its bar: why, and the way back home. */
function StudentRefusal() {
  const t = useTranslations("Exams");
  const { slug } = useTenant();

  return (
    <SittingBody>
      <p>{t("student-unavailable")}</p>
      <Link
        className={buttonVariants({ variant: "outline" })}
        params={{ slug }}
        to="/school/$slug"
      >
        {t("student-back-home")}
      </Link>
    </SittingBody>
  );
}
