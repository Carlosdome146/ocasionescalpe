const WHATSAPP_NUMBER = "34609377974";
const products = Array.isArray(window.OC_PRODUCTS) ? window.OC_PRODUCTS : [];

function statusClass(mounting) {
  return mounting === "included" ? "status--included" : mounting === "optional" ? "status--optional" : "status--none";
}

function whatsappUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function isVisibleProduct(product) {
  return product.status !== "sold" && product.status !== "hidden";
}

function typeClass(product) {
  return product.type === "nuevo" ? "product-type--new" : "product-type--used";
}

function stockInfo(product) {
  if (product.type !== "nuevo") {
    return {
      className: "availability--used",
      label: "Disponible",
      detail: "Pieza única · sin reposición",
      detailLong: "Esta unidad es de segunda mano y no tiene reposición. Consulta disponibilidad antes de desplazarte."
    };
  }

  const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0;

  if (stock <= 0) {
    return {
      className: "availability--order",
      label: product.replenishment ? "Disponible bajo pedido" : "Sin stock",
      detail: product.replenishment ? "Reposición disponible" : "Consultar disponibilidad",
      detailLong: product.replenishment
        ? "Actualmente no hay unidades en tienda, pero este producto se puede volver a pedir. Consulta el plazo de reposición."
        : "Actualmente no hay unidades disponibles. Consulta con la tienda para más información."
    };
  }

  if (stock === 1) {
    return {
      className: "availability--low",
      label: "Última unidad en tienda",
      detail: "1 unidad disponible",
      detailLong: product.replenishment
        ? "Queda 1 unidad en tienda. Si se agota, podemos consultar su reposición."
        : "Queda 1 unidad disponible en tienda."
    };
  }

  if (stock === 2) {
    return {
      className: "availability--low",
      label: "Últimas unidades",
      detail: "2 unidades disponibles",
      detailLong: product.replenishment
        ? "Quedan 2 unidades en tienda. Si se agotan, podemos consultar su reposición."
        : "Quedan 2 unidades disponibles en tienda."
    };
  }

  return {
    className: "availability--stock",
    label: "En stock",
    detail: `${stock} unidades disponibles`,
    detailLong: product.replenishment
      ? `${stock} unidades disponibles actualmente en tienda. Este producto admite reposición.`
      : `${stock} unidades disponibles actualmente en tienda.`
  };
}

function productWhatsappMessage(product) {
  const availability = stockInfo(product);
  const lines = [
    "Hola, estoy interesado/a en un producto de Ocasiones Calpe:",
    "",
    `Producto: ${product.name}`,
    `Referencia: ${product.reference || `OC-${product.id}`}`,
    `Tipo: ${product.typeLabel || (product.type === "nuevo" ? "Producto nuevo" : "Segunda mano")}`,
    `Precio anunciado: ${product.price}`
  ];

  if (product.type === "nuevo") {
    lines.push(`Disponibilidad: ${availability.label}${Number(product.stock) > 0 ? ` (${availability.detail})` : ""}`);
  } else {
    lines.push("Disponibilidad: pieza única de segunda mano");
  }

  lines.push("", "¿Podéis darme más información y confirmarme la disponibilidad?");
  return lines.join("\n");
}

function productCard(product) {
  const availability = stockInfo(product);
  return `
    <article class="product-card reveal is-visible">
      <a class="product-card__image" href="producto.html?id=${product.id}" aria-label="Ver ficha de ${product.name}">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <div class="product-card__badges">
          <span class="product-card__tag">${product.categoryLabel}</span>
          <span class="product-type ${typeClass(product)}">${product.typeLabel}</span>
        </div>
      </a>
      <div class="product-card__body">
        <div class="product-card__meta"><span>${product.condition}</span><span class="status ${statusClass(product.mounting)}">${product.mountingLabel}</span></div>
        <h3><a href="producto.html?id=${product.id}">${product.name}</a></h3>
        <p class="product-card__description">${product.description}</p>
        <div class="product-card__availability ${availability.className}">
          <strong>${availability.label}</strong>
          <span>${availability.detail}</span>
        </div>
        <div class="product-card__footer"><div class="product-card__price"><small>Precio</small><strong>${product.price}</strong></div><a class="product-card__button" href="producto.html?id=${product.id}">Ver ficha</a></div>
      </div>
    </article>`;
}

function setupCatalog() {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;

  const empty = document.getElementById("catalog-empty");
  const search = document.getElementById("catalog-search");
  const categoryButtons = [...document.querySelectorAll(".filter-btn")];
  const typeButtons = [...document.querySelectorAll(".type-filter-btn")];
  const validCategories = new Set(["muebles", "electrodomesticos", "descanso", "jardin"]);
  const validTypes = new Set(["nuevo", "segunda-mano"]);
  const params = new URLSearchParams(window.location.search);
  const requestedCategory = params.get("categoria");
  const requestedType = params.get("tipo");
  let activeFilter = validCategories.has(requestedCategory) ? requestedCategory : "todos";
  let activeType = validTypes.has(requestedType) ? requestedType : "todos";

  function updateUrl() {
    const url = new URL(window.location.href);
    if (activeFilter === "todos") url.searchParams.delete("categoria"); else url.searchParams.set("categoria", activeFilter);
    if (activeType === "todos") url.searchParams.delete("tipo"); else url.searchParams.set("tipo", activeType);
    history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function render() {
    const term = (search?.value || "").trim().toLocaleLowerCase("es");
    const filtered = products.filter(isVisibleProduct).filter(product => {
      const categoryMatch = activeFilter === "todos" || product.category === activeFilter;
      const typeMatch = activeType === "todos" || product.type === activeType;
      const text = `${product.name} ${product.reference || ""} ${product.categoryLabel} ${product.typeLabel || ""} ${product.description}`.toLocaleLowerCase("es");
      return categoryMatch && typeMatch && text.includes(term);
    });

    grid.innerHTML = filtered.map(productCard).join("");
    if (empty) empty.hidden = filtered.length > 0;
    categoryButtons.forEach(button => button.classList.toggle("active", button.dataset.filter === activeFilter));
    typeButtons.forEach(button => button.classList.toggle("active", button.dataset.type === activeType));
  }

  categoryButtons.forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    updateUrl();
    render();
  }));

  typeButtons.forEach(button => button.addEventListener("click", () => {
    activeType = button.dataset.type;
    updateUrl();
    render();
  }));

  search?.addEventListener("input", render);
  render();
}

function setupFeatured() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  grid.innerHTML = products.filter(isVisibleProduct).slice(0, 3).map(productCard).join("");
}

function setupProductDetail() {
  const target = document.getElementById("product-detail");
  if (!target) return;

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  const product = products.find(item => item.id === id && isVisibleProduct(item));
  const relatedGrid = document.getElementById("related-grid");
  const relatedSection = document.getElementById("related-section");

  if (!product) {
    target.className = "product-not-found";
    target.innerHTML = `<h1>Producto no encontrado</h1><p>La ficha solicitada no existe o ya no está disponible.</p><a class="btn btn--primary" href="catalogo.html">Volver al catálogo</a>`;
    if (relatedSection) relatedSection.hidden = true;
    return;
  }

  document.title = `${product.name} | Ocasiones Calpe`;
  const breadcrumb = document.getElementById("breadcrumb-product");
  if (breadcrumb) breadcrumb.textContent = product.name;

  const availability = stockInfo(product);
  const details = [
    ["Referencia", product.reference || `OC-${product.id}`],
    ...Object.entries(product.details || {})
  ].map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`).join("");

  const availabilityTitle = product.type === "nuevo" ? "Stock en tienda" : "Disponibilidad";
  const availabilityExtra = product.type === "nuevo"
    ? `<span class="stock-number">${Number(product.stock) > 0 ? Number(product.stock) : "0"}</span>`
    : `<span class="stock-unique">1</span>`;

  target.innerHTML = `
    <div class="product-detail__image">
      <img src="${product.image}" alt="${product.name}" />
      <span class="product-detail__type product-type ${typeClass(product)}">${product.typeLabel}</span>
    </div>
    <div class="product-detail__content">
      <div class="product-detail__labels"><span class="eyebrow">${product.categoryLabel}</span><span class="product-reference">Ref. ${product.reference || `OC-${product.id}`}</span></div>
      <h1>${product.name}</h1>
      <div class="product-detail__meta"><span class="status ${statusClass(product.mounting)}">${product.mountingLabel}</span><span class="status status--none">${product.condition}</span></div>
      <p>${product.description}</p>
      <div class="product-availability-panel ${availability.className}">
        <div class="product-availability-panel__count">${availabilityExtra}</div>
        <div><small>${availabilityTitle}</small><strong>${availability.label}</strong><span>${availability.detailLong}</span></div>
      </div>
      <div class="product-detail__details">${details}</div>
      <div class="product-detail__price">${product.price}</div>
      <div class="product-detail__notice">La web funciona como catálogo. La compra, reserva, transporte y montaje se confirman directamente con la tienda.</div>
      <div class="hero__actions"><a class="btn btn--primary" href="${whatsappUrl(productWhatsappMessage(product))}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a><a class="btn btn--ghost" href="catalogo.html?tipo=${product.type}&categoria=${product.category}">Ver similares</a></div>
    </div>`;

  const visible = products.filter(item => item.id !== product.id && isVisibleProduct(item));
  const related = [
    ...visible.filter(item => item.category === product.category && item.type === product.type),
    ...visible.filter(item => item.category === product.category && item.type !== product.type),
    ...visible.filter(item => item.category !== product.category && item.type === product.type),
    ...visible.filter(item => item.category !== product.category && item.type !== product.type)
  ].filter((item, index, array) => array.findIndex(candidate => candidate.id === item.id) === index).slice(0, 3);

  if (relatedGrid) relatedGrid.innerHTML = related.map(productCard).join("");
}

function setupWhatsAppLinks() {
  document.querySelectorAll(".js-whatsapp").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      window.open(whatsappUrl(link.dataset.message || "Hola, me gustaría hacer una consulta."), "_blank", "noopener");
    });
  });
}

function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    const message = [
      "Hola, contacto desde la web de Ocasiones Calpe.",
      `Nombre: ${data.get("name")}`,
      `Teléfono: ${data.get("phone")}`,
      `Interés: ${data.get("interest")}`,
      `Mensaje: ${data.get("message")}`
    ].join("\n");
    window.open(whatsappUrl(message), "_blank", "noopener");
  });
}

function setupNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  }));
}

function setupReveal() {
  const elements = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    elements.forEach(element => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .12 });
  elements.forEach(element => observer.observe(element));
}

setupNavigation();
setupWhatsAppLinks();
setupContactForm();
setupCatalog();
setupFeatured();
setupProductDetail();
setupReveal();
document.querySelectorAll("#year").forEach(year => { year.textContent = new Date().getFullYear(); });
