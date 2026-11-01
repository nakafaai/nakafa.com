import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useEarlyPress } from "@repo/design-system/hooks/use-press";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { LOCALES } from "@repo/internationalization/src/locale";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option, Schema } from "effect";
import { useEffect, useEffectEvent } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { TryoutPageLink } from "@/components/tryout/route/link";
import {
  getTryoutPageHref,
  getTryoutPageTarget,
  getTryoutPublicPathHref,
  type TryoutPageAddress,
  TryoutPageAddressSchema,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  useSetTryoutStartPhase,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import { START_ERROR, START_PART_ERROR } from "@/components/tryout/set/copy";
import { TryoutStartDialog } from "@/components/tryout/set/dialog";
import type { CurrentAttempt } from "@/components/tryout/set/model";
import {
  startAttemptProgram,
  startEntrySectionProgram,
} from "@/components/tryout/set/program";
import { hasSignedInHint } from "@/lib/auth/hint";
import { requireConvexOnline } from "@/lib/convex/online";

type StartAttempt = Pick<
  CurrentAttempt,
  "attemptId" | "resumeSectionKey" | "status"
> | null;
const StartTryoutRequestSchema = Schema.Struct({
  authRedirect: TryoutPageAddressSchema,
  countryKey: Schema.String,
  destination: TryoutPageAddressSchema,
  /** The section whose page the start lands on; none lands on the set. */
  destinationSectionKey: Schema.optionalKey(Schema.String),
  /** The section the start opens, whose player shows with the press; none opens no section. */
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
 * Composes the active attempt link or the transactional start action. A running
 * attempt whose start lands on a section's page continues there through a link,
 * and one whose page is the set starts its entry section from here. A visitor
 * has no client, so the start action mounts once the page holds one, and until
 * then the visitor's button sends the visitor to sign in.
 */
export function StartTryoutButton(props: StartTryoutButtonProps) {
  if (
    props.attempt?.status === "in-progress" &&
    props.request.destinationSectionKey !== undefined
  ) {
    return <ResumeTryoutLink request={props.request} />;
  }
  return (
    <ConvexIsland
      fallback={
        <TryoutStartSignInButton
          label={startLabelOf(props.attempt)}
          request={props.request}
        />
      }
      keepsPress
    >
      <TryoutStartAction {...props} />
    </ConvexIsland>
  );
}

/**
 * The label of a set's start action for its attempt: continue a running one, restart a finished one, and
 * start one otherwise. The button the page shows before its client and the live action read it alike, so the
 * label never changes when the client arrives.
 */
function startLabelOf(attempt: StartTryoutButtonProps["attempt"]) {
  if (attempt?.status === "in-progress") {
    return "continue-cta";
  }
  return attempt ? "restart-cta" : "start-cta";
}

/**
 * The start button before the page holds its client. It is in the page's HTML, so a press before React
 * takes the page over counts once React mounts it. A visitor's press goes to sign in with the page as the
 * return address. A press on a page whose hint says a session may exist shows the loader, and the live
 * action answers it once it mounts; a session that could not be read sends it to sign in.
 */
function TryoutStartSignInButton({
  label,
  request,
}: {
  readonly label: ReturnType<typeof startLabelOf>;
  readonly request: StartTryoutRequest;
}) {
  const navigate = useNavigate();
  const t = useTranslations("Tryouts");
  const hasError = useLiveSession((state) => state.hasError);
  const phase = useTryoutStartPhase();
  const setPhase = useSetTryoutStartPhase();
  const authRedirect = `/${request.locale}${getTryoutPageHref(request.authRedirect)}`;

  /** Sends a visitor to sign in before any attempt starts. */
  function signIn() {
    navigate({
      params: { locale: request.locale },
      search: { redirect: authRedirect },
      to: "/$locale/auth",
    });
  }
  /** Answers a press: at once for a visitor, and once the session is known for a learner. */
  function onStart() {
    if (hasSignedInHint(document.cookie) && !hasError) {
      setPhase("pressed");
      return;
    }
    signIn();
  }
  const press = useEarlyPress<HTMLButtonElement>(onStart);
  const answerPress = useEffectEvent(() => {
    setPhase("idle");
    signIn();
  });
  useEffect(() => {
    if (phase === "pressed" && hasError) {
      answerPress();
    }
  }, [hasError, phase]);

  return (
    <Button {...press}>
      <Spinner icon={Rocket01Icon} isLoading={phase === "pressed"} />
      {t(label)}
    </Button>
  );
}

/**
 * Starts or resumes a free try-out from the current page. The button rests on its own icon while the page
 * reads what the start needs, and a press in that moment turns the icon into the loader and is answered
 * once the read arrives, so no press is lost on a slow network. The confirmation closes with the press, and
 * a start that opens a section has its page draw the player at once (`TryoutStartProvider`), so the wait
 * for the server shows as the player opening; a start that fails returns the page and says so.
 */
function TryoutStartAction({ attempt, request }: StartTryoutButtonProps) {
  const navigate = useNavigate();
  const phase = useTryoutStartPhase();
  const setPhase = useSetTryoutStartPhase();
  /** Navigates to one try-out page. A page that names no route leaves the page on screen, and its start idle. */
  function navigateTo(
    address: TryoutPageAddress,
    options: { readonly replace?: boolean } = {}
  ) {
    Option.match(getTryoutPageTarget(address), {
      onNone: () => setPhase("idle"),
      onSome: (target) =>
        navigate({ ...target, replace: options.replace ?? false }),
    });
  }
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const startAttempt = useMutation(tryouts.mutations.attempts.startAttempt);
  const startSection = useMutation(tryouts.mutations.sections.start);
  const convex = useConvex();
  const t = useTranslations("Tryouts");
  const now = useTryoutClock(false);
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
  const pressed = phase === "pressed";
  const started = phase === "starting" || phase === "opening";
  const dialogKind = QueryResult.isSuccess(access)
    ? access.value.kind
    : "free-attempt";
  const buttonLabel = t(startLabelOf(attempt));
  const authRedirect = `/${request.locale}${getTryoutPageHref(request.authRedirect)}`;

  /** Opens the correct decision or continues an already-active runtime, once the page knows which. */
  function answerStart() {
    if (started) {
      return;
    }
    if (resolvingAccess) {
      setPhase("pressed");
      return;
    }
    if (pressed) {
      setPhase("idle");
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
      setPhase("opening");
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
          ),
          // Convex shows a mutation's result to the page's queries before it answers, so the section
          // runs on the page by now, or it failed and the page returns.
          Effect.ensuring(Effect.sync(() => setPhase("idle")))
        )
      );
      return;
    }
    dialog.open();
  }

  /**
   * Starts the attempt transactionally after confirmation. The confirmation closes at once, and the page
   * moves to the attempt's address once the server answers; until then a start that opens a section shows
   * its player, and any other start holds its button.
   */
  function onPrimary() {
    if (started) {
      return;
    }
    dialog.close();
    setPhase(directEntry ? "opening" : "starting");
    const program = startAttemptProgram({
      args: {
        countryKey: request.countryKey,
        ...(request.destinationSectionKey === undefined
          ? {}
          : { destinationSectionKey: request.destinationSectionKey }),
        ...(request.entrySectionKey === undefined
          ? {}
          : { entrySectionKey: request.entrySectionKey }),
        examKey: request.examKey,
        locale: request.locale,
        setKey: request.setKey,
        trackKey: request.trackKey,
      },
      failureMessage: START_ERROR,
      mutation: startAttempt,
      onFailure: Effect.sync(() => setPhase("idle")),
      onSuccess: (result) =>
        Effect.sync(() => {
          const destination = {
            attemptId: result.attemptId,
            publicPath: result.navigation.publicPath,
          };
          if (request.successNavigation === "stay") {
            navigateTo(destination, { replace: true });
            return;
          }
          navigateTo(destination);
        }),
    });
    Effect.runPromise(
      requireConvexOnline(convex).pipe(
        Effect.andThen(program),
        Effect.catchTag("ConvexOfflineError", () =>
          Effect.sync(() => {
            toast.error(START_ERROR, { position: "bottom-center" });
            setPhase("idle");
          })
        )
      )
    );
  }
  const answerPress = useEffectEvent(() => answerStart());
  useEffect(() => {
    if (pressed && !resolvingAccess) {
      answerPress();
    }
  }, [pressed, resolvingAccess]);

  return (
    <>
      <Button inert={started} onClick={answerStart}>
        <Spinner icon={Rocket01Icon} isLoading={started || pressed} />
        {buttonLabel}
      </Button>
      <TryoutStartDialog
        directEntry={directEntry}
        finishedAttempt={finishedAttempt}
        kind={dialogKind}
        onCancel={dialog.close}
        onPrimary={onPrimary}
        open={dialogOpen}
        setOpen={(open) => {
          if (open) {
            answerStart();
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
  const pathname = `/${request.locale}${getTryoutPublicPathHref(request.destination.publicPath)}`;
  // The section loads on the server before it shows, so the link shows its loader while it does.
  const navigating = useRouterState({
    select: (state) =>
      state.status === "pending" && state.location.pathname === pathname,
  });
  return (
    <TryoutPageLink className={buttonVariants()} {...request.destination}>
      <Spinner icon={Rocket01Icon} isLoading={navigating} />
      {t("continue-cta")}
    </TryoutPageLink>
  );
}
