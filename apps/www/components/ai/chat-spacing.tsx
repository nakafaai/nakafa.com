import { cn } from "cn";

export function ChatSpacing({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-12", className)} {...props} />;
}
