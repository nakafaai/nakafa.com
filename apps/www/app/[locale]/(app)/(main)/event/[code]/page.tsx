import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { EventAccessPage } from "@/components/event/access-page";

interface Props {
  params: Promise<{ code: string; locale: Locale }>;
}

export default async function Page({ params }: Props) {
  const { code, locale } = await params;

  setRequestLocale(locale);

  return <EventAccessPage code={code} />;
}
