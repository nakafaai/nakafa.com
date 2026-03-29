"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import type { Locale } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { getLocale } from "@/lib/utils/date";
import { EventAccessCard, EventAccessLayout } from "./access-card";

interface Props {
  code: string;
}

function formatDate(locale: Locale, value: number) {
  return format(value, "PPP", { locale: getLocale(locale) });
}

export function EventAccessPage({ code }: Props) {
  const tEvent = useTranslations("EventAccess");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isActionPending, startTransition] = useTransition();
  const { data: pageState, isPending } = useQueryWithStatus(
    api.tryoutAccess.queries.getEventPageState,
    {
      code,
    }
  );
  const redeemEventAccess = useMutation(
    api.tryoutAccess.mutations.redeem.redeemEventAccess
  );

  function goToAuth() {
    router.push(`/auth?redirect=${pathname}`);
  }

  function goToTryout(product: string) {
    router.push(`/try-out/${product}`);
  }

  function activateAccess() {
    startTransition(async () => {
      try {
        const result = await redeemEventAccess({ code });

        toast.success(
          tEvent("redeem-success", {
            date: formatDate(locale, result.endsAt),
          }),
          {
            position: "bottom-center",
          }
        );
      } catch (error) {
        if (error instanceof ConvexError) {
          const errorData = error.data;

          if (typeof errorData === "object" && errorData !== null) {
            const errorCode = "code" in errorData ? errorData.code : undefined;

            if (errorCode === "EVENT_DISABLED") {
              toast.error(tEvent("unavailable-disabled"), {
                position: "bottom-center",
              });
              return;
            }

            if (errorCode === "EVENT_NOT_STARTED") {
              toast.error(tEvent("unavailable-not-started"), {
                position: "bottom-center",
              });
              return;
            }

            if (errorCode === "EVENT_ENDED") {
              toast.error(tEvent("unavailable-ended"), {
                position: "bottom-center",
              });
              return;
            }
          }
        }

        toast.error(tEvent("redeem-error"), {
          position: "bottom-center",
        });
      }
    });
  }

  if (!pageState || isPending) {
    return null;
  }

  if (pageState.kind === "unavailable") {
    let description = tEvent("unavailable-invalid-code");

    if (pageState.reason === "disabled") {
      description = tEvent("unavailable-disabled");
    }

    if (pageState.reason === "not-started") {
      description = tEvent("unavailable-not-started");
    }

    if (pageState.reason === "ended") {
      description = tEvent("unavailable-ended");
    }

    return (
      <EventAccessLayout>
        <EventAccessCard
          badge={tEvent("title")}
          description={description}
          title={tEvent("title")}
        />
      </EventAccessLayout>
    );
  }

  if (pageState.kind === "sign-in") {
    return (
      <EventAccessLayout>
        <EventAccessCard
          action={
            <Button disabled={isActionPending} onClick={goToAuth}>
              <HugeIcons icon={Rocket01Icon} />
              {tEvent("sign-in-cta")}
            </Button>
          }
          badge={tEvent("free-days", {
            days: pageState.grantDurationDays,
          })}
          title={pageState.name}
        />
      </EventAccessLayout>
    );
  }

  if (pageState.kind === "ready") {
    return (
      <EventAccessLayout>
        <EventAccessCard
          action={
            <Button disabled={isActionPending} onClick={activateAccess}>
              <Spinner icon={Rocket01Icon} isLoading={isActionPending} />
              {tEvent("redeem-cta")}
            </Button>
          }
          badge={tEvent("free-days", {
            days: pageState.grantDurationDays,
          })}
          title={pageState.name}
        />
      </EventAccessLayout>
    );
  }

  if (pageState.kind === "active") {
    return (
      <EventAccessLayout>
        <EventAccessCard
          action={
            <Button
              disabled={isActionPending}
              onClick={() => {
                goToTryout(pageState.product);
              }}
            >
              <HugeIcons icon={Rocket01Icon} />
              {tEvent("open-tryout-cta")}
            </Button>
          }
          badge={tEvent("active-until", {
            date: formatDate(locale, pageState.endsAt),
          })}
          description={tEvent("active-state")}
          title={pageState.name}
        />
      </EventAccessLayout>
    );
  }

  return (
    <EventAccessLayout>
      <EventAccessCard
        action={
          <Button
            disabled={isActionPending}
            onClick={() => {
              goToTryout(pageState.product);
            }}
          >
            <HugeIcons icon={Rocket01Icon} />
            {tEvent("view-tryout-cta")}
          </Button>
        }
        badge={tEvent("ended-at", {
          date: formatDate(locale, pageState.endsAt),
        })}
        description={tEvent("used-state")}
        title={pageState.name}
      />
    </EventAccessLayout>
  );
}
