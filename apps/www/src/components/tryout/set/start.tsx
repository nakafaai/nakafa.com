import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { TryoutStartAccess } from "@repo/backend/confect/tryouts/start/spec";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useEarlyPress } from "@repo/design-system/hooks/press";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { LOCALES } from "@repo/internationalization/src/locale";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { useConvexAuth } from "@/components/auth/convex";
import { keptStorage } from "@/components/player/storage";
import { ConvexIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { TryoutPageLink } from "@/components/tryout/route/link";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import {
  getTryoutPageHref,
  getTryoutPageTarget,
  getTryoutPublicPathHref,
  TryoutPageAddressSchema,
} from "@/components/tryout/route/path";
import {
  useAnswerPress,
  useSetTryoutPressed,
  useSetTryoutPressIntent,
  useTryoutPressed,
  useTryoutPressIntent,
  useTryoutStart,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import { START_ERROR } from "@/components/tryout/set/copy";
import { TryoutStartDialog } from "@/components/tryout/set/dialog";
import type { TryoutActionNameKey } from "@/components/tryout/set/kept";
import {
  keepActionName,
  readKeptName,
  tryoutActionNameOf,
} from "@/components/tryout/set/kept";
import type { CurrentAttempt, TryoutPart } from "@/components/tryout/set/model";
import { TryoutPartSchema } from "@/components/tryout/set/model";
import { TryoutActionName } from "@/components/tryout/set/name";
import {
  ContinueTryoutButton,
  TryoutPartStartDialog,
  useStartPart,
} from "@/components/tryout/set/part";
import { startAttemptProgram } from "@/components/tryout/set/program";
import { hasSignedInHint } from "@/lib/auth/hint";
import { requireConvexOnline } from "@/lib/convex/online";

type StartAttempt = Pick<
  CurrentAttempt,
  "activeSectionKey" | "attemptId" | "resumeSectionKey" | "status"
> | null;
const StartTryoutRequestSchema = Schema.Struct({
  authRedirect: TryoutPageAddressSchema,
  countryKey: Schema.String,
  destination: TryoutPageAddressSchema,
  /** The part whose page the start lands on; none lands on the set. */
  destinationPart: Schema.optionalKey(TryoutPartSchema),
  /** Single-section direct-entry part facts, shown in the start confirmation dialog. */
  entryPart: Schema.optionalKey(TryoutPartSchema),
  /** The section the start opens, whose player shows on the page the start lands on; none opens no section. */
  entrySectionKey: Schema.optionalKey(Schema.String),
  examKey: Schema.String,
  locale: Schema.Literals(LOCALES),
  setKey: Schema.String,
  /** The set's own page, whose action this start changes. */
  setPath: Schema.String,
  successNavigation: Schema.Literals(["destination", "stay"]),
  trackKey: Schema.String,
});

export type StartTryoutRequest = typeof StartTryoutRequestSchema.Type;
interface StartTryoutButtonProps {
  attempt?: StartAttempt | undefined;
  request: StartTryoutRequest;
}

/**
 * Composes the action that continues a running attempt, or the transactional start action. A running
 * attempt whose start lands on a section's page continues there: through a link to the section that runs,
 * or through a confirmation dialog before starting the next part's clock. One whose page is the set starts
 * its entry section from here. A visitor has no client, so the start action mounts once the page holds one,
 * and until then the visitor's button sends the visitor to sign in.
 */
export function StartTryoutButton(props: StartTryoutButtonProps) {
  const { attempt, request } = props;
  if (
    attempt?.status === "in-progress" &&
    request.destinationPart !== undefined
  ) {
    if (attempt.activeSectionKey === request.destinationPart.sectionKey) {
      return <ResumeTryoutLink request={request} />;
    }
    return (
      <ConvexIsland fallback={<ResumeTryoutLink request={request} />}>
        <ContinueTryoutButton
          address={request.destination}
          attemptId={attempt.attemptId}
          part={request.destinationPart}
        />
      </ConvexIsland>
    );
  }
  return (
    <ConvexIsland
      fallback={
        <TryoutStartSignInButton request={props.request}>
          <TryoutActionName
            keptAt={setAddressOf(props.request)}
            name={tryoutActionNameOf(props.attempt)}
          />
        </TryoutStartSignInButton>
      }
      keepsPress
    >
      <TryoutStartAction {...props} />
    </ConvexIsland>
  );
}

/** The address of the set's own page, which its action's kept name is read and kept by. */
function setAddressOf(request: StartTryoutRequest) {
  return `/${request.locale}${getTryoutPublicPathHref(request.setPath)}`;
}

/**
 * The name this browser last read for the set at `address`, for the moment the live action mounts and
 * its read has not answered. It reads the browser's storage, so only the live action asks, and storage
 * the page cannot read keeps nothing.
 */
function readSetName(address: string) {
  return Effect.runSync(
    readKeptName(address).pipe(
      Effect.provide(keptStorage),
      Effect.orElseSucceed(() => Option.none())
    )
  );
}

/**
 * The start button before the page holds its client. It is in the page's HTML, so a press before React
 * takes the page over counts once React mounts it. A visitor's press goes to sign in with the page as the
 * return address. A press on a page whose hint says a session may exist shows the loader, and the live
 * action answers it once it mounts; a session that could not be read sends it to sign in.
 */
function TryoutStartSignInButton({
  children,
  request,
}: {
  /** The action's name, which the attempt decides. */
  readonly children: ReactNode;
  readonly request: StartTryoutRequest;
}) {
  const navigate = useNavigate();
  const hasError = useLiveSession((state) => state.hasError);
  const pressed = useTryoutPressed();
  const setPressed = useSetTryoutPressed();
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
      setPressed(true);
      return;
    }
    signIn();
  }
  const press = useEarlyPress<HTMLButtonElement>(onStart);
  const answerPress = useEffectEvent(() => {
    setPressed(false);
    signIn();
  });
  // A press another part of the page made waits here too, such as a part of the set's path: a visitor's goes
  // to sign in at once, and a learner's once their session failed to load.
  useEffect(() => {
    if (pressed && (hasError || !hasSignedInHint(document.cookie))) {
      answerPress();
    }
  }, [hasError, pressed]);

  return (
    <Button {...press}>
      <Spinner icon={Rocket01Icon} isLoading={pressed} />
      {children}
    </Button>
  );
}

/** Builds the startAttempt mutation arguments from one start request, optionally starting one chosen part. */
function startArgsOf(
  request: StartTryoutRequest,
  chosenPart?: TryoutPart | undefined
) {
  const destinationSectionKey =
    chosenPart?.sectionKey ?? request.destinationPart?.sectionKey;
  const entrySectionKey = chosenPart?.sectionKey ?? request.entrySectionKey;
  return {
    countryKey: request.countryKey,
    ...(destinationSectionKey === undefined ? {} : { destinationSectionKey }),
    ...(entrySectionKey === undefined ? {} : { entrySectionKey }),
    examKey: request.examKey,
    locale: request.locale,
    setKey: request.setKey,
    trackKey: request.trackKey,
  };
}

/** Derives the button's loading state, kept label, and dialog mode from the attempt and access reads. */
function resolveStartState({
  access,
  address,
  attempt,
  isAuthenticated,
  isLoading,
  keptName,
}: {
  readonly access: QueryResult.QueryResult<TryoutStartAccess, unknown>;
  readonly address: string;
  readonly attempt: StartAttempt | undefined;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly keptName: Option.Option<TryoutActionNameKey>;
}) {
  const activeAttempt = attempt?.status === "in-progress";
  const finishedAttempt = Boolean(attempt && !activeAttempt);
  const accessLoading =
    isAuthenticated && !activeAttempt && !QueryResult.isSuccess(access);
  const attemptLoading = isAuthenticated && attempt === undefined;
  const waitingAttempt =
    (isLoading || attemptLoading) && Option.isNone(keptName);
  return {
    dialogKind: QueryResult.isSuccess(access)
      ? access.value.kind
      : ("free-attempt" as const),
    finishedAttempt,
    keptAt: waitingAttempt ? address : undefined,
    name:
      attempt === undefined
        ? Option.getOrElse(keptName, () => tryoutActionNameOf(attempt))
        : tryoutActionNameOf(attempt),
    resolvingAccess: isLoading || accessLoading || attemptLoading,
    waitingAttempt,
  };
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
  const start = useTryoutStart();
  const pressIntent = useTryoutPressIntent();
  const setPressIntent = useSetTryoutPressIntent();
  const pressed = pressIntent.kind !== "idle";
  /** Navigates to one try-out page. A page that names no route leaves the page on screen, and its start idle. */
  function navigateTo(
    address: TryoutPageAddress,
    options: { readonly replace?: boolean } = {}
  ) {
    Option.match(getTryoutPageTarget(address), {
      onNone: start.end,
      onSome: (target) => {
        start.lead(target);
        navigate({ ...target, replace: options.replace ?? false });
      },
    });
  }
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const startAttempt = useMutation(tryouts.mutations.attempts.startAttempt);
  const startPart = useStartPart();
  const convex = useConvex();
  const [dialogOpen, dialog] = useDisclosure(false);
  const address = setAddressOf(request);
  const [keptName] = useState(() => readSetName(address));
  const entrySectionKey = request.entrySectionKey;
  const access = useQuery(
    tryouts.queries.access.getStartAccess,
    isAuthenticated && attempt?.status !== "in-progress" ? {} : "skip"
  );
  if (QueryResult.isFailure(access)) {
    throw access.error;
  }
  const state = resolveStartState({
    access,
    address,
    attempt,
    isAuthenticated,
    isLoading,
    keptName,
  });
  const started = phase !== "idle";
  const authRedirect = `/${request.locale}${getTryoutPageHref(request.authRedirect)}`;
  const chosenPart =
    !(started || state.resolvingAccess) &&
    isAuthenticated &&
    attempt?.status !== "in-progress" &&
    pressIntent.kind === "part"
      ? pressIntent.part
      : null;
  const waitingPress =
    pressIntent.kind === "set" ||
    (pressIntent.kind === "part" && chosenPart === null);

  /** Opens the correct decision or continues an already-active runtime, once the page knows which. */
  function answerStart() {
    if (started) {
      return;
    }
    if (state.resolvingAccess) {
      if (pressIntent.kind === "idle") {
        setPressIntent({ kind: "set" });
      }
      return;
    }
    if (pressed) {
      setPressIntent({ kind: "idle" });
    }
    if (!isAuthenticated) {
      navigate({
        params: { locale: request.locale },
        search: { redirect: authRedirect },
        to: "/$locale/auth",
      });
      return;
    }
    if (attempt?.status === "in-progress" && entrySectionKey !== undefined) {
      startPart({
        address: Option.none(),
        attemptId: attempt.attemptId,
        sectionKey: attempt.resumeSectionKey ?? entrySectionKey,
      });
      return;
    }
    dialog.open();
  }

  /** Starts the attempt transactionally after confirmation, either into the lobby or one chosen section. */
  function runStart(targetPart: TryoutPart | null) {
    if (started) {
      return;
    }
    dialog.close();
    setPressIntent({ kind: "idle" });
    const opensSection = targetPart !== null || entrySectionKey !== undefined;
    start.begin(
      opensSection ? "opening" : "starting",
      targetPart ?? request.entryPart ?? null
    );
    const program = startAttemptProgram({
      args: startArgsOf(request, targetPart ?? undefined),
      failureMessage: START_ERROR,
      mutation: startAttempt,
      onFailure: Effect.sync(start.end),
      onSuccess: (result) =>
        // The attempt runs from here on, whichever page the learner next loads the set from.
        keepActionName(address, "continue-cta").pipe(
          Effect.andThen(
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
            })
          )
        ),
    });
    Effect.runPromise(
      requireConvexOnline(convex).pipe(
        Effect.andThen(program),
        Effect.catchTag("ConvexOfflineError", () =>
          Effect.sync(() => {
            toast.error(START_ERROR, { position: "bottom-center" });
            start.end();
          })
        )
      )
    );
  }
  const answerPress = useEffectEvent(() => answerStart());
  useEffect(() => {
    if (waitingPress && !state.resolvingAccess) {
      answerPress();
    }
  }, [waitingPress, state.resolvingAccess]);

  return (
    <>
      <Button
        disabled={state.waitingAttempt}
        inert={started}
        onClick={answerStart}
      >
        <Spinner icon={Rocket01Icon} isLoading={started || waitingPress} />
        <TryoutActionName keptAt={state.keptAt} name={state.name} />
      </Button>
      <TryoutStartDialog
        entryPart={request.entryPart}
        finishedAttempt={state.finishedAttempt}
        kind={state.dialogKind}
        onPrimary={() => runStart(null)}
        open={dialogOpen}
        pagePath={request.authRedirect.publicPath}
        setOpen={(open) => {
          if (open) {
            answerStart();
            return;
          }
          dialog.close();
        }}
      />
      {chosenPart === null ? null : (
        <TryoutPartStartDialog
          busy={started}
          onStart={() => runStart(chosenPart)}
          open
          part={chosenPart}
          setOpen={(open) => {
            if (!open) {
              setPressIntent({ kind: "idle" });
            }
          }}
        />
      )}
    </>
  );
}

/** Links to the next section of the active attempt. */
function ResumeTryoutLink({
  request,
}: {
  readonly request: StartTryoutRequest;
}) {
  const navigate = useNavigate();
  const pathname = `/${request.locale}${getTryoutPublicPathHref(request.destination.publicPath)}`;
  useAnswerPress(() => {
    Option.map(getTryoutPageTarget(request.destination), (target) =>
      navigate(target)
    );
  });
  // The section loads on the server before it shows, so the link shows its loader while it does.
  const navigating = useRouterState({
    select: (state) =>
      state.status === "pending" && state.location.pathname === pathname,
  });
  return (
    <TryoutPageLink
      className={buttonVariants({ variant: "default" })}
      {...request.destination}
    >
      <Spinner icon={Rocket01Icon} isLoading={navigating} />
      <TryoutActionName name="continue-cta" />
    </TryoutPageLink>
  );
}
