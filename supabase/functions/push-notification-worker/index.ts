// @ts-nocheck -- Supabase Edge Functions run on Deno.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { importPKCS8, SignJWT } from "npm:jose@6.1.0";

type Delivery = {
  outbox_id: string;
  push_token: string;
  title: string;
  body: string;
  target_key: string;
  event_type: string;
  notification_id: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

const oauthToken = async (serviceAccount: any) => {
  const key = await importPKCS8(serviceAccount.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(serviceAccount.token_uri || "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`oauth_${response.status}`);
  const payload = await response.json();
  return payload.access_token as string;
};

const permanentFcmFailure = (status: number, detail: string) =>
  status === 404 || status === 410 || /UNREGISTERED|INVALID_ARGUMENT|SENDER_ID_MISMATCH/i.test(detail);

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const workerSecret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
  if (!workerSecret || request.headers.get("x-worker-key") !== workerSecret) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!supabaseUrl || !serviceRoleKey || !serviceAccountRaw) return json({ error: "configuration_unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("claim_notification_deliveries", { p_batch_size: 50, p_lease_seconds: 180 });
  if (error) return json({ error: "claim_failed" }, 500);
  const deliveries = (data || []) as Delivery[];
  if (!deliveries.length) return json({ claimed: 0, sent: 0, failed: 0 });

  let serviceAccount: any;
  let token: string;
  try {
    serviceAccount = JSON.parse(serviceAccountRaw);
    token = await oauthToken(serviceAccount);
  } catch {
    return json({ error: "firebase_auth_failed", claimed: deliveries.length }, 503);
  }

  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    let success = false;
    let providerMessageId: string | null = null;
    let errorCode: string | null = null;
    let permanent = false;
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ message: {
          token: delivery.push_token,
          notification: { title: delivery.title, body: delivery.body },
          data: {
            targetKey: delivery.target_key,
            eventType: delivery.event_type,
            notificationId: delivery.notification_id,
          },
          android: { priority: "high", notification: { channel_id: "thalimitra_orders", sound: "default" } },
        } }),
      });
      const detail = await response.text();
      success = response.ok;
      if (success) {
        providerMessageId = JSON.parse(detail || "{}").name || null;
        sent += 1;
      } else {
        errorCode = `fcm_${response.status}`;
        permanent = permanentFcmFailure(response.status, detail);
        failed += 1;
      }
    } catch {
      errorCode = "fcm_network_error";
      failed += 1;
    }
    await admin.rpc("complete_notification_delivery", {
      p_outbox_id: delivery.outbox_id,
      p_success: success,
      p_provider_message_id: providerMessageId,
      p_error_code: errorCode,
      p_permanent_failure: permanent,
    });
  }
  return json({ claimed: deliveries.length, sent, failed });
});
