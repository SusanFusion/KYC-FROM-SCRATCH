import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-7 w-7 text-muted-foreground" />
      </span>
      <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The agent, report, or page you&apos;re looking for doesn&apos;t exist or hasn&apos;t been imported yet.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-5" })}>
        Back to Dashboard
      </Link>
    </div>
  );
}
