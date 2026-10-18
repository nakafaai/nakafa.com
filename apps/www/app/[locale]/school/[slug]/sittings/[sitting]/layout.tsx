import { AppProviders } from "@/components/providers/app";

/**
 * The layout of a student's sitting screen. It mounts the client providers of the app inside
 * the school shell, as the school settings do. The sitting itself admits the student's device.
 */
export default function StudentSittingLayout({
  children,
}: LayoutProps<"/[locale]/school/[slug]/sittings/[sitting]">) {
  return <AppProviders pageNavigation={null}>{children}</AppProviders>;
}
