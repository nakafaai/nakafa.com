"use client";

import { Diamond02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

function ProButtonLoading() {
  const t = useTranslations("Pricing");

  return (
    <Button className="w-full" disabled>
      <Spinner icon={Diamond02Icon} isLoading />
      {t("pro-cta")}
    </Button>
  );
}

const LazyProCheckoutButton = dynamic(
  () =>
    import("@/components/marketing/about/pricing/checkout.client").then(
      (module) => module.ProCheckoutButton
    ),
  {
    loading: ProButtonLoading,
    ssr: false,
  }
);

/** Loads checkout behavior only when a pricing surface is actually rendered. */
export function ProButton() {
  return <LazyProCheckoutButton />;
}
