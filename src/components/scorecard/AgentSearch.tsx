"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AgentSearch({ agents }: { agents: { id: string; name: string }[] }) {
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const filtered = query
    ? agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search agents…"
        className="pl-8"
      />
      {filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-popover">
          {filtered.slice(0, 8).map((a) => (
            <button
              key={a.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setQuery("");
                router.push(`/scorecards/${a.id}`);
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
