const SESSION_COOKIE = "oc_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;
const ALLOWED_CATEGORIES = new Set(["muebles", "electrodomesticos", "descanso", "jardin"]);
const ALLOWED_MOUNTING = new Set(["incluido", "opcional", "no_requiere", "consultar"]);
const ALLOWED_TRANSPORT = new Set(["incluido", "opcional", "no_disponible", "consultar"]);
const ALLOWED_STATUS = new Set(["disponible", "reservado", "vendido", "oculto"]);

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(text) {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
}

function base64UrlDecodeText(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signText(text, secret) {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function verifySignature(text, signature, secret) {
  try {
    const key = await getHmacKey(secret);
    const normalized = signature.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

async function digestText(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value ?? "")))
  );
}

async function secureEqual(a, b) {
  const [da, db] = await Promise.all([digestText(a), digestText(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

function parseCookies(request) {
  const cookie = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    cookie.split(";").map(part => part.trim()).filter(Boolean).map(part => {
      const index = part.indexOf("=");
      return index < 0 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
    })
  );
}

async function createSession(env) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET no configurado");
  const payload = base64UrlEncodeText(JSON.stringify({
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE * 1000
  }));
  const signature = await signText(payload, env.SESSION_SECRET);
  return `${payload}.${signature}`;
}

async function hasValidSession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return false;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  if (!(await verifySignature(payload, signature, env.SESSION_SECRET))) return false;

  try {
    const data = JSON.parse(base64UrlDecodeText(payload));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function isSameOriginMutation(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function cleanText(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function intValue(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolValue(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function mapStatus(status) {
  return ({
    disponible: "available",
    reservado: "reserved",
    vendido: "sold",
    oculto: "hidden"
  })[status] || "available";
}

function mapMounting(value) {
  if (value === "incluido") return ["included", "Montaje incluido"];
  if (value === "opcional") return ["optional", "Montaje opcional"];
  if (value === "no_requiere") return ["none", "No requiere montaje"];
  return ["none", "Consultar montaje"];
}

function typeLabel(type) {
  return type === "nuevo" ? "Producto nuevo" : "Segunda mano";
}

function categoryLabel(category) {
  return ({
    muebles: "Muebles",
    electrodomesticos: "Electrodomésticos",
    descanso: "Descanso",
    jardin: "Jardín"
  })[category] || category;
}

function formatPrice(row) {
  if (row.price_on_request || row.price_cents == null) return "Consultar";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(row.price_cents) / 100);
}

function mediaUrl(objectKey) {
  return `/media/${String(objectKey).split("/").map(encodeURIComponent).join("/")}`;
}

function fallbackImage(category) {
  return ({
    muebles: "assets/category-furniture.svg",
    electrodomesticos: "assets/category-appliances.svg",
    descanso: "assets/category-rest.svg",
    jardin: "assets/category-garden.svg"
  })[category] || "assets/hero-showroom.svg";
}

function publicProduct(row, images = []) {
  const [mounting, mountingLabel] = mapMounting(row.mounting);
  const orderedImages = images
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || Number(a.sort_order) - Number(b.sort_order))
    .map(img => ({
      id: img.id,
      url: mediaUrl(img.object_key),
      alt: img.alt_text || row.name,
      cover: Boolean(img.is_cover)
    }));

  const details = {};
  if (row.brand) details.Marca = row.brand;
  if (row.model) details.Modelo = row.model;
  if (row.dimensions) details.Medidas = row.dimensions;

  if (row.product_type === "nuevo") {
    details.Reposición = Number(row.supplier_lead_days) === 1
      ? "Proveedor: aprox. 1 día"
      : `Proveedor: aprox. ${Number(row.supplier_lead_days) || 7} días`;
  }

  if (row.transport && row.transport !== "consultar") {
    details.Transporte = ({
      incluido: "Incluido",
      opcional: "Opcional",
      no_disponible: "No disponible"
    })[row.transport] || "Consultar";
  }

  try {
    const extra = JSON.parse(row.specs_json || "{}");
    Object.assign(details, extra);
  } catch {}

  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    type: row.product_type === "nuevo" ? "nuevo" : "segunda-mano",
    typeLabel: typeLabel(row.product_type),
    status: mapStatus(row.status),
    stock: row.product_type === "nuevo" ? Number(row.store_stock || 0) : undefined,
    replenishment: row.product_type === "nuevo" ? Boolean(row.replenishable) : false,
    supplierLeadDays: row.product_type === "nuevo" ? Number(row.supplier_lead_days || 7) : null,
    name: row.name,
    category: row.category,
    categoryLabel: categoryLabel(row.category),
    image: orderedImages[0]?.url || fallbackImage(row.category),
    images: orderedImages,
    price: formatPrice(row),
    condition: row.condition_text || (row.product_type === "nuevo" ? "Producto nuevo" : "Buen estado"),
    mounting,
    mountingLabel,
    description: row.description || "",
    details,
    featured: Boolean(row.featured)
  };
}

async function loadImagesForProducts(env) {
  const result = await env.DB.prepare(
    "SELECT id, product_id, object_key, alt_text, sort_order, is_cover FROM product_images ORDER BY product_id, is_cover DESC, sort_order, id"
  ).all();
  const grouped = new Map();
  for (const image of result.results || []) {
    if (!grouped.has(image.product_id)) grouped.set(image.product_id, []);
    grouped.get(image.product_id).push(image);
  }
  return grouped;
}

async function publicProducts(env) {
  const { results = [] } = await env.DB.prepare(`
    SELECT *
    FROM products
    WHERE published = 1
      AND status NOT IN ('vendido', 'oculto')
    ORDER BY featured DESC, created_at DESC, id DESC
  `).all();
  const groupedImages = await loadImagesForProducts(env);
  return results.map(row => publicProduct(row, groupedImages.get(row.id) || []));
}

async function publicProductById(env, id) {
  const row = await env.DB.prepare(`
    SELECT *
    FROM products
    WHERE id = ?
      AND published = 1
      AND status NOT IN ('vendido', 'oculto')
  `).bind(id).first();
  if (!row) return null;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, product_id, object_key, alt_text, sort_order, is_cover FROM product_images WHERE product_id = ? ORDER BY is_cover DESC, sort_order, id"
  ).bind(id).all();
  return publicProduct(row, results);
}

async function healthCheck(env) {
  const result = { ok: false, d1: false, r2: false, timestamp: new Date().toISOString() };
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    result.d1 = row?.ok === 1;
  } catch (e) {
    result.d1_error = e instanceof Error ? e.message : String(e);
  }
  try {
    await env.MEDIA.list({ limit: 1 });
    result.r2 = true;
  } catch (e) {
    result.r2_error = e instanceof Error ? e.message : String(e);
  }
  result.ok = result.d1 && result.r2;
  return json(result, result.ok ? 200 : 500);
}

async function serveMedia(request, env, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  let key;
  try {
    key = pathname.slice("/media/".length).split("/").map(decodeURIComponent).join("/");
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!key) return new Response("Not Found", { status: 404 });

  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  return request.method === "HEAD"
    ? new Response(null, { headers })
    : new Response(object.body, { headers });
}

async function login(request, env) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return error("Faltan los secrets ADMIN_EMAIL, ADMIN_PASSWORD o SESSION_SECRET.", 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return error("Solicitud inválida.");
  }
  const emailOk = await secureEqual(String(body.email || "").trim().toLowerCase(), String(env.ADMIN_EMAIL).trim().toLowerCase());
  const passwordOk = await secureEqual(String(body.password || ""), String(env.ADMIN_PASSWORD));
  if (!emailOk || !passwordOk) {
    return error("Email o contraseña incorrectos.", 401);
  }
  const token = await createSession(env);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
}

function adminProductPayload(body, existing = null) {
  const productType = body.productType === "nuevo" ? "nuevo" : "segunda_mano";
  const category = ALLOWED_CATEGORIES.has(body.category) ? body.category : "muebles";
  const status = ALLOWED_STATUS.has(body.status) ? body.status : "disponible";
  const mounting = ALLOWED_MOUNTING.has(body.mounting) ? body.mounting : "consultar";
  const transport = ALLOWED_TRANSPORT.has(body.transport) ? body.transport : "consultar";
  const name = cleanText(body.name, 180);
  const reference = cleanText(body.reference, 50).toUpperCase();
  if (!name) throw new Error("El nombre es obligatorio.");
  if (!reference) throw new Error("La referencia es obligatoria.");

  const priceOnRequest = boolValue(body.priceOnRequest);
  let priceCents = null;
  if (!priceOnRequest && body.priceCents !== null && body.priceCents !== "") {
    priceCents = Math.max(0, intValue(body.priceCents, 0));
  }

  let stock = Math.max(0, intValue(body.storeStock, productType === "nuevo" ? 0 : 1));
  let replenishable = productType === "nuevo" ? 1 : 0;
  let leadDays = productType === "nuevo"
    ? Math.max(1, intValue(body.supplierLeadDays, category === "electrodomesticos" ? 1 : 7))
    : null;

  if (productType === "segunda_mano") {
    stock = status === "vendido" ? 0 : 1;
  }

  const published = status === "oculto" ? 0 : (boolValue(body.published) ? 1 : 0);
  const slug = cleanText(body.slug, 100) || slugify(`${name}-${reference}`);

  let specsJson = "{}";
  if (body.specs && typeof body.specs === "object" && !Array.isArray(body.specs)) {
    specsJson = JSON.stringify(body.specs);
  }

  return {
    reference,
    slug,
    productType,
    category,
    name,
    description: cleanText(body.description, 5000),
    brand: cleanText(body.brand, 120),
    model: cleanText(body.model, 120),
    conditionText: cleanText(body.conditionText, 180),
    dimensions: cleanText(body.dimensions, 180),
    priceCents,
    priceOnRequest: priceOnRequest ? 1 : 0,
    stock,
    replenishable,
    leadDays,
    mounting,
    transport,
    status,
    specsJson,
    published,
    featured: boolValue(body.featured) ? 1 : 0,
    previousStock: existing ? Number(existing.store_stock || 0) : null
  };
}

async function adminDashboard(env) {
  const row = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN product_type = 'segunda_mano' AND status NOT IN ('vendido','oculto') THEN 1 ELSE 0 END) AS second_hand,
      SUM(CASE WHEN product_type = 'nuevo' AND status != 'oculto' THEN 1 ELSE 0 END) AS new_products,
      SUM(CASE WHEN product_type = 'nuevo' AND status != 'oculto' THEN store_stock ELSE 0 END) AS new_units,
      SUM(CASE WHEN status = 'vendido' THEN 1 ELSE 0 END) AS sold
    FROM products
  `).first();
  return json({
    ok: true,
    stats: {
      secondHand: Number(row?.second_hand || 0),
      newProducts: Number(row?.new_products || 0),
      newUnits: Number(row?.new_units || 0),
      sold: Number(row?.sold || 0)
    }
  });
}

async function adminProducts(env, url) {
  const requestedType = url.searchParams.get("type");
  let sql = "SELECT * FROM products";
  const bindings = [];
  if (requestedType === "nuevo" || requestedType === "segunda_mano") {
    sql += " WHERE product_type = ?";
    bindings.push(requestedType);
  }
  sql += " ORDER BY updated_at DESC, id DESC";
  const statement = bindings.length ? env.DB.prepare(sql).bind(...bindings) : env.DB.prepare(sql);
  const { results = [] } = await statement.all();

  const groupedImages = await loadImagesForProducts(env);
  const items = results.map(row => ({
    id: row.id,
    reference: row.reference,
    productType: row.product_type,
    category: row.category,
    name: row.name,
    description: row.description,
    brand: row.brand,
    model: row.model,
    conditionText: row.condition_text,
    dimensions: row.dimensions,
    priceCents: row.price_cents,
    priceOnRequest: Boolean(row.price_on_request),
    storeStock: Number(row.store_stock || 0),
    replenishable: Boolean(row.replenishable),
    supplierLeadDays: row.supplier_lead_days,
    mounting: row.mounting,
    transport: row.transport,
    status: row.status,
    published: Boolean(row.published),
    featured: Boolean(row.featured),
    images: (groupedImages.get(row.id) || []).map(img => ({
      id: img.id,
      url: mediaUrl(img.object_key),
      alt: img.alt_text,
      cover: Boolean(img.is_cover),
      sortOrder: img.sort_order
    })),
    updatedAt: row.updated_at
  }));
  return json({ ok: true, products: items });
}

async function createProduct(request, env) {
  let body;
  try { body = await request.json(); } catch { return error("JSON inválido."); }

  let p;
  try { p = adminProductPayload(body); } catch (e) { return error(e.message); }

  try {
    const result = await env.DB.prepare(`
      INSERT INTO products (
        reference, slug, product_type, category, name, description,
        brand, model, condition_text, dimensions,
        price_cents, price_on_request,
        store_stock, replenishable, supplier_lead_days,
        mounting, transport, status, specs_json,
        published, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      p.reference, p.slug, p.productType, p.category, p.name, p.description,
      p.brand, p.model, p.conditionText, p.dimensions,
      p.priceCents, p.priceOnRequest,
      p.stock, p.replenishable, p.leadDays,
      p.mounting, p.transport, p.status, p.specsJson,
      p.published, p.featured
    ).run();

    const id = Number(result.meta?.last_row_id);
    if (id && p.stock !== 0) {
      await env.DB.prepare(`
        INSERT INTO stock_movements (product_id, stock_before, stock_after, change_qty, reason, notes)
        VALUES (?, 0, ?, ?, 'alta', 'Stock inicial')
      `).bind(id, p.stock, p.stock).run();
    }
    return json({ ok: true, id }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes("unique")) return error("La referencia o el slug ya existen.", 409);
    return error(`No se ha podido crear el producto: ${message}`, 500);
  }
}

async function updateProduct(request, env, id) {
  const existing = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  if (!existing) return error("Producto no encontrado.", 404);

  let body;
  try { body = await request.json(); } catch { return error("JSON inválido."); }

  let p;
  try { p = adminProductPayload(body, existing); } catch (e) { return error(e.message); }

  try {
    await env.DB.prepare(`
      UPDATE products SET
        reference = ?, slug = ?, product_type = ?, category = ?, name = ?, description = ?,
        brand = ?, model = ?, condition_text = ?, dimensions = ?,
        price_cents = ?, price_on_request = ?,
        store_stock = ?, replenishable = ?, supplier_lead_days = ?,
        mounting = ?, transport = ?, status = ?, specs_json = ?,
        published = ?, featured = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      p.reference, p.slug, p.productType, p.category, p.name, p.description,
      p.brand, p.model, p.conditionText, p.dimensions,
      p.priceCents, p.priceOnRequest,
      p.stock, p.replenishable, p.leadDays,
      p.mounting, p.transport, p.status, p.specsJson,
      p.published, p.featured, id
    ).run();

    if (p.previousStock !== p.stock) {
      await env.DB.prepare(`
        INSERT INTO stock_movements (product_id, stock_before, stock_after, change_qty, reason, notes)
        VALUES (?, ?, ?, ?, 'ajuste_admin', 'Actualización desde panel')
      `).bind(id, p.previousStock, p.stock, p.stock - p.previousStock).run();
    }
    return json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes("unique")) return error("La referencia o el slug ya existen.", 409);
    return error(`No se ha podido actualizar el producto: ${message}`, 500);
  }
}

async function quickStock(request, env, id) {
  const existing = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  if (!existing) return error("Producto no encontrado.", 404);
  if (existing.product_type !== "nuevo") return error("El contador de stock solo se usa en productos nuevos.");

  let body;
  try { body = await request.json(); } catch { return error("JSON inválido."); }
  const next = Math.max(0, intValue(body.stock, existing.store_stock));
  const before = Number(existing.store_stock || 0);

  await env.DB.batch([
    env.DB.prepare("UPDATE products SET store_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(next, id),
    env.DB.prepare(`
      INSERT INTO stock_movements (product_id, stock_before, stock_after, change_qty, reason, notes)
      VALUES (?, ?, ?, ?, 'ajuste_rapido', ?)
    `).bind(id, before, next, next - before, cleanText(body.notes || "Ajuste rápido desde panel", 500))
  ]);
  return json({ ok: true, stock: next });
}

async function deleteProduct(env, id) {
  const product = await env.DB.prepare("SELECT reference FROM products WHERE id = ?").bind(id).first();
  if (!product) return error("Producto no encontrado.", 404);

  const { results = [] } = await env.DB.prepare(
    "SELECT object_key FROM product_images WHERE product_id = ?"
  ).bind(id).all();

  await Promise.all(results.map(img => env.MEDIA.delete(img.object_key)));
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

function safeExtension(file) {
  const typeMap = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png"
  };
  return typeMap[file.type] || null;
}

async function uploadImages(request, env, productId) {
  const product = await env.DB.prepare(
    "SELECT id, reference, product_type, name FROM products WHERE id = ?"
  ).bind(productId).first();
  if (!product) return error("Producto no encontrado.", 404);

  const form = await request.formData();
  const files = form.getAll("images").filter(value => value instanceof File);
  if (!files.length) return error("Selecciona al menos una imagen.");
  if (files.length > 12) return error("Máximo 12 imágenes por subida.");

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?"
  ).bind(productId).first();
  const existingCount = Number(countRow?.total || 0);
  if (existingCount + files.length > 20) return error("Máximo 20 imágenes por producto.");

  const orderRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM product_images WHERE product_id = ?"
  ).bind(productId).first();
  let nextOrder = Number(orderRow?.max_order ?? -1) + 1;

  const folderType = product.product_type === "nuevo" ? "nuevos" : "segunda-mano";
  const uploaded = [];

  for (const file of files) {
    const ext = safeExtension(file);
    if (!ext) return error("Solo se admiten imágenes WebP, JPG o PNG.");
    if (file.size > 8 * 1024 * 1024) return error(`La imagen ${file.name} supera 8 MB.`);

    const key = `productos/${folderType}/${product.reference}/${String(nextOrder + 1).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    const isCover = existingCount === 0 && uploaded.length === 0 ? 1 : 0;
    const dbResult = await env.DB.prepare(`
      INSERT INTO product_images (product_id, object_key, alt_text, sort_order, is_cover)
      VALUES (?, ?, ?, ?, ?)
    `).bind(productId, key, product.name, nextOrder, isCover).run();

    uploaded.push({
      id: Number(dbResult.meta?.last_row_id),
      url: mediaUrl(key),
      cover: Boolean(isCover)
    });
    nextOrder++;
  }

  return json({ ok: true, images: uploaded }, 201);
}

async function deleteImage(env, imageId) {
  const image = await env.DB.prepare(
    "SELECT id, product_id, object_key, is_cover FROM product_images WHERE id = ?"
  ).bind(imageId).first();
  if (!image) return error("Imagen no encontrada.", 404);

  await env.MEDIA.delete(image.object_key);
  await env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(imageId).run();

  if (image.is_cover) {
    const next = await env.DB.prepare(
      "SELECT id FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1"
    ).bind(image.product_id).first();
    if (next) {
      await env.DB.prepare("UPDATE product_images SET is_cover = 1 WHERE id = ?").bind(next.id).run();
    }
  }
  return json({ ok: true });
}

async function setCover(env, imageId) {
  const image = await env.DB.prepare(
    "SELECT id, product_id FROM product_images WHERE id = ?"
  ).bind(imageId).first();
  if (!image) return error("Imagen no encontrada.", 404);

  await env.DB.batch([
    env.DB.prepare("UPDATE product_images SET is_cover = 0 WHERE product_id = ?").bind(image.product_id),
    env.DB.prepare("UPDATE product_images SET is_cover = 1 WHERE id = ?").bind(imageId)
  ]);
  return json({ ok: true });
}

async function handleApi(request, env, url) {
  const path = url.pathname;

  if (path === "/api/health" && request.method === "GET") return healthCheck(env);

  if (path === "/api/products" && request.method === "GET") {
    try {
      return json({ ok: true, products: await publicProducts(env) });
    } catch (e) {
      return error(`No se ha podido leer el catálogo: ${e instanceof Error ? e.message : String(e)}`, 500);
    }
  }

  const publicMatch = path.match(/^\/api\/products\/(\d+)$/);
  if (publicMatch && request.method === "GET") {
    const product = await publicProductById(env, Number(publicMatch[1]));
    return product ? json({ ok: true, product }) : error("Producto no encontrado.", 404);
  }

  if (path === "/api/admin/login" && request.method === "POST") return login(request, env);
  if (path === "/api/admin/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  const validSession = await hasValidSession(request, env);
  if (path === "/api/admin/session" && request.method === "GET") {
    return validSession ? json({ ok: true, authenticated: true }) : error("No autorizado.", 401);
  }

  if (!validSession) return error("No autorizado.", 401);
  if (!isSameOriginMutation(request)) return error("Origen no permitido.", 403);

  if (path === "/api/admin/dashboard" && request.method === "GET") return adminDashboard(env);
  if (path === "/api/admin/products" && request.method === "GET") return adminProducts(env, url);
  if (path === "/api/admin/products" && request.method === "POST") return createProduct(request, env);

  const productMatch = path.match(/^\/api\/admin\/products\/(\d+)$/);
  if (productMatch && request.method === "PUT") return updateProduct(request, env, Number(productMatch[1]));
  if (productMatch && request.method === "DELETE") return deleteProduct(env, Number(productMatch[1]));

  const stockMatch = path.match(/^\/api\/admin\/products\/(\d+)\/stock$/);
  if (stockMatch && request.method === "PATCH") return quickStock(request, env, Number(stockMatch[1]));

  const uploadMatch = path.match(/^\/api\/admin\/products\/(\d+)\/images$/);
  if (uploadMatch && request.method === "POST") return uploadImages(request, env, Number(uploadMatch[1]));

  const imageMatch = path.match(/^\/api\/admin\/images\/(\d+)$/);
  if (imageMatch && request.method === "DELETE") return deleteImage(env, Number(imageMatch[1]));

  const coverMatch = path.match(/^\/api\/admin\/images\/(\d+)\/cover$/);
  if (coverMatch && request.method === "PATCH") return setCover(env, Number(coverMatch[1]));

  return error("Ruta API no encontrada.", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (e) {
        return error(e instanceof Error ? e.message : "Error interno.", 500);
      }
    }

    if (pathname.startsWith("/media/")) {
      return serveMedia(request, env, pathname);
    }

    if (pathname === "/admin") {
      return Response.redirect(`${url.origin}/admin/`, 302);
    }

    return env.ASSETS.fetch(request);
  }
};
