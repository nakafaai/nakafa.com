"use client";

import {
  AccessIcon,
  EyeIcon,
  Login01Icon,
  Tick01Icon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { usePathname } from "@repo/internationalization/src/navigation";
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

/** Formats one event timestamp into the active locale's long-date label. */
function formatEventAccessDate(locale: Locale, value: number) {
  return format(value, "PPP", { locale: getLocale(locale) });
}

/** Renders the public event-access landing page for one access code. */
export function EventAccessPage({ code }: Props) {
  const tEvent = useTranslations("EventAccess");
  const locale = useLocale();
  const pathname = usePathname();
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

  /** Redeems the current event code and lets the live page state refresh the UI. */
  function activateAccess() {
    startTransition(async () => {
      try {
        const result = await redeemEventAccess({ code });

        if (result.kind === "used") {
          toast.info(
            tEvent("ended-at", {
              date: formatEventAccessDate(locale, result.endsAt),
            }),
            {
              position: "bottom-center",
            }
          );
          return;
        }

        toast.success(
          tEvent("redeem-success", {
            date: formatEventAccessDate(locale, result.endsAt),
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
          action={
            <Button
              nativeButton={false}
              render={
                <NavigationLink href="/try-out">
                  <HugeIcons icon={UnavailableIcon} />
                  {tEvent("view-tryout-cta")}
                </NavigationLink>
              }
            />
          }
          description={description}
          title={pageState.name ?? tEvent("title")}
        />
      </EventAccessLayout>
    );
  }

  if (pageState.kind === "sign-in") {
    return (
      <EventAccessLayout>
        <EventAccessCard
          action={
            <Button
              nativeButton={false}
              render={
                <NavigationLink href={`/auth?redirect=${pathname}`}>
                  <HugeIcons icon={Login01Icon} />
                  {tEvent("sign-in-cta")}
                </NavigationLink>
              }
            />
          }
          description={tEvent("sign-in-description")}
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
              <Spinner icon={AccessIcon} isLoading={isActionPending} />
              {tEvent("redeem-cta")}
            </Button>
          }
          description={tEvent("ready-description")}
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
            <Button disabled>
              <HugeIcons icon={Tick01Icon} />
              {tEvent("already-active-cta")}
            </Button>
          }
          description={tEvent("active-until", {
            date: formatEventAccessDate(locale, pageState.endsAt),
          })}
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
            nativeButton={false}
            render={
              <NavigationLink href="/try-out">
                <HugeIcons icon={EyeIcon} />
                {tEvent("view-tryout-cta")}
              </NavigationLink>
            }
          />
        }
        description={tEvent("ended-at", {
          date: formatEventAccessDate(locale, pageState.endsAt),
        })}
        title={pageState.name}
      />
    </EventAccessLayout>
  );
}
