import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useEarlyPress } from "@repo/design-system/hooks/press";
import { lazy } from "@repo/design-system/lib/lazy";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option } from "effect";
import {
  createContext,
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { type Locale, useLocale, useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";
import { useLiveSession } from "@/components/providers/live";
import { reportClientException } from "@/lib/analytics/client";
import { googleReturnAddress } from "@/lib/auth/return";
import { isActiveLocale } from "@/lib/i18n/active";

/** The emphasis of the Pro action: the page's one primary on the pricing page, secondary elsewhere. */
type PricingButtonVariant = "default" | "secondary";

/** The emphasis of the Pro action around a variant of it. */
const PricingButtonVariantContext = createContext<PricingButtonVariant | null>(
  null
);

/** Reads the emphasis of the Pro action around a variant of it. */
export function usePricingButtonVariant() {
  const variant = use(PricingButtonVariantContext);
  if (variant === null) {
    throw new Error(
      "usePricingButtonVariant must be used within PricingButton"
    );
  }
  return variant;
}

/** Whether the Pro action was pressed before the page knew what the press should do. */
const PricingPressContext = createContext<StoreApi<boolean> | null>(null);

/** Reads the press the Pro action holds, and the two ways it changes. */
export function usePricingPress() {
  const store = use(PricingPressContext);
  if (store === null) {
    throw new Error("usePricingPress must be used within PricingButton");
  }
  return {
    hold: () => store.setState(true, true),
    isHeld: useStore(store),
    release: () => store.setState(false, true),
  };
}

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
 * Starts Google sign-in for a visitor, which returns to the sign-in page and
 * resumes on pricing. The Convex and sign-in modules load here, on the click,
 * and the result says whether the sign-in left for Google.
 */
async function startVisitorSignIn(locale: Locale) {
  const [convex, auth, env] = await Promise.all([
    import("@/lib/convex/client"),
    import("@/lib/auth/signin"),
    import("@/env.public"),
  ]);
  const redirectTo = googleReturnAddress({
    intent: "/pricing",
    locale,
    origin: window.location.origin,
    school: Option.none(),
  });
  return Effect.runPromise(
    auth
      .startGoogleSignIn(
        convex.readConvexClient(env.clientEnv.VITE_CONVEX_URL),
        redirectTo
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
 * click, so the page itself carries no Convex or sign-in client.
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
      const started = await startVisitorSignIn(locale);
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
