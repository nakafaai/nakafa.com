import { getTranslations } from "next-intl/server";
import { SchoolHeader } from "@/components/tenant/header";
import { TenantMissing } from "@/components/tenant/missing";

/**
 * The not-found page of an address below a school that no page of the school
 * answers. It shows inside the school shell under the school's one header, and
 * its one way on leads to the school's home, which is the root of the school host.
 */
export default async function SchoolPageNotFound() {
  const t = await getTranslations("NotFound");
  const title = t("title");

  return (
    <>
      <SchoolHeader items={[{ label: title }]} title={title} />
      <TenantMissing homeHref="/" />
    </>
  );
}
