const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 4173);
const defaultBucket = "id-card-pdfs";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".bmp": "image/bmp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function handleCreatePdfUpload(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = JSON.parse(await readRequestBody(req));
    const upload = await createSignedPdfUpload(payload);
    sendJson(res, 200, { ok: true, ...upload });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 6 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

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
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || defaultBucket;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey,
    bucket
  };
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

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const routePath = url.pathname === "/t" ? "/teacher-details.html" : url.pathname;
  const requestedPath = decodeURIComponent(routePath === "/" ? "/index.html" : routePath);
  const fullPath = path.normalize(path.join(publicDir, requestedPath));
  const relativePath = path.relative(publicDir, fullPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const shouldCache = [".bmp", ".png", ".jpg", ".jpeg"].includes(ext);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": shouldCache ? "public, max-age=3600" : "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/create-pdf-upload")) {
    handleCreatePdfUpload(req, res);
    return;
  }
  if (req.url.startsWith("/api/upload-health")) {
    handleUploadHealth(req, res);
    return;
  }
  serveStatic(req, res);
});

function handleUploadHealth(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || defaultBucket;

  sendJson(res, 200, {
    ok: Boolean(supabaseUrl && serviceRoleKey && bucket),
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    bucket
  });
}

server.listen(port, () => {
  console.log(`Student ID portal running at http://localhost:${port}`);
});
