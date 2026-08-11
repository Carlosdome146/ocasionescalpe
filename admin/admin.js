const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let currentType = "segunda_mano";
let products = [];
let editingProduct = null;

const loginView = $("#login-view");
const dashboardView = $("#dashboard-view");
const dialog = $("#product-dialog");
const form = $("#product-form");

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function showError(el, message = "") {
  el.textContent = message;
  el.hidden = !message;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Error ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

function euro(cents, onRequest) {
  if (onRequest || cents == null) return "Consultar";
  return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(cents / 100);
}

function typePrefix(type) {
  return type === "nuevo" ? "OC-N-" : "OC-SM-";
}

function suggestReference(type) {
  const prefix = typePrefix(type);
  const nums = products
    .filter(p => p.productType === type && p.reference.startsWith(prefix))
    .map(p => Number.parseInt(p.reference.slice(prefix.length), 10))
    .filter(Number.isFinite);
  return `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

function statusChip(status) {
  const map = {
    disponible:["Disponible","available"],
    reservado:["Reservado","reserved"],
    vendido:["Vendido","sold"],
    oculto:["Oculto","hidden"]
  };
  const [label, cls] = map[status] || map.disponible;
  return `<span class="state-chip state-chip--${cls}">${label}</span>`;
}

function categoryName(value) {
  return ({muebles:"Muebles",electrodomesticos:"Electrodomésticos",descanso:"Descanso",jardin:"Jardín"})[value] || value;
}

function renderRows() {
  const term = $("#admin-search").value.trim().toLowerCase();
  const category = $("#admin-category").value;
  const filtered = products.filter(p =>
    p.productType === currentType &&
    (!category || p.category === category) &&
    `${p.name} ${p.reference}`.toLowerCase().includes(term)
  );

  $("#stock-header").textContent = currentType === "nuevo" ? "Stock / proveedor" : "Estado";
  $("#admin-empty").hidden = filtered.length > 0;

  $("#products-body").innerHTML = filtered.map(p => {
    const thumb = p.images?.[0]?.url || "../assets/hero-showroom.svg";
    const stock = currentType === "nuevo"
      ? `<div class="stock-control">
          <button type="button" data-stock="${p.id}" data-delta="-1" aria-label="Restar una unidad">−</button>
          <strong>${p.storeStock}</strong>
          <button type="button" data-stock="${p.id}" data-delta="1" aria-label="Sumar una unidad">+</button>
        </div>
        <span class="supplier-note">Proveedor: ${Number(p.supplierLeadDays) === 1 ? "aprox. 1 día" : `aprox. ${p.supplierLeadDays || 7} días`}</span>`
      : statusChip(p.status);

    return `<tr>
      <td>
        <div class="product-cell">
          <img class="product-thumb" src="${thumb}" alt="">
          <div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.reference)}</small></div>
        </div>
      </td>
      <td><span class="category-chip">${categoryName(p.category)}</span></td>
      <td><strong>${euro(p.priceCents, p.priceOnRequest)}</strong></td>
      <td>${stock}</td>
      <td><span class="publish-chip ${p.published ? "publish-chip--yes" : "publish-chip--no"}">${p.published ? "Publicado" : "No publicado"}</span></td>
      <td><div class="row-actions"><button class="admin-btn admin-btn--ghost" type="button" data-edit="${p.id}">Editar</button></div></td>
    </tr>`;
  }).join("");

  $$("[data-edit]").forEach(btn => btn.addEventListener("click", () => openEdit(Number(btn.dataset.edit))));
  $$("[data-stock]").forEach(btn => btn.addEventListener("click", () => adjustStock(Number(btn.dataset.stock), Number(btn.dataset.delta))));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);
}

async function loadAll() {
  const [productData, dashboard] = await Promise.all([
    api("/api/admin/products"),
    api("/api/admin/dashboard")
  ]);
  products = productData.products || [];
  $("#kpi-second").textContent = dashboard.stats.secondHand;
  $("#kpi-new").textContent = dashboard.stats.newProducts;
  $("#kpi-units").textContent = dashboard.stats.newUnits;
  $("#kpi-sold").textContent = dashboard.stats.sold;
  renderRows();
}

function setType(type) {
  currentType = type;
  $$(".admin-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === type));
  renderRows();
}

function syncProductTypeFields() {
  const isNew = $("#product-type").value === "nuevo";
  $("#new-stock-fields").hidden = !isNew;

  if (isNew && !editingProduct) {
    const defaultDays = $("#category").value === "electrodomesticos" ? "1" : "7";
    $("#lead-days").value = defaultDays;
  }

  if (!isNew) {
    $("#store-stock").value = 1;
  }
}

function clearForm(type) {
  editingProduct = null;
  form.reset();
  $("#product-id").value = "";
  $("#product-type").value = type;
  $("#reference").value = suggestReference(type);
  $("#published").checked = true;
  $("#status").value = "disponible";
  $("#price-on-request").checked = true;
  $("#mounting").value = "consultar";
  $("#transport").value = "consultar";
  $("#store-stock").value = 0;
  $("#lead-days").value = type === "nuevo" ? "7" : "7";
  $("#images-section").hidden = true;
  $("#delete-product").hidden = true;
  $("#modal-kicker").textContent = type === "nuevo" ? "PRODUCTO NUEVO" : "SEGUNDA MANO";
  $("#modal-title").textContent = "Nuevo producto";
  $("#image-list").innerHTML = "";
  showError($("#form-error"));
  syncProductTypeFields();
}

function openNew(type) {
  clearForm(type);
  dialog.showModal();
}

function openEdit(id) {
  const p = products.find(item => item.id === id);
  if (!p) return;
  editingProduct = p;

  $("#product-id").value = p.id;
  $("#reference").value = p.reference;
  $("#product-type").value = p.productType;
  $("#name").value = p.name;
  $("#category").value = p.category;
  $("#status").value = p.status;
  $("#brand").value = p.brand || "";
  $("#model").value = p.model || "";
  $("#condition-text").value = p.conditionText || "";
  $("#dimensions").value = p.dimensions || "";
  $("#price").value = p.priceCents == null ? "" : (p.priceCents / 100).toFixed(2);
  $("#price-on-request").checked = p.priceOnRequest;
  $("#store-stock").value = p.storeStock;
  $("#lead-days").value = String(p.supplierLeadDays || (p.category === "electrodomesticos" ? 1 : 7));
  $("#mounting").value = p.mounting;
  $("#transport").value = p.transport;
  $("#description").value = p.description || "";
  $("#published").checked = p.published;
  $("#featured").checked = p.featured;

  $("#modal-kicker").textContent = p.productType === "nuevo" ? "PRODUCTO NUEVO" : "SEGUNDA MANO";
  $("#modal-title").textContent = p.name;
  $("#images-section").hidden = false;
  $("#delete-product").hidden = false;
  showError($("#form-error"));
  syncProductTypeFields();
  renderImages(p.images || []);
  dialog.showModal();
}

function renderImages(images) {
  $("#image-list").innerHTML = images.length ? images.map(img => `
    <article class="admin-image ${img.cover ? "cover" : ""}">
      <img src="${img.url}" alt="">
      <div class="admin-image__tools">
        ${img.cover ? "<button type='button' disabled>Portada</button>" : `<button type="button" data-cover="${img.id}">Portada</button>`}
        <button type="button" data-delete-image="${img.id}">Borrar</button>
      </div>
    </article>
  `).join("") : `<p>No hay imágenes todavía.</p>`;

  $$("[data-cover]").forEach(btn => btn.addEventListener("click", async () => {
    await api(`/api/admin/images/${btn.dataset.cover}/cover`, { method:"PATCH", body:"{}" });
    toast("Portada actualizada");
    await loadAll();
    editingProduct = products.find(p => p.id === Number($("#product-id").value));
    renderImages(editingProduct?.images || []);
  }));

  $$("[data-delete-image]").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("¿Borrar esta imagen?")) return;
    await api(`/api/admin/images/${btn.dataset.deleteImage}`, { method:"DELETE" });
    toast("Imagen eliminada");
    await loadAll();
    editingProduct = products.find(p => p.id === Number($("#product-id").value));
    renderImages(editingProduct?.images || []);
  }));
}

function formPayload() {
  const price = $("#price").value.trim();
  return {
    reference: $("#reference").value.trim(),
    productType: $("#product-type").value,
    name: $("#name").value.trim(),
    category: $("#category").value,
    status: $("#status").value,
    brand: $("#brand").value.trim(),
    model: $("#model").value.trim(),
    conditionText: $("#condition-text").value.trim(),
    dimensions: $("#dimensions").value.trim(),
    priceCents: price ? Math.round(Number(price) * 100) : null,
    priceOnRequest: $("#price-on-request").checked,
    storeStock: Number($("#store-stock").value || 0),
    supplierLeadDays: Number($("#lead-days").value || 7),
    mounting: $("#mounting").value,
    transport: $("#transport").value,
    description: $("#description").value.trim(),
    published: $("#published").checked,
    featured: $("#featured").checked
  };
}

async function saveProduct(event) {
  event.preventDefault();
  showError($("#form-error"));
  const payload = formPayload();

  try {
    let id = Number($("#product-id").value);
    if (id) {
      await api(`/api/admin/products/${id}`, { method:"PUT", body:JSON.stringify(payload) });
      toast("Producto actualizado");
    } else {
      const result = await api("/api/admin/products", { method:"POST", body:JSON.stringify(payload) });
      id = result.id;
      toast("Producto creado");
    }
    await loadAll();
    const p = products.find(item => item.id === id);
    if (p) {
      dialog.close();
      openEdit(id);
    }
  } catch (e) {
    showError($("#form-error"), e.message);
  }
}

async function uploadImages() {
  const id = Number($("#product-id").value);
  const files = [...$("#image-input").files];
  if (!id) return toast("Guarda primero el producto.");
  if (!files.length) return toast("Selecciona alguna fotografía.");

  const data = new FormData();
  files.forEach(file => data.append("images", file));

  try {
    $("#upload-images").disabled = true;
    $("#upload-images").textContent = "Subiendo…";
    await api(`/api/admin/products/${id}/images`, { method:"POST", body:data });
    $("#image-input").value = "";
    toast("Fotografías subidas");
    await loadAll();
    editingProduct = products.find(p => p.id === id);
    renderImages(editingProduct?.images || []);
  } catch (e) {
    showError($("#form-error"), e.message);
  } finally {
    $("#upload-images").disabled = false;
    $("#upload-images").textContent = "Subir imágenes";
  }
}

async function adjustStock(id, delta) {
  const p = products.find(item => item.id === id);
  if (!p) return;
  const next = Math.max(0, Number(p.storeStock) + delta);
  try {
    await api(`/api/admin/products/${id}/stock`, {
      method:"PATCH",
      body:JSON.stringify({ stock:next })
    });
    await loadAll();
    toast(`Stock actualizado: ${next}`);
  } catch (e) {
    toast(e.message);
  }
}

async function deleteCurrentProduct() {
  const id = Number($("#product-id").value);
  if (!id) return;
  if (!confirm("Esto borrará definitivamente el producto y todas sus imágenes. ¿Continuar?")) return;
  try {
    await api(`/api/admin/products/${id}`, { method:"DELETE" });
    dialog.close();
    await loadAll();
    toast("Producto eliminado");
  } catch (e) {
    showError($("#form-error"), e.message);
  }
}

async function logout() {
  try { await api("/api/admin/logout", { method:"POST", body:"{}" }); } catch {}
  dashboardView.hidden = true;
  loginView.hidden = false;
  $("#login-password").value = "";
}

async function boot() {
  try {
    await api("/api/admin/session");
    loginView.hidden = true;
    dashboardView.hidden = false;
    await loadAll();
  } catch {
    loginView.hidden = false;
    dashboardView.hidden = true;
  }
}

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  showError($("#login-error"));
  try {
    await api("/api/admin/login", {
      method:"POST",
      body:JSON.stringify({
        email:$("#login-email").value.trim(),
        password:$("#login-password").value
      })
    });
    loginView.hidden = true;
    dashboardView.hidden = false;
    await loadAll();
  } catch (e) {
    showError($("#login-error"), e.message);
  }
});

$$(".js-new").forEach(btn => btn.addEventListener("click", () => openNew(btn.dataset.type)));
$$(".admin-tab").forEach(tab => tab.addEventListener("click", () => setType(tab.dataset.tab)));
$("#admin-search").addEventListener("input", renderRows);
$("#admin-category").addEventListener("change", renderRows);
$("#refresh-btn").addEventListener("click", loadAll);
$("#logout-btn").addEventListener("click", logout);
$("#product-form").addEventListener("submit", saveProduct);
$("#product-type").addEventListener("change", syncProductTypeFields);
$("#category").addEventListener("change", () => {
  if ($("#product-type").value === "nuevo" && !editingProduct) {
    $("#lead-days").value = $("#category").value === "electrodomesticos" ? "1" : "7";
  }
});
$("#close-modal").addEventListener("click", () => dialog.close());
$("#cancel-modal").addEventListener("click", () => dialog.close());
$("#upload-images").addEventListener("click", uploadImages);
$("#delete-product").addEventListener("click", deleteCurrentProduct);

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

boot();
