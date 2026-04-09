import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LayoutAuth } from "./auth";

export default function Layout(props: LayoutProps<"/[locale]/school">) {
  const { children, params } = props;
  const { locale } = use(params);
  if (!hasLocale(routing.locales, locale)) {
    // Ensure that the incoming `locale` is valid
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return <LayoutAuth>{children}</LayoutAuth>;
}
