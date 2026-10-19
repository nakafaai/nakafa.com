"use client";

import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import dynamic from "next/dynamic";
import { useQueryState } from "nuqs";
import { useTranslations } from "use-intl";
import { AuthGoogle } from "@/components/auth/google";

/**
 * The school username form. It loads when the visitor opens it, so the card code it needs stays
 * out of the entry's first JavaScript.
 */
const TenantLogin = dynamic(
  () =>
    import("@/components/tenant/login").then((module) => module.TenantLogin),
  { loading: () => null }
);

/**
 * The sign-in actions of a school host: Google beside the school username action. The
 * username form opens from its button, and from the address `?masuk=username`, which a
 * visitor who signs out to sign in with a card lands on. While the form is open, Google is the
 * outline button, so the form's submit is the one primary action.
 */
export function TenantEntryActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolEntry");
  const [masuk, setMasuk] = useQueryState("masuk");
  const isOpen = masuk === "username";

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AuthGoogle returnPath="/" variant={isOpen ? "outline" : "default"} />
      {isOpen ? (
        <TenantLogin slug={slug} />
      ) : (
        <Button onClick={() => setMasuk("username")} variant="outline">
          {t("username-action")}
        </Button>
      )}
    </div>
  );
}
