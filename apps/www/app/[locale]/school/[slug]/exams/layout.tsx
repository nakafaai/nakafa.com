import { AppProviders } from "@/components/providers/app";

/**
 * The layout of the school exams. The exam pages are client components, so this layout
 * mounts the client providers of the app layout, as the school settings layout does.
 */
export default function SchoolExamsLayout({
  children,
}: LayoutProps<"/[locale]/school/[slug]/exams">) {
  return <AppProviders pageNavigation={null}>{children}</AppProviders>;
}
