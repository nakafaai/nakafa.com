import type {
  ShellModelSample,
  ShellModelShells,
} from "@repo/design-system/components/contents/chemistry/shell-model/data";
import { useRequired } from "@repo/design-system/hooks/required";
import type { ReactNode } from "react";
import { createContext } from "react";

interface ShellModelProviderProps {
  children: ReactNode;
  outerShellKey: string;
  sample: ShellModelSample;
  shells: ShellModelShells;
}

const ShellModelContext = createContext<Omit<
  ShellModelProviderProps,
  "children"
> | null>(null);

/** Provides one shell model's outer shell, sample and shells to its stage and scene. */
export function ShellModelProvider({
  children,
  ...values
}: ShellModelProviderProps) {
  return <ShellModelContext value={values}>{children}</ShellModelContext>;
}

/** Reads the values of the surrounding shell model. */
export function useShellModel() {
  return useRequired(ShellModelContext, "useShellModel");
}
