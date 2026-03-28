"use client";

import { ArrowLeft02Icon, Rocket01Icon } from "@hugeicons/core-free-icons";
import { useInterval } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { format, startOfMinute } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { getLocale } from "@/lib/utils/date";

interface Props {
  code: string;
}

function formatDate(locale: string, value: number) {
  const currentLocale = locale === "id" ? "id" : "en";

  return format(value, "PPP", { locale: getLocale(currentLocale) });
}

export function EventAccessPage({ code }: Props) {
  const tCommon = useTranslations("Common");
  const tEvent = useTranslations("EventAccess");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [queryNow, setQueryNow] = useState(() =>
    startOfMinute(new Date()).getTime()
  );
  const [isActionPending, startTransition] = useTransition();
  const refreshQueryClock = useInterval(() => {
    setQueryNow(startOfMinute(new Date()).getTime());
  }, 60_000);
  const { data: pageState, isPending } = useQueryWithStatus(
    api.tryoutAccess.queries.getEventPageState,
    {
      code,
      now: queryNow,
    }
  );
  const redeemEventAccess = useMutation(
    api.tryoutAccess.mutations.redeemEventAccess
  );

  useEffect(() => {
    refreshQueryClock.start();

    return () => {
      refreshQueryClock.stop();
    };
  }, [refreshQueryClock]);

  const statusCopy = useMemo(() => {
    if (!pageState) {
      return {
        description: tEvent("loading-description"),
        primaryCta: null,
        title: tEvent("title"),
      };
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

      return {
        description,
        primaryCta: null,
        title: tEvent("title"),
      };
    }

    if (pageState.kind === "sign-in") {
      return {
        description: tEvent("sign-in-description", {
          days: pageState.grantDurationDays,
          name: pageState.name,
        }),
        primaryCta: tEvent("sign-in-cta"),
        title: pageState.name,
      };
    }

    if (pageState.kind === "ready") {
      return {
        description: tEvent("ready-description", {
          days: pageState.grantDurationDays,
          name: pageState.name,
        }),
        primaryCta: tEvent("redeem-cta"),
        title: pageState.name,
      };
    }

    if (pageState.kind === "active") {
      return {
        description: tEvent("active-description", {
          date: formatDate(locale, pageState.endsAt),
          name: pageState.name,
        }),
        primaryCta: tEvent("open-tryout-cta"),
        title: pageState.name,
      };
    }

    return {
      description: tEvent("used-description", {
        date: formatDate(locale, pageState.endsAt),
        name: pageState.name,
      }),
      primaryCta: tEvent("view-tryout-cta"),
      title: pageState.name,
    };
  }, [locale, pageState, tEvent]);

  function handlePrimaryAction() {
    if (!pageState || pageState.kind === "unavailable") {
      return;
    }

    if (pageState.kind === "sign-in") {
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    if (pageState.kind === "active" || pageState.kind === "used") {
      router.push(`/try-out/${pageState.product}`);
      return;
    }

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
        setQueryNow(startOfMinute(new Date()).getTime());
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

  return (
    <main className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center px-6 py-12 sm:py-20">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="z-1 mx-auto flex w-full max-w-xl flex-col gap-6">
        <NavigationLink
          className="flex items-center gap-2 text-primary text-sm underline-offset-4 hover:underline"
          href="/try-out"
        >
          <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
          {tCommon("back")}
        </NavigationLink>

        <section className="rounded-2xl border bg-card/95 p-6 shadow-sm backdrop-blur-xs sm:p-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-medium text-primary text-sm">
                {tEvent("eyebrow")}
              </p>
              <div className="space-y-2">
                <h1 className="text-balance font-medium text-3xl tracking-tight sm:text-4xl">
                  {statusCopy.title}
                </h1>
                <p className="text-balance text-muted-foreground leading-relaxed">
                  {statusCopy.description}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {statusCopy.primaryCta ? (
                <Button
                  disabled={isActionPending || isPending}
                  onClick={handlePrimaryAction}
                >
                  <Spinner icon={Rocket01Icon} isLoading={isActionPending} />
                  {statusCopy.primaryCta}
                </Button>
              ) : null}

              <Button
                nativeButton={false}
                render={<NavigationLink href="/try-out" />}
                variant="outline"
              >
                {tEvent("browse-tryouts-cta")}
              </Button>
            </div>

            {isPending ? (
              <p className="text-muted-foreground text-sm">
                {tEvent("loading-description")}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
