"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";

function LoadingButton() {
  const t = useTranslations("Pricing");

  return (
    <Button className="w-full" disabled>
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
export function PricingButton() {
  const mounted = useMounted();

  if (!mounted) {
    return <LoadingButton />;
  }

  return (
    <Suspense fallback={<LoadingButton />}>
      <BillingButton />
    </Suspense>
  );
}
