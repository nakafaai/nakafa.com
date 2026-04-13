"use client";

import {
  AccessIcon,
  EyeIcon,
  Login01Icon,
  Tick01Icon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import type { Locale } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { getSafeInternalRedirectPath } from "@/lib/auth/utils";
import { getLocale } from "@/lib/utils/date";
import { EventAccessCard, EventAccessLayout } from "./access-card";

interface Props {
  code: string;
}

/** Formats one event timestamp into the active locale's long-date label. */
function formatEventAccessDate(locale: Locale, value: number) {
  return format(value, "PPP", { locale: getLocale(locale) });
}

/** Builds the sign-in destination for one event page. */
function getAuthHref(pathname: string) {
  const redirect = getSafeInternalRedirectPath(pathname) ?? "/";

  return `/auth?${new URLSearchParams({ redirect }).toString()}`;
}

/** Renders the public event-access landing page for one access code. */
export function EventAccessPage({ code }: Props) {
  const tEvent = useTranslations("EventAccess");
  const locale = useLocale();
  const pathname = usePathname();
  const authHref = getAuthHref(pathname);
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

        switch (result.kind) {
          case "active": {
            toast.success(
              tEvent("redeem-success", {
                date: formatEventAccessDate(locale, result.endsAt),
              }),
              {
                position: "bottom-center",
              }
            );
            return;
          }
          case "already-active": {
            toast.info(
              tEvent("active-until", {
                date: formatEventAccessDate(locale, result.endsAt),
              }),
              {
                position: "bottom-center",
              }
            );
            return;
          }
          case "used": {
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
          case "disabled": {
            toast.error(tEvent("unavailable-disabled"), {
              position: "bottom-center",
            });
            return;
          }
          case "not-started": {
            toast.error(tEvent("unavailable-not-started"), {
              position: "bottom-center",
            });
            return;
          }
          case "ended": {
            toast.error(tEvent("unavailable-ended"), {
              position: "bottom-center",
            });
            return;
          }
          case "not-found": {
            toast.error(tEvent("unavailable-invalid-code"), {
              position: "bottom-center",
            });
            return;
          }
          default: {
            const unhandledResult: never = result;

            throw new Error(
              `Unhandled event redeem result: ${JSON.stringify(unhandledResult)}`
            );
          }
        }
      } catch (error) {
        captureException(error, {
          source: "event-access-redeem",
        });
        toast.error(tEvent("redeem-error"), {
          position: "bottom-center",
        });
      }
    });
  }

  if (!pageState || isPending) {
    return null;
  }

  switch (pageState.kind) {
    case "unavailable": {
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
    case "sign-in": {
      return (
        <EventAccessLayout>
          <EventAccessCard
            action={
              <Button
                nativeButton={false}
                render={
                  <NavigationLink href={authHref}>
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
    case "ready": {
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
    case "active": {
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
    case "used": {
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
    default: {
      const unhandledState: never = pageState;

      throw new Error(
        `Unhandled event page state: ${JSON.stringify(unhandledState)}`
      );
    }
  }
}
