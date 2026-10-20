"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { lazy, Suspense, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useLiveSession } from "@/components/providers/live";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthOnboardingHref,
  getPostAuthProviderErrorHref,
} from "@/lib/auth/admission";
import { isActiveLocale } from "@/lib/i18n/active";

/** The emphasis of the Pro action: the page's one primary on the pricing page, secondary elsewhere. */
export type PricingButtonVariant = "default" | "secondary";

function LoadingButton({ variant }: { variant: PricingButtonVariant }) {
  const t = useTranslations("Pricing");

  return (
    <Button className="w-full" disabled variant={variant}>
      <Spinner icon={Diamond02Icon} isLoading />
      {t("pro-cta")}
    </Button>
  );
}

/** The billing action loads with its Convex island, so a visitor's page never loads it. */
const BillingButton = lazy(() =>
  import("@/components/marketing/about/pricing/billing.client").then(
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
    import("@/lib/auth/social.client"),
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
        Effect.match({
          onFailure: () => false,
          onSuccess: () => true,
        })
      )
  );
}

/**
 * A visitor's Pro action starts Google sign-in. The sign-in code loads on the
 * click, so the page itself carries no Better Auth client.
 */
function VisitorButton({ variant }: { variant: PricingButtonVariant }) {
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const [isPending, startTransition] = useTransition();

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

  return (
    <Button
      className="w-full"
      disabled={isPending || !isActiveLocale(locale)}
      onClick={handleSignIn}
      variant={variant}
    >
      <Spinner icon={Diamond02Icon} isLoading={isPending} />
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
  const mounted = useMounted();
  const client = useLiveSession((state) => state.client);

  if (!mounted) {
    return <LoadingButton variant={variant} />;
  }

  if (client === null) {
    return <VisitorButton variant={variant} />;
  }

  return (
    <Suspense fallback={<LoadingButton variant={variant} />}>
      <BillingButton client={client} variant={variant} />
    </Suspense>
  );
}
