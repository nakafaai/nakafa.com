"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Array as Arr, Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type Admission,
  useEnterSitting,
} from "@/components/exams/sitting/admit.client";
import { readSittingDevice } from "@/components/exams/sitting/device";
import type { EntryMessage } from "@/components/exams/sitting/entry";
import { StudentPlayer } from "@/components/exams/sitting/player";

/** An admission that lets the student into the sitting, with the attempt it opened. */
type Admitted = Extract<Admission, { readonly _tag: "admitted" }>;

/**
 * The student's screen of one sitting. Before the student is admitted it shows the room and
 * the token field. A device that the browser keeps enters without the token, because it
 * already owns the attempt, once the sitting is listed. An admitted student sees the paper in
 * the shared player while the attempt is open, and one sentence for a lock, a closing, or a
 * finished attempt, also after the proctor closes the sitting.
 */
export function StudentSitting({
  sittingId,
  slug,
}: {
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const mine = useQuery(exams.sittings.mine, { slug });
  const enter = useEnterSitting();
  const [admitted, setAdmitted] = useState<Admitted | null>(null);
  // The sitting as it was listed when the student entered: a closed sitting leaves the
  // student's list of live sittings, and the student still reads the attempt's last state.
  const [entered, setEntered] = useState<typeof SittingView.Type | null>(null);
  const [message, setMessage] = useState<typeof EntryMessage.Type | null>(null);
  const [tokenText, setTokenText] = useState("");
  const resumed = useRef(false);
  const listed = QueryResult.isSuccess(mine)
    ? Option.getOrUndefined(
        Arr.findFirst(mine.value, (row) => row.id === sittingId)
      )
    : undefined;

  /** Shows the admission into this sitting, or the sentence that explains why the entry was refused. */
  const receive = useCallback(
    (next: Admission, sitting: typeof SittingView.Type) => {
      if (next._tag === "admitted") {
        setAdmitted(next);
        setEntered(sitting);
        setMessage(null);
        return;
      }
      setMessage(next._tag === "refused" ? next.message : null);
    },
    []
  );

  useEffect(() => {
    if (resumed.current || listed === undefined) {
      return;
    }
    resumed.current = true;
    Effect.runPromise(
      readSittingDevice(sittingId).pipe(
        Effect.flatMap((stored) =>
          Option.isSome(stored)
            ? Effect.sync(() => {
                enter({ sittingId, slug, token: "" }, (next) =>
                  receive(next, listed)
                );
              })
            : Effect.void
        )
      )
    );
  }, [enter, listed, receive, sittingId, slug]);

  if (admitted !== null && entered !== null) {
    return (
      <AdmittedSitting admitted={admitted} sitting={entered} slug={slug} />
    );
  }
  if (QueryResult.isFailure(mine)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("student-unavailable")}
      </p>
    );
  }
  if (!QueryResult.isSuccess(mine)) {
    return null;
  }
  if (listed === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("student-unavailable")}
      </p>
    );
  }

  const sitting = listed;

  /** Enters with the token that the student typed. */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    enter({ sittingId, slug, token: tokenText.trim() }, (next) =>
      receive(next, sitting)
    );
  }

  return (
    <section className="grid max-w-md gap-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("student-room")}</dt>
        <dd>{sitting.room}</dd>
      </dl>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <Field>
          <FieldLabel>{t("token")}</FieldLabel>
          <Input
            autoComplete="off"
            name="token"
            onChange={(event) => setTokenText(event.currentTarget.value)}
            placeholder={t("student-token-placeholder")}
            value={tokenText}
          />
        </Field>
        {message === null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {t(message)}
          </p>
        )}
        <Button className="justify-self-start" type="submit">
          {t("student-enter")}
        </Button>
      </form>
    </section>
  );
}

/**
 * The admitted student's view, read from the attempt the server holds. The player shows while
 * the attempt is open, and its state decides the rest of the screen.
 */
function AdmittedSitting({
  admitted,
  sitting,
  slug,
}: {
  readonly admitted: Admitted;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const attempt = useQuery(exams.sittings.attempt, {
    sittingId: sitting.id,
    slug,
  });

  if (!QueryResult.isSuccess(attempt) || attempt.value === null) {
    return null;
  }

  return (
    <StudentPlayer
      attempt={attempt.value}
      deviceId={admitted.deviceId}
      sitting={sitting}
      slug={slug}
    />
  );
}
