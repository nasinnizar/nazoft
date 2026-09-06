"use client";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { CheckboxGroupContext } from "./checkbox-group";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className = "", value = "", onCheckedChange, ...props }, ref) => {
  const group = React.useContext(CheckboxGroupContext);
  const key = String(value);
  const groupChecked = group?.values.has(key);

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      value={value}
      {...props}
      checked={group ? groupChecked : props.checked}
      onCheckedChange={(state) => {
        group?.toggle(key, state === true);
        onCheckedChange?.(state);
      }}
      className={`peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ${className}`}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = "Checkbox";
