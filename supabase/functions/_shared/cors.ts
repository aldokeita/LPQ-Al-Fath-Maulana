export function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  const env = Deno.env.get("FUNCTION_ENV") ?? "development";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const isVercelPreview = /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i.test(origin);

  const allowOrigin = allowed.includes(origin) || isVercelPreview
    ? origin
    : env === "production"
      ? allowed[0] ?? "http://localhost:5173"
      : "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { headers: getCorsHeaders(req) });
}
