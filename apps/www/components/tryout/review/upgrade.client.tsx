"use client";

import { useMutation } from "@confect/react";
import { Diamond02Icon } from "@hugeicons/core-free-icons";
import refs from "@repo/backend/confect/_generated/refs";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Data, Effect } from "effect";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { reportClientException } from "@/lib/analytics/client";

/** A failed optional paywall impression never changes access to free scores. */
class TryoutReviewImpressionError extends Data.TaggedError(
  "TryoutReviewImpressionError"
)<{ readonly cause: unknown }> {}

/** Offers detailed solutions after the learner has received a free score. */
export function TryoutReviewUpgrade() {
  const t = useTranslations("Tryouts");
  const trackPaywall = useMutation(
    refs.public.tryouts.mutations.access.trackPaywallView
  );

  useEffect(() => {
    Effect.runPromise(
      Effect.tryPromise({
        try: () => trackPaywall({ source: "review" }),
        catch: (cause) => new TryoutReviewImpressionError({ cause }),
      }).pipe(
        Effect.flatMap((result) =>
          Effect.fromResult(result).pipe(
            Effect.mapError(
              (cause) => new TryoutReviewImpressionError({ cause })
            )
          )
        ),
        Effect.catchTag("TryoutReviewImpressionError", (error) =>
          reportClientException(error, { source: "tryout-paywall-view" })
        )
      )
    );
  }, [trackPaywall]);

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeIcons icon={Diamond02Icon} />
        </EmptyMedia>
        <EmptyTitle>{t("paywall-title")}</EmptyTitle>
        <EmptyDescription>{t("paywall-description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <IntentLink className={buttonVariants()} href="/pricing">
          {t("checkout-cta")}
        </IntentLink>
      </EmptyContent>
    </Empty>
  );
}
