import { useMutation } from "@confect/react";
import { Login03Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { JoinOutcome } from "@repo/backend/confect/exams/sittings/contract";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { getRouteApi, useParams } from "@tanstack/react-router";
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
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { keepRoomCode, roomCodeOf } from "@/components/exams/sitting/scan";
import { ConvexProvider } from "@/components/providers/convex";
import { SchoolHeader } from "@/components/tenant/header";
import { clientEnv } from "@/env.public";
import { reportClientException } from "@/lib/analytics/client";
import { readSittingId } from "@/lib/tenant/params";

/** The school layout's route, which holds the school's profile. */
const schoolRoute = getRouteApi("/school/$slug");

/** Why a room's code did not let the account in. */
type JoinReason = Extract<
  typeof JoinOutcome.Type,
  { readonly outcome: "refused" }
>["reason"];

/** The sentence of each refusal, as a key of the Exams messages; each may name the school. */
const refusals = {
  NotAdmitted: "join-not-admitted",
  SeatLimit: "join-seat-limit",
  SittingNotOpen: "join-not-open",
  TokenRefused: "student-token-refused",
  TooManyTries: "student-too-many-tries",
} satisfies Record<JoinReason, string>;

/**
 * The room join of a signed-in account that is not a member of the school, on a room's address.
 * The school tree of an outsider mounts no Convex provider, so the form mounts one, signed in as
 * the account. It loads with the page, so its code stays out of the school's first JavaScript.
 */
export function OutsiderRoom() {
  return (
    <ConvexProvider convexUrl={clientEnv.VITE_CONVEX_URL}>
      <RoomJoinForm />
    </ConvexProvider>
  );
}

/**
 * The page where a member types a room's code: the school's header, one sentence, and the form, in
 * the middle of the page.
 */
export function MemberRoomJoin() {
  const t = useTranslations("Exams");

  return (
    <>
      <SchoolHeader
        items={[{ label: t("join-room-title") }]}
        title={t("join-room-title")}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
        <p className="text-balance text-center text-muted-foreground">
          {t("join-member-description")}
        </p>
        <RoomJoinForm />
      </div>
    </>
  );
}

/**
 * The token field of a room that the account joins as a student of the school. On a room's address,
 * a code the student scanned, or kept across the sign-in, is sent by itself once Convex holds the
 * account's session, and the field shows it, so a refused code reads as the one that was tried. A
 * joined account keeps the code for the room and loads the room again, now as a member, which enters
 * with it.
 */
export function RoomJoinForm() {
  const t = useTranslations("Exams");
  const { name, slug } = schoolRoute.useRouteContext().school.profile;
  const sittingId = useParams({
    select: (params) =>
      Option.getOrUndefined(readSittingId(params.sitting ?? "")),
    strict: false,
  });
  // A mutation before Convex holds the session's token fails as signed out.
  const ready = useConvexAuth(
    (auth) => !auth.isLoading && auth.isAuthenticated
  );
  const join = useMutation(exams.joins.join);
  const [token, setToken] = useState("");
  const [refusal, setRefusal] = useState<JoinReason | null>(null);
  const [joining, startJoining] = useTransition();
  const sent = useRef(false);
  const tokenId = useId();

  /** Sends one code, then loads the joined room, or shows why the code was refused. */
  const submit = useCallback(
    (code: string) => {
      setToken(code);
      startJoining(async () => {
        setRefusal(null);
        const reply = await Effect.runPromise(
          Effect.tryPromise(() =>
            join({
              slug,
              token: code,
              ...(sittingId === undefined ? {} : { sittingId }),
            })
          ).pipe(
            Effect.flatMap(Effect.fromResult),
            Effect.tapError((error) =>
              reportClientException(error, {
                source: "components/tenant/room",
              })
            ),
            Effect.option
          )
        );
        if (Option.isNone(reply)) {
          toast.error({
            description: "action-error.description",
            title: "action-error.title",
          });
          return;
        }
        if (reply.value.outcome === "refused") {
          setRefusal(reply.value.reason);
          return;
        }
        const room = `/sittings/${reply.value.sittingId}`;
        await Effect.runPromise(
          keepRoomCode(room, code).pipe(
            Effect.catchTag("RoomCodeStorageFailed", () => Effect.void)
          )
        );
        // The account is a student of the school now, so the room loads again as its member.
        window.location.assign(room);
      });
    },
    [join, sittingId, slug]
  );

  useEffect(() => {
    if (sent.current || !ready || sittingId === undefined) {
      return;
    }
    sent.current = true;
    Effect.runPromise(
      roomCodeOf(sittingId, window.location.hash).pipe(
        Effect.flatMap((code) =>
          Option.match(code, {
            onNone: () => Effect.void,
            onSome: (value) => Effect.sync(() => submit(value)),
          })
        )
      )
    );
  }, [ready, sittingId, submit]);

  /** Sends the code the student typed. */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(token.trim());
  }

  return (
    <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={onSubmit}>
      <Field>
        <FieldLabel htmlFor={tokenId}>{t("token")}</FieldLabel>
        <Input
          autoComplete="off"
          id={tokenId}
          onChange={(event) => setToken(event.currentTarget.value)}
          placeholder={t("student-token-placeholder")}
          translate="no"
          value={token}
        />
      </Field>
      {refusal === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {t(refusals[refusal], { school: name })}
        </p>
      )}
      <Button
        aria-busy={joining || undefined}
        className="w-full"
        disabled={!ready || joining}
        type="submit"
      >
        <Spinner icon={Login03Icon} isLoading={joining} />
        {t("join-room-action")}
      </Button>
    </form>
  );
}
