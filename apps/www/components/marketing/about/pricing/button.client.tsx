"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";

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

const BillingButton = lazy(() =>
  import("@/components/marketing/about/pricing/billing.client").then(
    ({ BillingButton: Component }) => ({ default: Component })
  )
);

/** Defers browser billing code until the pricing surface has mounted. */
export function PricingButton({ variant }: { variant: PricingButtonVariant }) {
  const mounted = useMounted();

  if (!mounted) {
    return <LoadingButton variant={variant} />;
  }

  return (
    <Suspense fallback={<LoadingButton variant={variant} />}>
      <BillingButton variant={variant} />
    </Suspense>
  );
}
