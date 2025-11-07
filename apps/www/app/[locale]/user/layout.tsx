import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function Layout(props: LayoutProps<"/[locale]/user">) {
  const { children, params } = props;
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale as Locale);

  return (
    <main
      className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh"
      data-pagefind-ignore
    >
      {children}
    </main>
  );
}
