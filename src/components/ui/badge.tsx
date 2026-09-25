import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground border-border",
        primary: "bg-primary-50 text-primary-700 border-primary-100 font-semibold",
        success: "bg-success/12 text-success border-success/25 font-semibold",
        warning: "bg-warning/12 text-warning border-warning/25 font-semibold",
        danger: "bg-danger/12 text-danger border-danger/25 font-semibold",
        outline: "bg-transparent text-muted-foreground border-border",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
