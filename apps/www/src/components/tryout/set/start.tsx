import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { LOCALES } from "@repo/internationalization/src/locale";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
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

/** A visitor's start button: it sends the visitor to sign in with the page as the return address. */
function TryoutStartSignInButton({
  label,
  request,
}: {
  readonly label: ReturnType<typeof startLabelOf>;
  readonly request: StartTryoutRequest;
}) {
  const navigate = useNavigate();
  const t = useTranslations("Tryouts");
  const authRedirect = `/${request.locale}${getTryoutPageHref(request.authRedirect)}`;

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
      {t(label)}
    </Button>
  );
}

/**
 * Starts or resumes a free try-out from the current page. The confirmation closes with the press, and a
 * start that opens a section has its page draw the player at once (`TryoutStartProvider`), so the wait
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
  const busy = phase !== "idle" || resolvingAccess;
  const dialogKind = QueryResult.isSuccess(access)
    ? access.value.kind
    : "free-attempt";
  const buttonLabel = t(startLabelOf(attempt));
  const authRedirect = `/${request.locale}${getTryoutPageHref(request.authRedirect)}`;

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
    if (busy) {
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
  return (
    <>
      <Button inert={busy} onClick={onStart}>
        <Spinner icon={Rocket01Icon} isLoading={busy} />
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
