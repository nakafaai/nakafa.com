import { redirect } from "@repo/internationalization/src/navigation";
import type { Locale } from "next-intl";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;
  // This is empty page, redirect to home page
  redirect({ href: "/", locale });
}
