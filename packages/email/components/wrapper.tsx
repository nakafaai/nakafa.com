import type { ReactNode } from "react";
import { Section } from "react-email";

export function WrapperIcon({ children }: { children: ReactNode }) {
  return <Section className="w-8 rounded-md bg-primary/10">{children}</Section>;
}
