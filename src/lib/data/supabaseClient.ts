import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Next.js's App Router patches the global `fetch` and, by default, caches
// its responses in the server-side Data Cache — indefinitely, independent
// of whether the *route* is statically or dynamically rendered. The
// supabase-js client makes all of its REST calls through that same global
// `fetch`, so without this override every read (getPeriods, getGateMetrics,
// getRawMetrics, …) can silently be served from a stale cached response
// instead of hitting the database — which looks exactly like "my save
// isn't showing up," because the very next read after a successful write
// can still return the pre-write snapshot. Forcing `cache: "no-store"` on
// every request this client makes is what makes each read actually current.
function noStoreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

/** Browser/anon-key client — respects RLS. Safe to use in server components too. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  client = createClient(url, anonKey, { global: { fetch: noStoreFetch } });
  return client;
}

/**
 * Server-only client using the service-role key, for writes that must
 * bypass RLS (e.g. committing a validated import). NEVER import this from a
 * "use client" component — it is only ever used inside API routes /
 * server actions, and the key is never exposed to the browser bundle
 * because it has no NEXT_PUBLIC_ prefix.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false }, global: { fetch: noStoreFetch } });
}
