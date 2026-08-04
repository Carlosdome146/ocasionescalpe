const WHATSAPP_NUMBER = "34607226579";
const products = Array.isArray(window.OC_PRODUCTS) ? window.OC_PRODUCTS : [];

function statusClass(mounting) {
  return mounting === "included" ? "status--included" : mounting === "optional" ? "status--optional" : "status--none";
}

function whatsappUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function productCard(product) {
  return `
    <article class="product-card reveal is-visible">
      <a class="product-card__image" href="producto.html?id=${product.id}" aria-label="Ver ficha de ${product.name}">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <span class="product-card__tag">${product.categoryLabel}</span>
      </a>
      <div class="product-card__body">
        <div class="product-card__meta"><span>${product.condition}</span><span class="status ${statusClass(product.mounting)}">${product.mountingLabel}</span></div>
        <h3><a href="producto.html?id=${product.id}">${product.name}</a></h3>
        <p class="product-card__description">${product.description}</p>
        <div class="product-card__footer"><div class="product-card__price"><small>Precio</small><strong>${product.price}</strong></div><a class="product-card__button" href="producto.html?id=${product.id}">Ver ficha</a></div>
      </div>
    </article>`;
}

function setupCatalog() {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;
  const empty = document.getElementById("catalog-empty");
  const search = document.getElementById("catalog-search");
  const buttons = [...document.querySelectorAll(".filter-btn")];
  const validCategories = new Set(["muebles", "electrodomesticos", "descanso", "jardin"]);
  const requested = new URLSearchParams(window.location.search).get("categoria");
  let activeFilter = validCategories.has(requested) ? requested : "todos";

  function render() {
    const term = (search?.value || "").trim().toLocaleLowerCase("es");
    const filtered = products.filter(product => {
      const categoryMatch = activeFilter === "todos" || product.category === activeFilter;
      const text = `${product.name} ${product.categoryLabel} ${product.description}`.toLocaleLowerCase("es");
      return categoryMatch && text.includes(term);
    });
    grid.innerHTML = filtered.map(productCard).join("");
    if (empty) empty.hidden = filtered.length > 0;
    buttons.forEach(button => button.classList.toggle("active", button.dataset.filter === activeFilter));
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    const url = new URL(window.location.href);
    if (activeFilter === "todos") url.searchParams.delete("categoria"); else url.searchParams.set("categoria", activeFilter);
    history.replaceState({}, "", `${url.pathname}${url.search}`);
    render();
  }));
  search?.addEventListener("input", render);
  render();
}

function setupFeatured() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  grid.innerHTML = products.slice(0, 3).map(productCard).join("");
}

function setupProductDetail() {
  const target = document.getElementById("product-detail");
  if (!target) return;
  const id = Number(new URLSearchParams(window.location.search).get("id"));
  const product = products.find(item => item.id === id);
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
  const details = Object.entries(product.details).map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`).join("");
  target.innerHTML = `
    <div class="product-detail__image"><img src="${product.image}" alt="${product.name}" /></div>
    <div class="product-detail__content">
      <span class="eyebrow">${product.categoryLabel}</span>
      <h1>${product.name}</h1>
      <div class="product-detail__meta"><span class="status ${statusClass(product.mounting)}">${product.mountingLabel}</span><span class="status status--none">${product.condition}</span></div>
      <p>${product.description}</p>
      <div class="product-detail__details">${details}</div>
      <div class="product-detail__price">${product.price}</div>
      <div class="hero__actions"><a class="btn btn--primary" href="${whatsappUrl(`Hola, me interesa el producto: ${product.name}. ¿Podéis confirmarme precio, estado y disponibilidad?`)}" target="_blank" rel="noopener noreferrer">Consultar este producto</a><a class="btn btn--ghost" href="catalogo.html?categoria=${product.category}">Ver categoría</a></div>
    </div>`;

  const related = products.filter(item => item.id !== product.id && item.category === product.category).concat(products.filter(item => item.id !== product.id && item.category !== product.category)).slice(0, 3);
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
