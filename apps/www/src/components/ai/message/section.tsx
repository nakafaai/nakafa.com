import type { ReactNode } from "react";

/** Spaces a message's activity and response sections with one rhythm. */
export function MessageSections({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6 empty:hidden">{children}</div>;
}

/** Groups consecutive work steps or answer parts of one message. */
export function MessageSection({
  children,
  kind,
}: {
  children: ReactNode;
  kind: "activity" | "response";
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-4 empty:hidden"
      data-slot={`message-${kind}`}
    >
      {children}
    </div>
  );
}
