import { Database, Palette, Info } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataNoteCard } from "@/components/shared/DataNoteBanner";
import { DATA_NOTES } from "@/lib/scoring";
import { APP_NAME } from "@/lib/appConfig";

export default function SettingsPage() {
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <>
      <TopHeader title="Settings" description="App configuration, data source, and data notes" />
      <PageShell>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                <Database className="h-4.5 w-4.5" />
              </span>
              <div>
                <CardTitle>Data persistence</CardTitle>
                <CardDescription>Set by environment variables — see .env.example.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mode</span>
                <Badge variant={hasSupabase ? "success" : "warning"}>{hasSupabase ? "Supabase (durable)" : "Local demo store (in-memory)"}</Badge>
              </div>
              {!hasSupabase && (
                <p className="text-xs text-muted-foreground">
                  Running without Supabase configured. Data (including anything imported this session) lives in
                  server memory and resets on cold start/redeploy. Run supabase/schema.sql against a Supabase
                  project and set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
                  SUPABASE_SERVICE_ROLE_KEY to switch to durable storage.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                <Palette className="h-4.5 w-4.5" />
              </span>
              <div>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Change NEXT_PUBLIC_APP_NAME to rebrand — no code changes needed.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">App name</span>
                <span className="font-medium text-foreground">{APP_NAME}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Theme</span>
                <span className="font-medium text-foreground">Light (fixed)</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/10 text-warning">
              <Info className="h-4.5 w-4.5" />
            </span>
            <div>
              <CardTitle>Data Notes &amp; Assumptions</CardTitle>
              <CardDescription>
                Every place this app made a judgment call because the source PDFs were ambiguous, silent, or
                internally inconsistent — nothing here was silently guessed.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {DATA_NOTES.map((note) => (
              <DataNoteCard key={note.id} note={note} />
            ))}
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
