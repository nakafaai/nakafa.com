import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useEarlyPress } from "@repo/design-system/hooks/press";
import { lazy } from "@repo/design-system/lib/lazy";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option } from "effect";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { useLocale, useTranslations } from "use-intl";
import { createStore } from "zustand";
import {
  type PricingButtonVariant,
  PricingButtonVariantContext,
  PricingPressContext,
  usePricingButtonVariant,
  usePricingPress,
} from "@/components/marketing/about/pricing/action";
import { useLiveSession } from "@/components/providers/live";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthOnboardingHref,
  getPostAuthProviderErrorHref,
} from "@/lib/auth/admission";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * The Pro action before the page knows the session. It is in the page's HTML at rest, so a press before
 * React takes the page over counts once React mounts it, and the action the session asks for answers it.
 */
function PendingButton() {
  const variant = usePricingButtonVariant();
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const { hold, isHeld } = usePricingPress();
  const press = useEarlyPress<HTMLButtonElement>(hold);

  return (
    <Button
      {...press}
      className="w-full"
      disabled={!isActiveLocale(locale)}
      variant={variant}
    >
      <Spinner icon={Diamond02Icon} isLoading={isHeld} />
      {t("pro-cta")}
    </Button>
  );
}

/** The billing action loads with its Convex island, so a visitor's page never loads it. */
const BillingButton = lazy(() =>
  import("@/components/marketing/about/pricing/billing").then(
    ({ BillingButton: Component }) => ({ default: Component })
  )
);

/**
 * Starts Google sign-in for a visitor. The sign-in modules load here, on the click,
 * and the result says whether the provider began the sign-in.
 */
async function startVisitorSignIn(
  callbackURL: string,
  errorCallbackURL: string
) {
  const [social, socialClient] = await Promise.all([
    import("@/lib/auth/social"),
    import("@/lib/auth/google"),
  ]);
  return Effect.runPromise(
    social
      .startGoogleSignIn(
        { callbackURL, errorCallbackURL },
        socialClient.requestGoogleSignIn
      )
      .pipe(
        Effect.tapError((error) =>
          reportClientException(error, { source: "pricing-google-sign-in" })
        ),
        Effect.isSuccess
      )
  );
}

/**
 * A visitor's Pro action starts Google sign-in. The sign-in code loads on the
 * click, so the page itself carries no Better Auth client.
 */
function VisitorButton() {
  const variant = usePricingButtonVariant();
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const [isPending, startTransition] = useTransition();
  const { isHeld, release } = usePricingPress();

  const handleSignIn = () => {
    if (!isActiveLocale(locale)) {
      return;
    }
    startTransition(async () => {
      const started = await startVisitorSignIn(
        getPostAuthOnboardingHref("/pricing", locale),
        getPostAuthProviderErrorHref("/pricing", locale)
      );
      if (!started) {
        toast.error({
          description: "provider-error.description",
          title: "provider-error.title",
        });
      }
    });
  };
  const answerPress = useEffectEvent(() => {
    release();
    handleSignIn();
  });
  useEffect(() => {
    if (isHeld) {
      answerPress();
    }
  }, [isHeld]);

  return (
    <Button
      className="w-full"
      disabled={isPending || !isActiveLocale(locale)}
      onClick={handleSignIn}
      variant={variant}
    >
      <Spinner icon={Diamond02Icon} isLoading={isPending || isHeld} />
      {t("pro-cta")}
    </Button>
  );
}

/**
 * The Pro action. A visitor gets the sign-in action. Once the page holds its
 * Convex client, the billing action mounts on that client, after the page has
 * mounted, so the first HTML and the hydration both render the visitor's action.
 */
export function PricingButton({ variant }: { variant: PricingButtonVariant }) {
  const [press] = useState(() => createStore<boolean>()(() => false));

  return (
    <PricingButtonVariantContext value={variant}>
      <PricingPressContext value={press}>
        <PricingAction />
      </PricingPressContext>
    </PricingButtonVariantContext>
  );
}

/** The variant of the Pro action that the page's session can take. */
function PricingAction() {
  const mounted = useMounted();
  const client = useLiveSession((state) => state.client);
  const isSessionPending = useLiveSession((state) => state.isPending);

  if (!mounted) {
    return <PendingButton />;
  }

  if (Option.isNone(client)) {
    // A signed-in page's session is still loading, so its Pro action waits instead of offering sign-in.
    return isSessionPending ? <PendingButton /> : <VisitorButton />;
  }

  return (
    <Suspense fallback={<PendingButton />}>
      <BillingButton client={client.value} />
    </Suspense>
  );
}
