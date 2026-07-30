const DEFAULT_BUCKET = "id-card-pdfs";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = readPayload(req);
    const upload = await createSignedPdfUpload(payload);
    sendJson(res, 200, { ok: true, ...upload });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};

async function createSignedPdfUpload(payload) {
  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  const storagePath = makeStoragePath(payload);
  const storageUrl = `${url}/storage/v1`;
  const endpoint = `${storageUrl}/object/upload/sign/${bucket}/${storagePath}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "x-upsert": "false"
    },
    body: "{}"
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || result.error || `Supabase rejected upload token request (${response.status}).`);
  }

  if (!result.url) {
    throw new Error("Supabase did not return a signed upload URL.");
  }

  const signedUrl = result.url.startsWith("http")
    ? result.url
    : `${storageUrl}${result.url}`;
  const token = new URL(signedUrl).searchParams.get("token");
  if (!token) {
    throw new Error("Supabase did not return an upload token.");
  }

  return {
    bucket,
    path: storagePath,
    token,
    signedUrl
  };
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey,
    bucket
  };
}

function readPayload(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}

function makeStoragePath(payload = {}) {
  const schoolSlug = slugify(payload.schoolName || "unknown-school");
  const fileName = safePdfFileName(payload.fileName || "student-id-card.pdf");
  const date = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const randomId = makeRandomId();
  return `${schoolSlug}/${date}/${timestamp}-${randomId}-${fileName}`;
}

function makeRandomId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
}

function safePdfFileName(value) {
  const cleaned = String(value)
    .trim()
    .replace(/[^a-z0-9_.-]/gi, "_")
    .replace(/^_+|_+$/g, "");
  const fileName = cleaned || "student-id-card";
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown-school";
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
