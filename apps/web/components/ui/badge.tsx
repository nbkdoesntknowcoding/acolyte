import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
        destructive: "border border-red-500/30 bg-red-500/10 text-red-500",
        warning: "border border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
        info: "border border-blue-500/30 bg-blue-500/10 text-blue-500",
        outline: "border border-dark-border text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
