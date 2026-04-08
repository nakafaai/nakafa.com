import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { EventAccessPage } from "@/components/event/access-page";

interface Props {
  params: Promise<{ code: string; locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { code, locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <EventAccessPage code={code} />;
}
