import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImportWorkflow } from "@/components/shared/ImportWorkflow";
import { ManualEntryForm } from "@/components/shared/ManualEntryForm";
import { getRepository } from "@/lib/data/repository";
import { formatDate } from "@/lib/utils";

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
            <CardDescription>Every upload, whether committed or not.</CardDescription>
          </CardHeader>
          <CardContent>
            {imports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {imports.map((imp) => (
                  <li key={imp.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{imp.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDate(imp.uploadedAt)} · {imp.rowCount} rows
                        {imp.periodLabel ? ` · ${imp.periodLabel}` : ""}
                      </p>
                    </div>
                    <Badge variant={imp.status === "committed" ? "success" : imp.status === "failed" ? "danger" : "outline"}>
                      {imp.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
