import type { ReactNode } from "react";
import { SchoolHeader } from "@/components/tenant/header";

/**
 * The header of a sitting's screen: the school's path to the sitting, with the exam's name as its last
 * crumb, and the screen's actions at its end. The path's home crumb and the sidebar's trigger keep a way
 * back to the school home on a phone, whatever the screen shows.
 */
export function SittingBar({
  children,
  examTitle,
}: {
  readonly children?: ReactNode;
  readonly examTitle: string;
}) {
  return (
    <SchoolHeader items={[{ label: examTitle }]} title={examTitle}>
      {children}
    </SchoolHeader>
  );
}
