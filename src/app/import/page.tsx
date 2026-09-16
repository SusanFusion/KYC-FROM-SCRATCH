import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImportWorkflow } from "@/components/shared/ImportWorkflow";
import { ManualEntryForm } from "@/components/shared/ManualEntryForm";
import { ImportHistoryList } from "@/components/shared/ImportHistoryList";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { getRepository } from "@/lib/data/repository";

export default async function ImportPage() {
  const repo = await getRepository();
  const [imports, agents, periods] = await Promise.all([repo.getImports(), repo.getAgents(), repo.getPeriods()]);
  const periodOptions = periods.map((p) => ({ id: p.id, label: p.label, endDate: p.endDate }));

  return (
    <>
      <TopHeader
        title="Data Import"
        description="Upload one or more Daily/Monthly KYC Team Performance Report PDFs, or enter data manually — review before anything is saved"
      />
      <PageShell>
        {/* Covers the whole Data Import feature — uploading/parsing a PDF,
            Manual Entry (which is also how QA Audit numbers get submitted;
            there's no separate audit-submission form), and Import history's
            delete action. Viewing the rest of the app no longer needs a
            password (or a login at all) — only actions that write or remove
            the team's data do. The actual enforcement is server-side, on
            each route these components call (see requireActionAccess.ts) —
            this is just the matching UI. */}
        <PasswordGate description="Enter the shared Lead/Manager password to import, enter, or delete data.">
          <Tabs defaultValue="upload">
            <TabsList>
              <TabsTrigger value="upload">Upload PDF</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
              <ImportWorkflow periods={periodOptions} />
            </TabsContent>
            <TabsContent value="manual" className="mt-4">
              <ManualEntryForm agents={agents.map((a) => ({ id: a.id, name: a.name }))} periods={periodOptions} />
            </TabsContent>
          </Tabs>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Import history</CardTitle>
              <CardDescription>
                Every upload, whether committed or not. Deleting a committed import removes the day&apos;s data everywhere
                it&apos;s read — Team Performance, Trends, Overall MTD, Dashboard, Rankings, Scorecards, Reports, and Penalties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportHistoryList
                imports={imports.map((imp) => ({
                  id: imp.id,
                  fileName: imp.fileName,
                  uploadedAt: imp.uploadedAt,
                  periodLabel: imp.periodLabel,
                  status: imp.status,
                  rowCount: imp.rowCount,
                  periodId: imp.periodId ?? null,
                }))}
              />
            </CardContent>
          </Card>
        </PasswordGate>
      </PageShell>
    </>
  );
}
