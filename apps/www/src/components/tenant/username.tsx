import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { getRouteApi, useMatchRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { AuthGoogle } from "@/components/auth/google";
import { Link } from "@/lib/routing/link";

/** The school layout's route, whose validated search holds the `masuk` address. */
const schoolRoute = getRouteApi("/school/$slug");

/**
 * The school username form. It loads when the visitor opens it, so the card code it needs stays
 * out of the entry's first JavaScript.
 */
const TenantLogin = lazy(() =>
  import("@/components/tenant/login").then((module) => ({
    default: module.TenantLogin,
  }))
);

/**
 * A parent's email code form (ADR 0034). It loads when a visitor opens the parent address,
 * so it stays out of the entry's first JavaScript.
 */
const TenantGuardianSignIn = lazy(() =>
  import("@/components/tenant/guardian/signin").then((module) => ({
    default: module.TenantGuardianSignIn,
  }))
);

/** Whether the visitor is on the parent address, `/orang-tua`, whose sign-in is the email code. */
function useGuardianAddress() {
  const matchRoute = useMatchRoute();
  return matchRoute({ to: "/school/$slug/orang-tua" }) !== false;
}

/**
 * The sign-in of a school host, one way at a time: Google with the links to the school username
 * form and to a parent's email code, the username form alone at the address `?masuk=username`,
 * or the code form alone at the parent address `/orang-tua`. The server renders each address
 * with its form open, so a press on a link before the page hydrates still opens it, and a
 * visitor who signs out to sign in with a card lands on it.
 */
export function TenantEntryActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const tGuardian = useTranslations("SchoolGuardians");
  const { masuk } = schoolRoute.useSearch();
  const guardian = useGuardianAddress();

  if (guardian) {
    return (
      <Suspense fallback={null}>
        <TenantGuardianSignIn />
      </Suspense>
    );
  }

  if (masuk === "username") {
    return (
      <Suspense fallback={null}>
        <TenantLogin />
      </Suspense>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <AuthGoogle returnPath="/" />
      <Button
        nativeButton={false}
        render={
          <Link
            params={{ slug }}
            search={{ masuk: "username" }}
            to="/school/$slug"
          />
        }
        variant="outline"
      >
        {t("username-action")}
      </Button>
      <Button
        nativeButton={false}
        render={<Link params={{ slug }} to="/school/$slug/orang-tua" />}
        variant="ghost"
      >
        {tGuardian("sign-in-action")}
      </Button>
    </div>
  );
}

/** The way back from the username or parent form to Google, at the start of the entry header. */
export function TenantEntryBack({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Common");
  const { masuk } = schoolRoute.useSearch();
  const guardian = useGuardianAddress();

  if (masuk !== "username" && !guardian) {
    return null;
  }

  return (
    <Button
      nativeButton={false}
      render={<Link params={{ slug }} to="/school/$slug" />}
      variant="ghost"
    >
      <HugeIcons icon={ArrowLeft01Icon} />
      {t("back")}
    </Button>
  );
}
