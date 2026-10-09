// The "KYC Updates" announcements shown in the start-up pop-up. Messages get
// in two ways -- a Lead posts one on the Announcements page, or a Power
// Automate flow pushes each new Teams message to /api/announcements/ingest --
// and the pop-up always shows the 3 newest, however they arrived.
//
// Stored in the existing `audit_logs` table (entity = "announcement"), the same
// way the Raw Data change history is, so no new table / SQL is needed. That
// table has no anon read policy, so everything here goes through the
// service-role client and only ever runs server-side. When Supabase isn't
// configured (zero-config in-memory mode) the list is kept in memory instead.
import { getSupabaseServiceClient } from "./supabaseClient";

export type AnnouncementSource = "manual" | "teams";

export interface Announcement {
  id: string;
  author: string;
  text: string;
  /** When it was posted (for Teams messages: when it was sent in Teams). ISO string. */
  postedAt: string;
  source: AnnouncementSource;
}

export const MAX_ANNOUNCEMENT_LENGTH = 2000;
const ENTITY = "announcement";

function usesSupabase(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

const globalKey = "__kycAnnouncements__";
type GlobalWithList = typeof globalThis & { [globalKey]?: (Announcement & { sourceId: string })[] };
const g = globalThis as GlobalWithList;
if (!g[globalKey]) g[globalKey] = [];
const memoryList = g[globalKey]!;

// ── Text cleaning ────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

/** Teams sends message bodies as HTML. This turns that into plain text (line
 *  breaks kept) so it can be shown safely as text -- it's never injected as HTML. */
export function htmlToPlainText(input: string): string {
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      const lower = code.toLowerCase();
      if (lower in NAMED_ENTITIES) return NAMED_ENTITIES[lower]!;
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return whole;
    })
    .replace(/\u00a0/g, " ");
}

/** Trim, tidy blank lines, and cap the length. */
export function tidyText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""));
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > MAX_ANNOUNCEMENT_LENGTH ? `${text.slice(0, MAX_ANNOUNCEMENT_LENGTH - 1).trimEnd()}…` : text;
}

/** Compares a secret without bailing out at the first wrong character. */
export function secretMatches(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const a = provided;
  const b = expected;
  let diff = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export type IngestParse =
  | { ok: true; author: string; text: string; sourceId: string | undefined; postedAt: string | undefined }
  | { ok: false; error: string };

/** Validates what Power Automate (or anything else) sends to the ingest endpoint. */
export function parseIngestBody(body: unknown): IngestParse {
  if (!body || typeof body !== "object") return { ok: false, error: "Send a JSON body with at least a \"text\" field." };
  const b = body as Record<string, unknown>;
  const rawText = typeof b.text === "string" ? b.text : "";
  const text = tidyText(htmlToPlainText(rawText));
  if (!text) return { ok: false, error: "\"text\" is empty." };

  const author = (typeof b.author === "string" ? htmlToPlainText(b.author).trim() : "").slice(0, 120) || "Teams";
  const sourceId = typeof b.messageId === "string" && b.messageId.trim() ? b.messageId.trim().slice(0, 200) : undefined;

  let postedAt: string | undefined;
  if (typeof b.sentAt === "string" && b.sentAt.trim()) {
    const d = new Date(b.sentAt);
    if (!Number.isNaN(d.getTime())) postedAt = d.toISOString();
  }
  return { ok: true, author, text, sourceId, postedAt };
}

// ── Storage ──────────────────────────────────────────────────────────────

export interface NewAnnouncement {
  author: string;
  text: string;
  source: AnnouncementSource;
  /** The Teams message id -- a message that's pushed twice is only stored once. */
  sourceId?: string;
  postedAt?: string;
}

export type AddResult = { ok: true; announcement: Announcement; duplicate: boolean } | { ok: false; error: string };

export async function addAnnouncement(entry: NewAnnouncement): Promise<AddResult> {
  const text = tidyText(entry.text);
  const author = entry.author.trim();
  if (!text) return { ok: false, error: "The message is empty." };
  if (!author) return { ok: false, error: "Say who is posting this." };

  const postedAt = entry.postedAt ?? new Date().toISOString();
  const sourceId = entry.sourceId ?? `${entry.source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (!usesSupabase()) {
    const existing = entry.sourceId ? memoryList.find((a) => a.sourceId === entry.sourceId) : undefined;
    if (existing) return { ok: true, announcement: existing, duplicate: true };
    const record = { id: `ann_${Date.now()}_${memoryList.length}`, author, text, postedAt, source: entry.source, sourceId };
    memoryList.unshift(record);
    return { ok: true, announcement: record, duplicate: false };
  }

  const db = getSupabaseServiceClient();
  if (entry.sourceId) {
    const { data: found, error: findError } = await db.from("audit_logs").select("id").eq("entity", ENTITY).eq("entity_id", sourceId).limit(1);
    if (findError) throw findError;
    if (found && found.length > 0) {
      return { ok: true, announcement: { id: String(found[0]!.id), author, text, postedAt, source: entry.source }, duplicate: true };
    }
  }

  const { data, error } = await db
    .from("audit_logs")
    .insert({ actor: author, action: "post", entity: ENTITY, entity_id: sourceId, detail: { text, postedAt, source: entry.source } })
    .select("id")
    .single();
  if (error) throw error;
  return { ok: true, announcement: { id: String((data as { id: string }).id), author, text, postedAt, source: entry.source }, duplicate: false };
}

/** Newest first -- by when each one reached the app. */
export async function listAnnouncements(limit = 50): Promise<Announcement[]> {
  if (!usesSupabase()) {
    return memoryList.slice(0, limit).map(({ sourceId: _sourceId, ...rest }) => rest);
  }
  const { data, error } = await getSupabaseServiceClient()
    .from("audit_logs")
    .select("id, actor, detail, created_at")
    .eq("entity", ENTITY)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const detail = (row.detail ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id),
      author: String(row.actor ?? ""),
      text: String(detail.text ?? ""),
      postedAt: typeof detail.postedAt === "string" ? detail.postedAt : String(row.created_at),
      source: detail.source === "teams" ? "teams" : "manual",
    } satisfies Announcement;
  });
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (!usesSupabase()) {
    const i = memoryList.findIndex((a) => a.id === id);
    if (i < 0) return false;
    memoryList.splice(i, 1);
    return true;
  }
  const { data, error } = await getSupabaseServiceClient().from("audit_logs").delete().eq("entity", ENTITY).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
