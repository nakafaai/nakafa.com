import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";

export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = use(params);
  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <main className="flex min-h-screen w-full flex-1 flex-col">
      <Header />
      {children}
      <Footer />
    </main>
  );
}
