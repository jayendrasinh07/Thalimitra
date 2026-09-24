// @ts-nocheck -- Supabase Edge Functions use Deno and npm: specifiers outside the Vite TypeScript runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const allowedOrigins = new Set([
  "https://thalimitra.com",
  "https://www.thalimitra.com",
  "http://localhost",
  "http://localhost:3000",
  "capacitor://localhost",
]);

const responseHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://thalimitra.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
});

const accepted = (origin: string | null) => new Response(
  JSON.stringify({ accepted: true }),
  { status: 200, headers: responseHeaders(origin) },
);

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
  if (origin && !allowedOrigins.has(origin)) return new Response(JSON.stringify({ accepted: false }), { status: 403, headers: responseHeaders(origin) });
  if (request.method !== "POST") return new Response(JSON.stringify({ accepted: false }), { status: 405, headers: responseHeaders(origin) });

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return accepted(origin);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Required Supabase environment is unavailable");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (profileError || !profile) return accepted(origin);

    const { data: authIdentity, error: authIdentityError } = await admin.auth.admin.getUserById(profile.id);
    if (authIdentityError || authIdentity.user?.email?.trim().toLowerCase() !== email) return accepted(origin);

    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id);
    if (roleError) return accepted(origin);
    const roles = new Set((roleRows ?? []).map((row) => row.role));
    const isCustomerOnly = roles.has("customer")
      && !["admin", "kitchen", "delivery", "corporate"].some((role) => roles.has(role));
    if (!isCustomerOnly) return accepted(origin);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: recoveryError } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: "https://thalimitra.com/reset-password",
    });
    if (recoveryError) console.error("Customer recovery provider rejected the request", recoveryError.message);
  } catch (error) {
    console.error("Customer recovery request failed", error instanceof Error ? error.message : "unknown error");
  }
  return accepted(origin);
});
