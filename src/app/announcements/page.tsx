import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { AnnouncementsManager } from "@/components/announcements/AnnouncementsManager";
import { listAnnouncements } from "@/lib/data/announcements";

// Always read fresh -- a new post (or a Teams message pushed in) has to show up straight away.
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  let items: Awaited<ReturnType<typeof listAnnouncements>> = [];
  let loadError: string | null = null;
  try {
    items = await listAnnouncements(50);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load the updates.";
  }

  return (
    <>
      <TopHeader title="Announcements" description="The KYC Updates people see in the pop-up when they open the app" />
      <PageShell>
        {/* Everyone can read the list. The Post / Delete controls inside are
            only revealed after the shared Lead/Manager password is entered
            (see AnnouncementsManager), and the API enforces it too. */}
        <AnnouncementsManager items={items} loadError={loadError} />
      </PageShell>
    </>
  );
}
