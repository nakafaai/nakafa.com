"use client";

import {
  Alert02Icon,
  PartyIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useLocale, useTranslations } from "next-intl";
import { Activity } from "react";
import { CHAT_ERRORS } from "@/app/api/chat/constants";
import { useChat } from "@/components/ai/context/use-chat";
import { useBillingNavigation } from "@/lib/billing/use-navigation.client";
import { isActiveLocale } from "@/lib/i18n/active";

interface AiChatErrorSurfaceProps {
  children?: React.ReactNode;
  message: string;
}

function AiChatErrorSurface({ children, message }: AiChatErrorSurfaceProps) {
  return (
    <Empty className="rounded-xl border bg-card text-card-foreground">
      <EmptyHeader>
        <EmptyMedia className="bg-destructive/5" variant="icon">
          <HugeIcons className="text-destructive" icon={Alert02Icon} />
        </EmptyMedia>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}
AiChatErrorSurface.displayName = "AiChatErrorSurface";

/** Shows a persisted assistant generation failure after chat refresh. */
export function AiChatPersistedError() {
  const t = useTranslations("Ai");

  return <AiChatErrorSurface message={t("error-message")} />;
}
AiChatPersistedError.displayName = "AiChatPersistedError";

export function AiChatError() {
  const t = useTranslations("Ai");

  const error = useChat((state) => state.chat.error);

  if (!error) {
    return null;
  }

  let errorMessage = t("error-message");

  const isInsufficientCredits = error.message?.includes(
    CHAT_ERRORS.INSUFFICIENT_CREDITS.code
  );
  if (isInsufficientCredits) {
    errorMessage = t("insufficient-credits");
  }

  return (
    <AiChatErrorSurface message={errorMessage}>
      {isInsufficientCredits ? <ButtonCheckout /> : <ButtonRegenerate />}
    </AiChatErrorSurface>
  );
}
AiChatError.displayName = "AiChatError";

function ButtonCheckout() {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const billing = useBillingNavigation();

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
  );
  const handleCheckout = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openCheckout({
      locale,
      source: "chat-checkout",
    });
  };

  const handleManageSubscription = () => {
    if (!isActiveLocale(locale)) {
      return;
    }

    billing.openPortal({
      source: "chat-portal",
    });
  };

  return (
    <div className="flex items-center gap-4">
      <Activity mode={hasSubscription ? "visible" : "hidden"}>
        <Button
          disabled={billing.isPending || !isActiveLocale(locale)}
          onClick={handleManageSubscription}
          variant="secondary"
        >
          <Spinner icon={Settings01Icon} isLoading={billing.isPending} />
          {t("manage")}
        </Button>
      </Activity>
      <Activity mode={hasSubscription ? "hidden" : "visible"}>
        <Button
          disabled={billing.isPending || !isActiveLocale(locale)}
          onClick={handleCheckout}
          variant="secondary"
        >
          <Spinner icon={PartyIcon} isLoading={billing.isPending} />
          {t("get-pro")}
        </Button>
      </Activity>
    </div>
  );
}
ButtonCheckout.displayName = "ButtonCheckout";

function ButtonRegenerate() {
  const t = useTranslations("Ai");

  const regenerate = useChat((state) => state.chat.regenerate);

  return (
    <Button onClick={() => regenerate()} variant="secondary">
      {t("retry")}
    </Button>
  );
}
ButtonRegenerate.displayName = "ButtonRegenerate";
