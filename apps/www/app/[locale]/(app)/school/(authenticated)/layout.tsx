import { LayoutAuth } from "./auth";

export default function Layout({ children }: LayoutProps<"/[locale]/school">) {
  return <LayoutAuth>{children}</LayoutAuth>;
}
