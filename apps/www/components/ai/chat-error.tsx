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
import { useTranslations } from "next-intl";
import { Activity, memo, useTransition } from "react";
import { CHAT_ERRORS } from "@/app/api/chat/constants";
import { useChat } from "@/lib/context/use-chat";

export const AiChatError = memo(() => {
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
    <Empty className="rounded-xl border bg-card text-card-foreground">
      <EmptyHeader>
        <EmptyMedia className="bg-destructive/5" variant="icon">
          <HugeIcons className="text-destructive" icon={Alert02Icon} />
        </EmptyMedia>
        <EmptyDescription>{errorMessage}</EmptyDescription>
      </EmptyHeader>
      {isInsufficientCredits ? <ButtonCheckout /> : <ButtonRegenerate />}
    </Empty>
  );
});
AiChatError.displayName = "AiChatError";

const ButtonCheckout = memo(() => {
  const t = useTranslations("Auth");

  const [isPending, startTransition] = useTransition();

  const { data: hasSubscription } = useQueryWithStatus(
    api.subscriptions.queries.hasActiveSubscription,
    { productId: products.pro.id }
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
});
ButtonCheckout.displayName = "ButtonCheckout";

const ButtonRegenerate = memo(() => {
  const t = useTranslations("Ai");

  const regenerate = useChat((state) => state.chat.regenerate);

  return (
    <Button onClick={() => regenerate()} variant="secondary">
      {t("retry")}
    </Button>
  );
});
ButtonRegenerate.displayName = "ButtonRegenerate";
