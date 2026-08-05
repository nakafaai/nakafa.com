import { SchoolAuthBoundary } from "@/components/school/auth-screen";

/**
 * Presents the protected school subtree only while Convex auth is active.
 *
 * Authorization remains at the owning Convex functions and server data seams.
 * The reactive boundary keeps sign-in and sign-out transitions current without
 * relying on a layout redirect that Next.js can preserve across navigation.
 */
export default function Layout({ children }: LayoutProps<"/[locale]/school">) {
  return <SchoolAuthBoundary>{children}</SchoolAuthBoundary>;
}
