import { redirect } from "@repo/internationalization/src/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  // This is empty page, redirect to home page
  redirect({ href: "/about", locale });
}
