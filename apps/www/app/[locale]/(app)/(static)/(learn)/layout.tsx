import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { use } from "react";
import { AppShell } from "@/components/sidebar/app-shell";

/** Renders the static learning subtree inside the default app shell. */
export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = use(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return <AppShell>{children}</AppShell>;
}
