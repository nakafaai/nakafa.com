"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
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
import { useSittingSignals } from "@/components/exams/sitting/signals.client";

/** An admission that lets the student into the sitting, with the attempt it opened. */
type Admitted = Extract<Admission, { readonly _tag: "admitted" }>;

/**
 * The student's screen of one sitting. Before the student is admitted it shows the room and
 * the token field. A device that the browser keeps enters without the token, because it
 * already owns the attempt. The exam's questions, the finish, and the times wait for a later
 * version, so an admitted student sees the room and the state of the attempt.
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
  const [message, setMessage] = useState<typeof EntryMessage.Type | null>(null);
  const [tokenText, setTokenText] = useState("");
  const resumed = useRef(false);

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
    if (resumed.current) {
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
  }, [enter, receive, sittingId, slug]);

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
  const sitting = Option.getOrUndefined(
    Arr.findFirst(mine.value, (row) => row.id === sittingId)
  );
  if (sitting === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("student-unavailable")}
      </p>
    );
  }
  if (admitted !== null) {
    return (
      <AdmittedSitting admitted={admitted} room={sitting.room} slug={slug} />
    );
  }

  /** Enters with the token that the student typed. */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    enter({ sittingId, slug, token: tokenText.trim() }, receive);
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
 * The admitted student's view: the room, and the locked sentence when the proctor has locked
 * the sitting. The signals run while the page is open, and only for an attempt that can still
 * take them.
 */
function AdmittedSitting({
  admitted,
  room,
  slug,
}: {
  readonly admitted: Admitted;
  readonly room: string;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");

  useSittingSignals({
    attemptId: admitted.attemptId,
    deviceId: admitted.deviceId,
    enabled: admitted.state === "inProgress" || admitted.state === "locked",
    slug,
  });

  return (
    <section className="grid gap-4">
      <header className="border-b pb-3">
        <p className="truncate font-medium text-sm">{room}</p>
      </header>
      {admitted.state === "locked" ? <p>{t("student-locked")}</p> : null}
    </section>
  );
}
