"use client";

import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useTranslations } from "next-intl";
import { AuthGoogle } from "@/components/auth/google";
import { AuthLogout } from "@/components/auth/logout";

export default function Page() {
  const t = useTranslations("Metadata");
  const tLegal = useTranslations("Legal");

  return (
    <main
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto max-w-lg px-6">
        <div className="relative flex h-full flex-col items-center gap-6">
          <div className="flex flex-col items-center">
            <h1 className="font-semibold text-2xl">Nakafa</h1>
            <p className="text-muted-foreground">
              {t("very-short-description")}
            </p>
          </div>

          <Unauthenticated>
            <AuthGoogle />
          </Unauthenticated>

          <Authenticated>
            <AuthLogout />
          </Authenticated>

          <AuthLoading>
            <Skeleton className="mx-auto h-9 w-1/2" />
          </AuthLoading>

          <div className="flex flex-col">
            <p className="text-balance text-center text-muted-foreground text-sm">
              {tLegal.rich("legal-description", {
                "terms-of-service": (chunks) => (
                  <Button
                    asChild
                    className="h-auto p-0"
                    size="sm"
                    variant="link"
                  >
                    <NavigationLink href="/terms-of-service">
                      {chunks}
                    </NavigationLink>
                  </Button>
                ),
                "privacy-policy": (chunks) => (
                  <Button
                    asChild
                    className="h-auto p-0"
                    size="sm"
                    variant="link"
                  >
                    <NavigationLink href="/privacy-policy">
                      {chunks}
                    </NavigationLink>
                  </Button>
                ),
              })}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
