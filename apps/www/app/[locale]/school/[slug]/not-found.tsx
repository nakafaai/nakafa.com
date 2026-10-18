import { getTranslations } from "next-intl/server";
import { SchoolHeader } from "@/components/tenant/header";
import { TenantMissing } from "@/components/tenant/missing";

/**
 * The not-found page of an address below a school that no page of the school
 * answers. It shows inside the school shell under the school's one header, whose
 * path names the page while the body draws its heading, and its one way on leads
 * to the school's home, which is the root of the school host.
 */
export default async function SchoolPageNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <>
      <SchoolHeader items={[{ label: t("title") }]} />
      <TenantMissing homeHref="/" />
    </>
  );
}
