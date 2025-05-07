import { cn } from "@/lib/utils";

type Props = {
  length?: number;
  className?: string;
};

export default function BlockArt({ length = 20, className }: Props) {
  return (
    <section className={cn("bg-foreground pb-30", className)}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={Math.random()}
          className="bg-background"
          style={{
            marginTop: `${0 + i}px`,
            height: `${20 - i}px`,
          }}
        />
      ))}
    </section>
  );
}
