import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getToken } from "@/lib/auth/server";

const AUTH_REDIRECT_PATH_COOKIE = "auth-redirect-path";

/**
 * Guards the authenticated Nakafa School subtree on the server so hydration
 * does not replace an already-rendered page with a client auth loader.
 */
export default function Layout({
  children,
  params,
}: LayoutProps<"/[locale]/school">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedSchoolLayout params={params}>
        {children}
      </AuthenticatedSchoolLayout>
    </Suspense>
  );
}

/** Resolve the school auth boundary after the request-scoped params are ready. */
async function AuthenticatedSchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutProps<"/[locale]/school">["params"];
}) {
  const { locale } = await params;
  const token = await getToken();

  if (!token) {
    const pathname =
      (await cookies()).get(AUTH_REDIRECT_PATH_COOKIE)?.value ??
      `/${locale}/school`;

    redirect(`/${locale}/auth?redirect=${encodeURIComponent(pathname)}`);
  }

  return children;
}
