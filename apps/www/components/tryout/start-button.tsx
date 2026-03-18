"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useInterval } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useMutation } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  TryoutCountdown,
  TryoutCountdownAction,
  TryoutCountdownMeta,
  TryoutCountdownTime,
} from "@/components/tryout/countdown";
import { useUser } from "@/lib/context/use-user";

interface TryoutStartButtonProps {
  locale: Locale;
  product: TryoutProduct;
  tryoutSlug: string;
}

export function TryoutStartButton({
  locale,
  product,
  tryoutSlug,
}: TryoutStartButtonProps) {
  const tAuth = useTranslations("Auth");
  const tTryouts = useTranslations("Tryouts");
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data: attemptData, isPending: isAttemptPending } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug } : "skip"
  );
  const { data: hasSubscription, isPending: isSubscriptionPending } =
    useQueryWithStatus(
      api.subscriptions.queries.hasActiveSubscription,
      !isUserPending && user ? { productId: products.pro.id } : "skip"
    );

  const startTryout = useMutation(api.tryouts.mutations.attempts.startTryout);
  const generateCheckoutLink = useAction(
    api.customers.actions.generateCheckoutLink
  );

  const nextPartKey =
    attemptData?.attempt.status === "in-progress"
      ? attemptData.nextPartKey
      : undefined;
  const [nowMs, setNowMs] = useState(Date.now());
  const isLoading =
    isPending ||
    isUserPending ||
    (user ? isAttemptPending || isSubscriptionPending : false);
  let buttonLabel = tTryouts("start-cta");

  if (user && hasSubscription === false) {
    buttonLabel = tAuth("get-pro");
  }

  if (nextPartKey) {
    buttonLabel = tTryouts("continue-cta");
  }

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    1000,
    { autoInvoke: true }
  );

  const remainingTime = useMemo(() => {
    if (attemptData?.attempt.status !== "in-progress") {
      return null;
    }

    const totalSeconds = Math.max(
      0,
      Math.floor((attemptData.expiresAtMs - nowMs) / 1000)
    );

    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }, [attemptData, nowMs]);

  const timeSegments = useMemo(() => {
    if (!remainingTime) {
      return [];
    }

    return [
      { label: tTryouts("time-hours-short"), value: remainingTime.hours },
      { label: tTryouts("time-minutes-short"), value: remainingTime.minutes },
      { label: tTryouts("time-seconds-short"), value: remainingTime.seconds },
    ];
  }, [remainingTime, tTryouts]);

  const handleClick = () => {
    if (!user) {
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    if (nextPartKey) {
      router.push(`/try-out/${product}/${tryoutSlug}/part/${nextPartKey}`);
      return;
    }

    if (hasSubscription === false) {
      startTransition(async () => {
        const { url } = await generateCheckoutLink({
          productIds: [products.pro.id],
          successUrl: window.location.href,
        });

        window.location.href = url;
      });
      return;
    }

    setOpen(true);
  };

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await startTryout({ locale, product, tryoutSlug });
        setOpen(false);
        router.refresh();
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
      } catch {
        toast.error(tTryouts("start-error"), {
          position: "bottom-center",
        });
      }
    });
  };

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4">
        {remainingTime ? (
          <TryoutCountdown>
            <TryoutCountdownTime segments={timeSegments} />
            <TryoutCountdownMeta>
              {tTryouts("remaining-time-label")}
            </TryoutCountdownMeta>
            <TryoutCountdownAction>
              <Button disabled={isLoading} onClick={handleClick}>
                <Spinner icon={Rocket01Icon} isLoading={isPending} />
                {buttonLabel}
              </Button>
            </TryoutCountdownAction>
          </TryoutCountdown>
        ) : null}

        {remainingTime ? null : (
          <Button disabled={isLoading} onClick={handleClick}>
            <Spinner icon={Rocket01Icon} isLoading={isPending} />
            {buttonLabel}
          </Button>
        )}
      </div>

      <ResponsiveDialog
        description={tTryouts("start-dialog-description")}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {tTryouts("cancel-cta")}
            </Button>
            <Button disabled={isPending} onClick={handleConfirm} type="button">
              <Spinner icon={Rocket01Icon} isLoading={isPending} />
              {tTryouts("start-cta")}
            </Button>
          </div>
        }
        open={open}
        setOpen={setOpen}
        title={tTryouts("start-dialog-title")}
      />
    </>
  );
}
