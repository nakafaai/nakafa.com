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
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useTransition } from "react";
import { CHAT_ERRORS } from "@/app/api/chat/constants";
import { useChat } from "@/components/ai/context/use-chat";

interface AiChatErrorSurfaceProps {
  children?: React.ReactNode;
  message: string;
}

const AiChatErrorSurface = ({ children, message }: AiChatErrorSurfaceProps) => (
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
AiChatErrorSurface.displayName = "AiChatErrorSurface";

/** Shows a persisted assistant generation failure after chat refresh. */
export const AiChatPersistedError = () => {
  const t = useTranslations("Ai");

  return <AiChatErrorSurface message={t("error-message")} />;
};
AiChatPersistedError.displayName = "AiChatPersistedError";

export const AiChatError = () => {
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
};
AiChatError.displayName = "AiChatError";

const ButtonCheckout = () => {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const [isPending, startTransition] = useTransition();

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
  );
  const generateCustomerPortalUrl = useAction(
    api.customers.actions.public.generateCustomerPortalUrl
  );
  const generateCheckoutLink = useAction(
    api.customers.actions.public.generateCheckoutLink
  );

  const handleCheckout = () => {
    startTransition(async () => {
      const { url } = await generateCheckoutLink({
        locale,
        successUrl: window.location.href,
      });
      window.location.href = url;
    });
  };

  const handleManageSubscription = () => {
    startTransition(async () => {
      const { url } = await generateCustomerPortalUrl({});
      window.location.href = url;
    });
  };

  return (
    <div className="flex items-center gap-4">
      <Activity mode={hasSubscription ? "visible" : "hidden"}>
        <Button
          disabled={isPending}
          onClick={handleManageSubscription}
          variant="secondary"
        >
          <Spinner icon={Settings01Icon} isLoading={isPending} />
          {t("manage")}
        </Button>
      </Activity>
      <Activity mode={hasSubscription ? "hidden" : "visible"}>
        <Button
          disabled={isPending}
          onClick={handleCheckout}
          variant="secondary"
        >
          <Spinner icon={PartyIcon} isLoading={isPending} />
          {t("get-pro")}
        </Button>
      </Activity>
    </div>
  );
};
ButtonCheckout.displayName = "ButtonCheckout";

const ButtonRegenerate = () => {
  const t = useTranslations("Ai");

  const regenerate = useChat((state) => state.chat.regenerate);

  return (
    <Button onClick={() => regenerate()} variant="secondary">
      {t("retry")}
    </Button>
  );
};
ButtonRegenerate.displayName = "ButtonRegenerate";
