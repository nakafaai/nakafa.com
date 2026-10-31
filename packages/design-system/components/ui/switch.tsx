import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "pressable peer focus-visible:border-ring focus-visible:ring-ring/50 data-checked:bg-primary data-unchecked:bg-input inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-[scale,background-color,border-color,box-shadow] outline-none focus-visible:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "bg-background dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
