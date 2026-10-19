import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useTranslations } from "use-intl";
import { SchoolHeader } from "@/components/tenant/header";
import { TenantMissing } from "@/components/tenant/missing";

/**
 * An address below a school that no page of the school answers. Only a member
 * reaches this page: the shell draws for members alone, and a visitor sees the
 * entry surface, so the page answers not found inside the shell.
 */
export const Route = createFileRoute("/school/$slug/$")({
  beforeLoad: ({ context }) => {
    if (context.school._tag === "Member") {
      throw notFound();
    }
  },
  notFoundComponent: SchoolPageNotFound,
});

function SchoolPageNotFound(): ReactElement {
  const t = useTranslations("NotFound");
  return (
    <>
      <SchoolHeader items={[{ label: t("title") }]} />
      <TenantMissing homeHref="/" />
    </>
  );
}
