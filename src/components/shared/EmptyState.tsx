import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center animate-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary-50 shadow-inner ring-1 ring-primary-200">
        <Icon className="h-7 w-7 text-primary-600" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className={buttonVariants({ className: "mt-5" })}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
