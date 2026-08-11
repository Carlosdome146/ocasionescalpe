const WHATSAPP_NUMBER = "34609377974";
const products = Array.isArray(window.OC_PRODUCTS) ? window.OC_PRODUCTS : [];
const I18N = window.OC_I18N || {
  getLanguage: () => "es",
  t: value => value,
  m: key => key,
  localizeProduct: product => product
};

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

function localized(product) {
  return I18N.localizeProduct(product);
}

function stockInfo(product) {
  if (product.type !== "nuevo") {
    return {
      className: "availability--used",
      label: I18N.m("usedLabel"),
      detail: I18N.m("usedDetail"),
      detailLong: I18N.m("usedLong")
    };
  }

  const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0;

  if (stock <= 0) {
    return {
      className: "availability--order",
      label: product.replenishment ? I18N.m("orderLabel") : I18N.m("noStockLabel"),
      detail: product.replenishment ? I18N.m("replenishDetail") : I18N.m("checkDetail"),
      detailLong: product.replenishment ? I18N.m("replenishLong") : I18N.m("noStockLong")
    };
  }

  if (stock === 1) {
    return {
      className: "availability--low",
      label: I18N.m("lastUnit"),
      detail: I18N.m("oneAvailable"),
      detailLong: product.replenishment ? I18N.m("oneReplenishLong") : I18N.m("oneLong")
    };
  }

  if (stock === 2) {
    return {
      className: "availability--low",
      label: I18N.m("lastUnits"),
      detail: I18N.m("twoAvailable"),
      detailLong: product.replenishment ? I18N.m("twoReplenishLong") : I18N.m("twoLong")
    };
  }

  return {
    className: "availability--stock",
    label: I18N.m("inStock"),
    detail: I18N.m("unitsAvailable", { count: stock }),
    detailLong: product.replenishment
      ? I18N.m("unitsReplenishLong", { count: stock })
      : I18N.m("unitsLong", { count: stock })
  };
}

function productWhatsappMessage(baseProduct) {
  const product = localized(baseProduct);
  const availability = stockInfo(baseProduct);
  const lines = [
    I18N.m("productWhatsappIntro"),
    "",
    `${I18N.m("productLabel")}: ${product.name}`,
    `${I18N.m("reference")}: ${baseProduct.reference || `OC-${baseProduct.id}`}`,
    `${I18N.m("typeLabel")}: ${product.typeLabel || (baseProduct.type === "nuevo" ? I18N.t("Productos nuevos") : I18N.t("Segunda mano"))}`,
    `${I18N.m("announcedPrice")}: ${product.price}`
  ];

  if (baseProduct.type === "nuevo") {
    lines.push(`${I18N.m("availabilityLabel")}: ${availability.label}${Number(baseProduct.stock) > 0 ? ` (${availability.detail})` : ""}`);
  } else {
    lines.push(`${I18N.m("availabilityLabel")}: ${I18N.m("usedWhatsappAvailability")}`);
  }

  lines.push("", I18N.m("productWhatsappEnd"));
  return lines.join("\n");
}

function productCard(baseProduct) {
  const product = localized(baseProduct);
  const availability = stockInfo(baseProduct);
  const reference = baseProduct.reference || `OC-${baseProduct.id}`;
  return `
    <article class="product-card reveal is-visible">
      <a class="product-card__image" href="producto.html?id=${baseProduct.id}" aria-label="${I18N.m("viewProduct", { name: product.name })}">
        <img src="${baseProduct.image}" alt="${product.name}" loading="lazy" />
        <div class="product-card__badges">
          <span class="product-card__tag">${product.categoryLabel}</span>
          <span class="product-type ${typeClass(baseProduct)}">${product.typeLabel}</span>
        </div>
      </a>
      <div class="product-card__body">
        <div class="product-card__meta"><span>${product.condition}</span><span class="status ${statusClass(baseProduct.mounting)}">${product.mountingLabel}</span></div>
        <h3><a href="producto.html?id=${baseProduct.id}">${product.name}</a></h3>
        <p class="product-card__description">${product.description}</p>
        <div class="product-card__availability ${availability.className}">
          <strong>${availability.label}</strong>
          <span>${availability.detail}</span>
        </div>
        <div class="product-card__footer"><div class="product-card__price"><small>${I18N.m("price")}</small><strong>${product.price}</strong></div><a class="product-card__button" href="producto.html?id=${baseProduct.id}">${I18N.m("viewDetail")}</a></div>
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
    const locale = I18N.getLanguage() === "de" ? "de" : I18N.getLanguage();
    const term = (search?.value || "").trim().toLocaleLowerCase(locale);
    const filtered = products.filter(isVisibleProduct).filter(baseProduct => {
      const product = localized(baseProduct);
      const categoryMatch = activeFilter === "todos" || baseProduct.category === activeFilter;
      const typeMatch = activeType === "todos" || baseProduct.type === activeType;
      const text = `${product.name} ${baseProduct.reference || ""} ${product.categoryLabel} ${product.typeLabel || ""} ${product.description}`.toLocaleLowerCase(locale);
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
  document.addEventListener("oc:languagechange", render);
  render();
}

function setupFeatured() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  const render = () => { grid.innerHTML = products.filter(isVisibleProduct).slice(0, 3).map(productCard).join(""); };
  document.addEventListener("oc:languagechange", render);
  render();
}

function setupProductDetail() {
  const target = document.getElementById("product-detail");
  if (!target) return;

  const id = Number(new URLSearchParams(window.location.search).get("id"));
  const baseProduct = products.find(item => item.id === id && isVisibleProduct(item));
  const relatedGrid = document.getElementById("related-grid");
  const relatedSection = document.getElementById("related-section");

  function render() {
    if (!baseProduct) {
      target.className = "product-not-found i18n-dynamic";
      target.innerHTML = `<h1>${I18N.m("productNotFoundTitle")}</h1><p>${I18N.m("productNotFoundText")}</p><a class="btn btn--primary" href="catalogo.html">${I18N.m("backToCatalog")}</a>`;
      if (relatedSection) relatedSection.hidden = true;
      return;
    }

    const product = localized(baseProduct);
    document.title = `${product.name} | Ocasiones Calpe`;
    const breadcrumb = document.getElementById("breadcrumb-product");
    if (breadcrumb) breadcrumb.textContent = product.name;

    const availability = stockInfo(baseProduct);
    const detailsEntries = Object.entries(product.details || {});
    const details = [
      [I18N.m("reference"), baseProduct.reference || `OC-${baseProduct.id}`],
      ...detailsEntries
    ].map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`).join("");

    const availabilityTitle = baseProduct.type === "nuevo" ? I18N.m("inStoreStock") : I18N.m("availability");
    const availabilityExtra = baseProduct.type === "nuevo"
      ? `<span class="stock-number">${Number(baseProduct.stock) > 0 ? Number(baseProduct.stock) : "0"}</span>`
      : `<span class="stock-unique">1</span>`;

    target.innerHTML = `
      <div class="product-detail__image">
        <img src="${baseProduct.image}" alt="${product.name}" />
        <span class="product-detail__type product-type ${typeClass(baseProduct)}">${product.typeLabel}</span>
      </div>
      <div class="product-detail__content">
        <div class="product-detail__labels"><span class="eyebrow">${product.categoryLabel}</span><span class="product-reference">Ref. ${baseProduct.reference || `OC-${baseProduct.id}`}</span></div>
        <h1>${product.name}</h1>
        <div class="product-detail__meta"><span class="status ${statusClass(baseProduct.mounting)}">${product.mountingLabel}</span><span class="status status--none">${product.condition}</span></div>
        <p>${product.description}</p>
        <div class="product-availability-panel ${availability.className}">
          <div class="product-availability-panel__count">${availabilityExtra}</div>
          <div><small>${availabilityTitle}</small><strong>${availability.label}</strong><span>${availability.detailLong}</span></div>
        </div>
        <div class="product-detail__details">${details}</div>
        <div class="product-detail__price">${product.price}</div>
        <div class="product-detail__notice">${I18N.m("catalogueNotice")}</div>
        <div class="hero__actions"><a class="btn btn--primary" href="${whatsappUrl(productWhatsappMessage(baseProduct))}" target="_blank" rel="noopener noreferrer">${I18N.m("askWhatsapp")}</a><a class="btn btn--ghost" href="catalogo.html?tipo=${baseProduct.type}&categoria=${baseProduct.category}">${I18N.m("viewSimilar")}</a></div>
      </div>`;

    const visible = products.filter(item => item.id !== baseProduct.id && isVisibleProduct(item));
    const related = [
      ...visible.filter(item => item.category === baseProduct.category && item.type === baseProduct.type),
      ...visible.filter(item => item.category === baseProduct.category && item.type !== baseProduct.type),
      ...visible.filter(item => item.category !== baseProduct.category && item.type === baseProduct.type),
      ...visible.filter(item => item.category !== baseProduct.category && item.type !== baseProduct.type)
    ].filter((item, index, array) => array.findIndex(candidate => candidate.id === item.id) === index).slice(0, 3);

    if (relatedGrid) relatedGrid.innerHTML = related.map(productCard).join("");
  }

  document.addEventListener("oc:languagechange", render);
  render();
}

function setupWhatsAppLinks() {
  document.querySelectorAll(".js-whatsapp").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const spanishMessage = link.dataset.message || "Buenas, me gustaría hacer una consulta.";
      const message = I18N.t(spanishMessage) !== spanishMessage ? I18N.t(spanishMessage) : (spanishMessage === "Hola, me gustaría hacer una consulta." ? I18N.m("genericWhatsapp") : spanishMessage);
      window.open(whatsappUrl(message), "_blank", "noopener");
    });
  });
}

function setupContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    const selectedOption = form.querySelector('select[name="interest"] option:checked');
    const interest = selectedOption?.textContent || data.get("interest");
    const message = [
      I18N.m("contactIntro"),
      `${I18N.m("contactName")}: ${data.get("name")}`,
      `${I18N.m("contactPhone")}: ${data.get("phone")}`,
      `${I18N.m("contactInterest")}: ${interest}`,
      `${I18N.m("contactMessage")}: ${data.get("message")}`
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
