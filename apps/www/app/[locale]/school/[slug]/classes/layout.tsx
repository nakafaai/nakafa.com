import { AppProviders } from "@/components/providers/app";

/**
 * The layout of the class pages. The pages are client components, so this layout mounts the
 * client providers of the app inside the school shell, as the exam and sitting layouts do. The
 * class itself decides whether the viewer reads it.
 */
export default function SchoolClassesLayout({
  children,
}: LayoutProps<"/[locale]/school/[slug]/classes">) {
  return <AppProviders pageNavigation={null}>{children}</AppProviders>;
}
