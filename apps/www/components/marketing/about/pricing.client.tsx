"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useIntersection } from "@mantine/hooks";
import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getThemeShaderColor } from "@repo/design-system/lib/theme/registry";
import { useAction } from "convex/react";
import { Effect } from "effect";
import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { authClient } from "@/lib/auth/client";
import { useUser } from "@/lib/context/use-user";
import { isActiveLocale } from "@/lib/i18n/active";

export function PricingDithering({ ...props }: DitheringProps) {
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "240px",
    threshold: 0.01,
  });
  const { resolvedTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion() ?? false;

  const colorFront = getThemeShaderColor(resolvedTheme);

  return (
    <div className="size-full" ref={ref}>
      {entry?.isIntersecting ? (
        <Dithering
          className="size-full"
          colorBack="rgba(0, 0, 0, 0)"
          colorFront={colorFront}
          rotation={180}
          scale={1.2}
          shape="wave"
          size={11}
          type="4x4"
          {...props}
          speed={shouldReduceMotion ? 0 : (props.speed ?? 0.15)}
        />
      ) : null}
    </div>
  );
}

export function ProButton() {
  const locale = useLocale();
  const t = useTranslations("Pricing");
  const pricingCallbackURL = `/${locale}/pricing`;

  const [isPending, startTransition] = useTransition();

  const currentUser = useUser((state) => state.user);

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    currentUser ? { productId: products.pro.id } : "skip"
  );
  const generateCustomerPortalUrl = useAction(
    api.customers.actions.public.generateCustomerPortalUrl
  );
  const generateCheckoutLink = useAction(
    api.customers.actions.public.generateCheckoutLink
  );

  const handleCheckout = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    const program = currentUser
      ? Effect.tryPromise(() =>
          generateCheckoutLink({ locale, successUrl: window.location.href })
        ).pipe(
          Effect.tap(({ url }) =>
            Effect.sync(() => {
              window.location.href = url;
            })
          ),
          Effect.asVoid
        )
      : Effect.tryPromise(() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: pricingCallbackURL,
          })
        ).pipe(Effect.asVoid);
    startTransition(() => Effect.runPromise(program));
  };

  const handleManageSubscription = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    const program = Effect.tryPromise(() => generateCustomerPortalUrl({})).pipe(
      Effect.tap(({ url }) =>
        Effect.sync(() => {
          window.location.href = url;
        })
      ),
      Effect.asVoid
    );
    startTransition(() => Effect.runPromise(program));
  };

  return (
    <Button
      className="w-full"
      disabled={isPending || !isActiveLocale(locale)}
      onClick={hasSubscription ? handleManageSubscription : handleCheckout}
    >
      <Spinner icon={Diamond02Icon} isLoading={isPending} />
      {t("pro-cta")}
    </Button>
  );
}
