"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { lazy, Suspense } from "react";

function ProButtonLoading() {
  const t = useTranslations("Pricing");

  return (
    <Button className="w-full" disabled>
      <Spinner icon={Diamond02Icon} isLoading />
      {t("pro-cta")}
    </Button>
  );
}

const LazyProCheckoutButton = lazy(() =>
  import("@/components/marketing/about/pricing/checkout.client").then(
    ({ ProCheckoutButton }) => ({ default: ProCheckoutButton })
  )
);

/** Loads checkout behavior only when a pricing surface is actually rendered. */
export function ProButton() {
  const mounted = useMounted();

  if (!mounted) {
    return <ProButtonLoading />;
  }

  return (
    <Suspense fallback={<ProButtonLoading />}>
      <LazyProCheckoutButton />
    </Suspense>
  );
}
