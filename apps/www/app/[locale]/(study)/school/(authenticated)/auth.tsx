"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useTranslations } from "next-intl";
import { AuthGoogle } from "@/components/auth/google";

export function LayoutAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <Authenticated>{children}</Authenticated>

      <Unauthenticated>
        <div className="relative flex h-svh items-center justify-center">
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="mx-auto max-w-lg px-6">
            <div className="relative flex h-full flex-col items-center gap-6">
              <Title />

              <AuthGoogle redirect={pathname} />

              <Footer />
            </div>
          </div>
        </div>
      </Unauthenticated>

      <AuthLoading>
        <div className="relative flex h-svh items-center justify-center">
          <SpinnerIcon
            aria-hidden="true"
            className="size-6 shrink-0 text-primary"
          />
        </div>
      </AuthLoading>
    </>
  );
}

function Title() {
  const t = useTranslations("Metadata");

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-semibold text-2xl">Nakafa</h1>
      <p className="text-muted-foreground">{t("very-short-description")}</p>
    </div>
  );
}

function Footer() {
  const tLegal = useTranslations("Legal");

  return (
    <div className="flex flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {tLegal.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <Button asChild className="h-auto p-0" size="sm" variant="link">
              <NavigationLink href="/terms-of-service">{chunks}</NavigationLink>
            </Button>
          ),
          "privacy-policy": (chunks) => (
            <Button asChild className="h-auto p-0" size="sm" variant="link">
              <NavigationLink href="/privacy-policy">{chunks}</NavigationLink>
            </Button>
          ),
        })}
      </p>
    </div>
  );
}
