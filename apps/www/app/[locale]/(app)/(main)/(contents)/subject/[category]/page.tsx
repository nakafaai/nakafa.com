import { redirect } from "@repo/internationalization/src/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getStaticParams } from "@/lib/utils/system";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category"],
  });
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  // This is empty page, redirect to home page
  redirect({ href: "/", locale });
}
