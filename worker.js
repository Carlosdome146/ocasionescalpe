function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

async function healthCheck(env) {
  const result = {
    ok: false,
    d1: false,
    r2: false,
    timestamp: new Date().toISOString()
  };

  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    result.d1 = row?.ok === 1;
  } catch (error) {
    result.d1_error = error instanceof Error ? error.message : String(error);
  }

  try {
    await env.MEDIA.list({ limit: 1 });
    result.r2 = true;
  } catch (error) {
    result.r2_error = error instanceof Error ? error.message : String(error);
  }

  result.ok = result.d1 && result.r2;
  return json(result, result.ok ? 200 : 500);
}

async function serveMedia(request, env, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  let key;
  try {
    key = decodeURIComponent(pathname.slice("/media/".length));
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (!key) {
    return new Response("Not Found", { status: 404 });
  }

  const object = await env.MEDIA.get(key);

  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");

  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }

  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return healthCheck(env);
    }

    if (pathname.startsWith("/media/")) {
      return serveMedia(request, env, pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
