import { VercelAnalytics } from "@repo/analytics/vercel";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <VercelAnalytics />
      </body>
    </html>
  );
}
