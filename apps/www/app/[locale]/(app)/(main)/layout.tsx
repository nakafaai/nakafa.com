import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ConvexAppProviders } from "@/components/providers";
import { MainShellBoundary } from "@/components/sidebar/main-shell-boundary";

/** Renders the main student area inside the ambient Convex/user providers. */
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
    <ConvexAppProviders>
      <MainShellBoundary>{children}</MainShellBoundary>
    </ConvexAppProviders>
  );
}
