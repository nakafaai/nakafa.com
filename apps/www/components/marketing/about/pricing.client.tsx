"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { getColorFront } from "@/components/marketing/about/utils";
import { useUser } from "@/lib/context/use-user";

export function PricingDithering({ ...props }: DitheringProps) {
  const { resolvedTheme } = useTheme();

  const colorFront = getColorFront(resolvedTheme);

  return (
    <Dithering
      className="size-full"
      colorBack="#00000000"
      colorFront={colorFront}
      rotation={180}
      scale={1.2}
      shape="wave"
      size={11}
      speed={0.15}
      type="4x4"
      {...props}
    />
  );
}

export function ProButton() {
  const t = useTranslations("Pricing");

  const [isPending, startTransition] = useTransition();

  const currentUser = useUser((state) => state.user);

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    currentUser ? { productId: products.pro.id } : "skip"
  );
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );
  const generateCustomerPortalUrl = useAction(
    api.customers.actions.generateCustomerPortalUrl
  );

  const handleCheckout = () => {
    startTransition(async () => {
      const { url } = await generateCheckoutLink({
        productIds: [products.pro.id],
        successUrl: window.location.href,
      });
      window.open(url, "_blank");
    });
  };

  const handleManageSubscription = () => {
    startTransition(async () => {
      const { url } = await generateCustomerPortalUrl({});
      window.open(url, "_blank");
    });
  };

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={hasSubscription ? handleManageSubscription : handleCheckout}
    >
      <Spinner icon={Diamond02Icon} isLoading={isPending} />
      {t("pro-cta")}
    </Button>
  );
}
