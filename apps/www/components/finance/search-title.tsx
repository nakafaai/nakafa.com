import { cn } from "@repo/design-system/lib/utils";

type Props = {
  className?: string;
};

export function FinanceSearchTitle({ className }: Props) {
  return (
    <h1
      className={cn(
        "mb-8 text-pretty text-center font-medium text-4xl leading-none tracking-tighter",
        className
      )}
    >
      <span className="inline">Nakafa</span>
    </h1>
  );
}
