import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";

/** Renders the marketing subtree inside its dedicated site shell. */
export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = use(params);
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <main
      className="flex min-h-screen w-full flex-1 flex-col"
      data-marketing-page
    >
      <Header />
      {children}
      <Footer />
    </main>
  );
}
