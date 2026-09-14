import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";

// TEMPORARY diagnostic route — safe to leave in for now (reveals no secrets,
// only booleans/prefixes of already-public NEXT_PUBLIC_ values and which
// repository is active), but delete this file once the Supabase
// configuration issue is confirmed fixed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  const repo = await getRepository();
  let periodCount: number | string = "error";
  try {
    periodCount = (await repo.getPeriods()).length;
  } catch (err) {
    periodCount = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    repositoryInUse: repo.constructor.name,
    NEXT_PUBLIC_SUPABASE_URL_present: !!url,
    NEXT_PUBLIC_SUPABASE_URL_value: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: !!anonKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_length: anonKey?.length ?? 0,
    SUPABASE_SERVICE_ROLE_KEY_present: !!serviceKey,
    periodsSeenByThisInstance: periodCount,
  });
}
