import { Particles } from "@repo/design-system/components/ui/particles";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Layout(
  props: LayoutProps<"/[locale]/school/onboarding">
) {
  const { children, params } = props;
  const { locale } = use(params);
  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-svh" data-pagefind-ignore>
      <Particles className="-z-1 pointer-events-none absolute inset-0 opacity-80" />
      {children}
    </div>
  );
}
