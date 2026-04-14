import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Guards the authenticated Nakafa School subtree on the server so hydration
 * does not replace an already-rendered page with a client auth loader.
 */
export default async function Layout({
  children,
  params,
}: LayoutProps<"/[locale]/school">) {
  const locale = getLocaleOrThrow((await params).locale);
  const token = await getToken();

  if (!token) {
    redirect(`/${locale}/auth?redirect=/school`);
  }

  return children;
}
