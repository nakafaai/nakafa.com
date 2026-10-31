import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Option } from "effect";
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
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { SittingBody } from "@/components/exams/sitting/body";
import { useReaderLoaded } from "@/components/exams/sitting/document";
import type { EntryMessage } from "@/components/exams/sitting/entry";
import { entersBySelf, pageRoomEntry } from "@/components/exams/sitting/join";
import { StudentOutcome } from "@/components/exams/sitting/outcome";
import { StudentPlayer } from "@/components/exams/sitting/player";
import { PaperFrame } from "@/components/exams/sitting/recovery";
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
 * the screen shows the token field. Once the sitting opens, a device that the browser keeps enters without a
 * token, because it already owns the attempt, and a student who scanned the room's QR code enters with its
 * code, which the field then shows in case the proctor has changed the token since. The browser holds both
 * before the first paint, so a page that enters by itself shows the paper's frame from its first frame and
 * never the token field, which comes back only when the entry is refused. An admitted student sees
 * the paper while the attempt is open, and one sentence for a lock. Any attempt that no longer takes answers shows its sentence and its results, so a reload after
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
  // The page enters by itself once, when the sitting has opened.
  const enterable = QueryResult.isSuccess(view) && entersBySelf(view.value);
  const entry = useSittingEntry({ enterable, sittingId, slug });
  const { admitted, joining } = entry;
  // The paper's reader loads while the student enters, so the paper draws at once.
  useReaderLoaded(enterable);
  // A sitting cancelled, or closed to the student, while its page is open keeps its exam's title above the refusal.
  const kept = useLastValue(view);

  if (QueryResult.isFailure(view)) {
    return (
      <PaperFrame
        bar={
          <PaperBar
            back={<PaperBack />}
            title={Option.match(kept, {
              onNone: () => t("sitting"),
              onSome: (last) => last.sitting.examTitle,
            })}
          />
        }
      >
        <StudentFailure error={view.error} />
      </PaperFrame>
    );
  }
  // A paused read, as while Convex confirms the session again, keeps its last answer, so a running paper stays.
  if (Option.isNone(kept)) {
    return (
      <PaperFrame
        bar={<PaperBar back={<PaperBack />} title={t("sitting")} />}
      />
    );
  }
  const { attempt, sitting } = kept.value;
  if (attempt !== null && admitted !== null && isActive(attempt.state)) {
    return (
      <StudentPlayer
        admission={admitted}
        attempt={attempt}
        sitting={sitting}
        slug={slug}
      />
    );
  }
  if (joining && enterable) {
    return (
      <PaperFrame
        bar={<PaperBar back={<PaperBack />} title={sitting.examTitle} />}
      />
    );
  }
  if (attempt !== null && !takesAnswers(attempt.state)) {
    return <StudentOutcome attempt={attempt} sitting={sitting} />;
  }
  if (attempt === null && sitting.state === "scheduled") {
    return <StudentScheduled sitting={sitting} />;
  }

  return (
    <PaperFrame
      bar={<PaperBar back={<PaperBack />} title={sitting.examTitle} />}
    >
      <SittingBody>
        <form onSubmit={entry.submit}>
          <CardSection
            description={t("student-room-line", { room: sitting.room })}
            title={t("student-enter")}
          >
            <CardContent>
              <Field>
                <FieldLabel htmlFor={entry.tokenId}>{t("token")}</FieldLabel>
                <Input
                  autoComplete="off"
                  id={entry.tokenId}
                  onChange={(event) =>
                    entry.setTokenText(event.currentTarget.value)
                  }
                  placeholder={t("student-token-placeholder")}
                  value={entry.tokenText}
                />
              </Field>
            </CardContent>
            {/* A refused token takes the sentence's place, so the card holds its height. */}
            <CardSectionFooter
              hint={
                entry.message === null
                  ? t("student-enter-footer")
                  : t(entry.message)
              }
              tone={entry.message === null ? "muted" : "destructive"}
            >
              <CardSectionActions>
                <Button disabled={!isSettled || entry.entering} type="submit">
                  {t("student-enter")}
                </Button>
              </CardSectionActions>
            </CardSectionFooter>
          </CardSection>
        </form>
      </SittingBody>
    </PaperFrame>
  );
}

/**
 * The student's entry to one sitting: what the page enters with by itself, the token the student types, and the
 * admission that lets the paper show. The browser holds the page's own entry before the first paint, so `joining`
 * says from the first frame that the page will enter by itself, until the server answers.
 */
function useSittingEntry({
  enterable,
  sittingId,
  slug,
}: {
  /** Whether the sitting's state lets the page enter by itself now. */
  readonly enterable: boolean;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const enter = useEnterSitting();
  const [admitted, setAdmitted] = useState<Admitted | null>(null);
  const [message, setMessage] = useState<typeof EntryMessage.Type | null>(null);
  // What the page enters with by itself, taken once: a room's code is spent as it is read.
  const [selfEntry] = useState(() => pageRoomEntry(sittingId));
  const [tokenText, setTokenText] = useState(() =>
    Option.getOrElse(selfEntry, () => "")
  );
  // The page's own entry has not been answered yet, so it shows the paper's frame.
  const [joining, setJoining] = useState(() => Option.isSome(selfEntry));
  const resumed = useRef(false);
  const tokenId = useId();
  // The entry waits for the server's answer: a second press would send a second device with the same token.
  const [entering, startEntering] = useTransition();

  /** Shows the admission, or the sentence that explains why the entry was refused. */
  const receive = useCallback((next: Admission) => {
    setJoining(false);
    if (next._tag === "admitted") {
      setAdmitted(next);
      setMessage(null);
      return;
    }
    setMessage(next._tag === "refused" ? next.message : null);
  }, []);

  useEffect(() => {
    if (resumed.current || !enterable) {
      return;
    }
    resumed.current = true;
    if (Option.isSome(selfEntry)) {
      startEntering(async () => {
        await enter({ sittingId, slug, token: selfEntry.value }, receive);
      });
    }
  }, [enter, enterable, receive, selfEntry, sittingId, slug]);

  /** Enters with the token that the student typed. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startEntering(async () => {
      await enter({ sittingId, slug, token: tokenText.trim() }, receive);
    });
  }

  return {
    admitted,
    entering,
    joining,
    message,
    setTokenText,
    submit,
    tokenId,
    tokenText,
  };
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
    <PaperFrame
      bar={<PaperBar back={<PaperBack />} title={sitting.examTitle} />}
    >
      <SittingBody>
        <CardSection
          description={t("student-room-line", { room: sitting.room })}
          title={t("sitting")}
        >
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
    </PaperFrame>
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
