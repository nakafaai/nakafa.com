import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { HrefLink, useHrefNavigate } from "@repo/internationalization/src/link";
import { LOCALES } from "@repo/internationalization/src/locale";
import { useNavigate } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Schema } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { START_ERROR, START_PART_ERROR } from "@/components/tryout/set/copy";
import { TryoutStartDialog } from "@/components/tryout/set/dialog";
import type { CurrentAttempt } from "@/components/tryout/set/model";
import {
  startAttemptProgram,
  startEntrySectionProgram,
} from "@/components/tryout/set/program";
import { requireConvexOnline } from "@/lib/convex/online";

type StartAttempt = Pick<
  CurrentAttempt,
  "attemptId" | "resumeSectionKey" | "status"
> | null;
const StartTryoutRequestSchema = Schema.Struct({
  authRedirectHref: Schema.String,
  countryKey: Schema.String,
  destinationHref: Schema.String,
  destinationSectionKey: Schema.String,
  entrySectionKey: Schema.optionalKey(Schema.String),
  examKey: Schema.String,
  locale: Schema.Literals(LOCALES),
  setKey: Schema.String,
  successNavigation: Schema.Literals(["destination", "stay"]),
  trackKey: Schema.String,
});

export type StartTryoutRequest = typeof StartTryoutRequestSchema.Type;
interface StartTryoutButtonProps {
  attempt?: StartAttempt | undefined;
  request: StartTryoutRequest;
}

/**
 * Composes the active attempt link or the transactional start action. A visitor
 * has no client, so the start action mounts once the page holds one, and until
 * then the visitor's button sends the visitor to sign in.
 */
export function StartTryoutButton(props: StartTryoutButtonProps) {
  if (
    props.attempt?.status === "in-progress" &&
    !props.request.entrySectionKey
  ) {
    return <ResumeTryoutLink request={props.request} />;
  }
  return (
    <ConvexIsland
      fallback={
        <TryoutStartSignInButton
          finished={Boolean(props.attempt)}
          request={props.request}
        />
      }
    >
      <TryoutStartAction {...props} />
    </ConvexIsland>
  );
}

/** A visitor's start button: it sends the visitor to sign in with the page as the return address. */
function TryoutStartSignInButton({
  finished,
  request,
}: {
  readonly finished: boolean;
  readonly request: StartTryoutRequest;
}) {
  const navigate = useNavigate();
  const t = useTranslations("Tryouts");
  const authRedirect = `/${request.locale}${request.authRedirectHref}`;

  /** Sends a visitor to sign in before any attempt starts. */
  function onStart() {
    navigate({
      params: { locale: request.locale },
      search: { redirect: authRedirect },
      to: "/$locale/auth",
    });
  }

  return (
    <Button onClick={onStart}>
      <HugeIcons icon={Rocket01Icon} />
      {t(finished ? "restart-cta" : "start-cta")}
    </Button>
  );
}

/** Starts or resumes a free try-out from the current page. */
function TryoutStartAction({ attempt, request }: StartTryoutButtonProps) {
  const navigate = useNavigate();
  const navigateToHref = useHrefNavigate();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const startAttempt = useMutation(tryouts.mutations.attempts.startAttempt);
  const startSection = useMutation(tryouts.mutations.sections.start);
  const convex = useConvex();
  const t = useTranslations("Tryouts");
  const now = useTryoutClock(false);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, dialog] = useDisclosure(false);
  const activeAttempt = attempt?.status === "in-progress";
  const finishedAttempt = Boolean(attempt && !activeAttempt);
  const directEntry = Boolean(request.entrySectionKey);
  const access = useQuery(
    tryouts.queries.access.getStartAccess,
    isAuthenticated && !activeAttempt
      ? {
          countryKey: request.countryKey,
          examKey: request.examKey,
          locale: request.locale,
          now,
          setKey: request.setKey,
          trackKey: request.trackKey,
        }
      : "skip"
  );
  if (QueryResult.isFailure(access)) {
    throw access.error;
  }
  const accessLoading =
    isAuthenticated && !activeAttempt && !QueryResult.isSuccess(access);
  const attemptLoading = isAuthenticated && attempt === undefined;
  const resolvingAccess = isLoading || accessLoading || attemptLoading;
  const busy = isPending || resolvingAccess;
  const dialogKind = QueryResult.isSuccess(access)
    ? access.value.kind
    : "free-attempt";
  const buttonLabel = activeAttempt
    ? t("continue-cta")
    : t(finishedAttempt ? "restart-cta" : "start-cta");
  const authRedirect = `/${request.locale}${request.authRedirectHref}`;

  /** Opens the correct decision or continues an already-active runtime. */
  function onStart() {
    if (busy) {
      return;
    }
    if (!isAuthenticated) {
      navigate({
        params: { locale: request.locale },
        search: { redirect: authRedirect },
        to: "/$locale/auth",
      });
      return;
    }
    if (attempt?.status === "in-progress" && request.entrySectionKey) {
      const sectionKey = attempt.resumeSectionKey ?? request.entrySectionKey;
      startTransition(() =>
        Effect.runPromise(
          requireConvexOnline(convex).pipe(
            Effect.andThen(
              startEntrySectionProgram({
                attemptId: attempt.attemptId,
                failureMessage: START_PART_ERROR,
                mutation: startSection,
                sectionKey,
              })
            ),
            Effect.catchTag("ConvexOfflineError", () =>
              Effect.sync(() => {
                toast.error(START_PART_ERROR, { position: "bottom-center" });
              })
            )
          )
        )
      );
      return;
    }
    dialog.open();
  }

  /** Starts the attempt transactionally after confirmation. */
  function onPrimary() {
    if (busy) {
      return;
    }
    const program = startAttemptProgram({
      args: {
        countryKey: request.countryKey,
        ...(directEntry
          ? {}
          : {
              destinationSectionKey: request.destinationSectionKey,
            }),
        ...(request.entrySectionKey === undefined
          ? {}
          : {
              entrySectionKey: request.entrySectionKey,
            }),
        examKey: request.examKey,
        locale: request.locale,
        setKey: request.setKey,
        trackKey: request.trackKey,
      },
      failureMessage: START_ERROR,
      mutation: startAttempt,
      onSuccess: (result) =>
        Effect.sync(() => {
          dialog.close();
          const href = getTryoutAttemptHref(
            result.navigation.publicPath,
            result.attemptId
          );
          if (request.successNavigation === "stay") {
            navigateToHref(href, { replace: true });
            return;
          }
          navigateToHref(href);
        }),
    });
    startTransition(() =>
      Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.andThen(program),
          Effect.catchTag("ConvexOfflineError", () =>
            Effect.sync(() => {
              toast.error(START_ERROR, { position: "bottom-center" });
            })
          )
        )
      )
    );
  }
  return (
    <>
      <Button inert={busy} onClick={onStart}>
        <HugeIcons icon={Rocket01Icon} />
        {buttonLabel}
      </Button>
      <TryoutStartDialog
        busy={isPending}
        directEntry={directEntry}
        finishedAttempt={finishedAttempt}
        kind={dialogKind}
        onCancel={dialog.close}
        onPrimary={onPrimary}
        open={dialogOpen}
        setOpen={(open) => {
          if (open) {
            onStart();
            return;
          }
          dialog.close();
        }}
      />
    </>
  );
}

/** Links to the next section of the active attempt. */
function ResumeTryoutLink({
  request,
}: {
  readonly request: StartTryoutRequest;
}) {
  const t = useTranslations("Tryouts");
  return (
    <HrefLink className={buttonVariants()} href={request.destinationHref}>
      <HugeIcons icon={Rocket01Icon} />
      {t("continue-cta")}
    </HrefLink>
  );
}
