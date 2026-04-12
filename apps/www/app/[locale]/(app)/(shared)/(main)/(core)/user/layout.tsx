import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(props: LayoutProps<"/[locale]/user">) {
  const { children, params } = props;
  getLocaleOrThrow(use(params).locale);

  return (
    <main className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh">
      {children}
    </main>
  );
}
