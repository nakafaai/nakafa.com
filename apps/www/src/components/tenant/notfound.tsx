import type { ReactElement } from "react";
import { useTranslations } from "use-intl";
import { SchoolHeader } from "@/components/tenant/header";
import { TenantMissing } from "@/components/tenant/missing";

/**
 * The not-found page of an address below a school that no page of the school
 * answers. It shows inside the school shell under the school's one header, whose
 * path names the page while the body draws its heading, and its one way on leads
 * to the school's home, which is the root of the school host.
 */
export function SchoolPageNotFound(): ReactElement {
  const t = useTranslations("NotFound");
  return (
    <>
      <SchoolHeader items={[{ label: t("title") }]} />
      <TenantMissing homeHref="/" />
    </>
  );
}
