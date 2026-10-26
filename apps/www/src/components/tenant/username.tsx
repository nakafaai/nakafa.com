import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { getRouteApi } from "@tanstack/react-router";
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
 * The sign-in of a school host, one way at a time: Google with the link to the school username
 * form, or that form alone at the address `?masuk=username`. The server renders that address
 * with the form open, so a press on the link before the page hydrates still opens it, and a
 * visitor who signs out to sign in with a card lands on it.
 */
export function TenantEntryActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const { masuk } = schoolRoute.useSearch();

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
    </div>
  );
}

/** The way back from the username form to Google, at the start of the entry header. */
export function TenantEntryBack({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Common");
  const { masuk } = schoolRoute.useSearch();

  if (masuk !== "username") {
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
