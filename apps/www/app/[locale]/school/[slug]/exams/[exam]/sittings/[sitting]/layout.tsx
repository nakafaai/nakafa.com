import { AppProviders } from "@/components/providers/app";

/**
 * The layout of a sitting's proctor dashboard. The school layout admits only its members, and
 * the dashboard's own query checks that the viewer may view the sitting. This layout mounts the
 * client providers of the app inside the school shell, as the school settings do.
 */
export default function SittingDashboardLayout({
  children,
}: LayoutProps<"/[locale]/school/[slug]/exams/[exam]/sittings/[sitting]">) {
  return <AppProviders pageNavigation={null}>{children}</AppProviders>;
}
