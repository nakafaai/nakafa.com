import { Section } from "@react-email/components";
import type { ReactNode } from "react";

export function WrapperIcon({ children }: { children: ReactNode }) {
  return <Section className="w-8 rounded-md bg-primary/10">{children}</Section>;
}
