"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Particles } from "@repo/design-system/components/ui/particles";
import { Authenticated, Unauthenticated } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AuthGoogle } from "@/components/auth/google";
import { usePageNavigation } from "@/lib/content/page/context";

/** Keeps protected school UI aligned with the live Convex auth state. */
export function SchoolAuthBoundary({ children }: { children: ReactNode }) {
  return (
    <>
      <Authenticated>{children}</Authenticated>
      <Unauthenticated>
        <SchoolAuthScreen />
      </Unauthenticated>
    </>
  );
}

/** Renders the shared Nakafa School sign-in screen for unauthenticated users. */
export function SchoolAuthScreen() {
  return (
    <div className="relative flex h-svh items-center justify-center">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto max-w-lg px-6">
        <div className="relative flex h-full flex-col items-center gap-6">
          <SchoolAuthScreenTitle />

          <AuthGoogle />

          <SchoolAuthScreenFooter />
        </div>
      </div>
    </div>
  );
}

/** Renders the title block for the shared Nakafa School sign-in screen. */
function SchoolAuthScreenTitle() {
  const t = useTranslations("Metadata");

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-semibold text-2xl">Nakafa</h1>
      <p className="text-muted-foreground">{t("very-short-description")}</p>
    </div>
  );
}

/** Renders the legal footer for the shared Nakafa School sign-in screen. */
function SchoolAuthScreenFooter() {
  const tLegal = useTranslations("Legal");
  const locale = useLocale();
  const pageNavigation = usePageNavigation((navigation) => navigation);

  if (!pageNavigation) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {tLegal.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <Button
              className="h-auto p-0"
              nativeButton={false}
              render={
                <a
                  href={`/${locale}${pageNavigation.termsOfServiceHref}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </a>
              }
              size="sm"
              variant="link"
            />
          ),
          "privacy-policy": (chunks) => (
            <Button
              className="h-auto p-0"
              nativeButton={false}
              render={
                <a
                  href={`/${locale}${pageNavigation.privacyPolicyHref}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </a>
              }
              size="sm"
              variant="link"
            />
          ),
        })}
      </p>
    </div>
  );
}
