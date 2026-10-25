import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
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
 * The sign-in actions of a school host: Google beside the school username action. The
 * username action is a link to the address `?masuk=username`, which the server renders with
 * the form open, so a press before the page hydrates still opens it; a visitor who signs out
 * to sign in with a card lands on the same address. While the form is open, Google is the
 * outline button, so the form's submit is the one primary action.
 */
export function TenantEntryActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const { masuk } = schoolRoute.useSearch();
  const isOpen = masuk === "username";

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <AuthGoogle returnPath="/" variant={isOpen ? "outline" : "default"} />
      {isOpen ? (
        <Suspense fallback={null}>
          <TenantLogin slug={slug} />
        </Suspense>
      ) : (
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
      )}
    </div>
  );
}
