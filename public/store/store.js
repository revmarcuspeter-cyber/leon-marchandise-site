const demoProducts = [
  { id: "field-notes", name: "Field Notes", nameFr: "Carnet de terrain", description: "A thoughtfully made notebook for ideas, lists, and plans.", descriptionFr: "Un carnet conçu avec soin pour vos idées, listes et projets.", pricePence: 1800 },
  { id: "everyday-tote", name: "Everyday Tote", nameFr: "Cabas quotidien", description: "A useful everyday carry, designed with simplicity in mind.", descriptionFr: "Un sac pratique pour tous les jours, au design épuré.", pricePence: 2400 },
  { id: "studio-print", name: "Studio Print", nameFr: "Tirage d’atelier", description: "An archival art print from the Leon Marchandise collection.", descriptionFr: "Un tirage d’art de qualité archive issu de la collection Leon Marchandise.", pricePence: 3200 }
];
const copy = {
  en: {
    pageTitle: "Store — Leon Marchandise", metaDescription: "A thoughtfully curated collection from Leon Marchandise.",
    skipLink: "Skip to content", languagePicker: "Choose language", tagline: "A considered collection", bag: "Bag", bagAria: "Open shopping bag", closeBag: "Close bag", eyebrow: "LEON MARCHANDISE", titleFirst: "Thoughtfully", titleSecond: "chosen.", intro: "Explore a small, carefully curated selection. Add a product to your bag to continue to secure checkout.", demoNotice: "Demo catalogue — checkout is not configured yet.", add: "Add to bag", remove: "Remove", cartTitle: "Your bag", emptyBag: "Your bag is empty.", subtotal: "Subtotal", checkoutNotConfigured: "Checkout is not enabled in this preview. No payment will be taken.", checkoutUnavailable: "Checkout unavailable", checkoutReady: "Checkout securely", checkoutLoading: "Preparing secure checkout…", checkoutError: "Checkout could not be started. Please try again.", added: "added to your bag.", demoAdded: "Demo catalogue only; checkout is disabled.", liveAdded: "Checkout is not enabled for this preview.", catalogLoaded: "Product list loaded from the shop catalogue. Checkout remains disabled until payment setup is verified.", catalogEmptyReady: "The shop catalogue is currently empty.", catalogEmptyDisabled: "No products are available in the demo catalogue.", analyticsDemo: "Analytics demo", footerHome: "Leon Marchandise"
  },
  fr: {
    pageTitle: "Boutique — Leon Marchandise", metaDescription: "Une sélection soigneusement choisie par Leon Marchandise.",
    skipLink: "Aller au contenu", languagePicker: "Choisir la langue", tagline: "Une sélection réfléchie", bag: "Panier", bagAria: "Ouvrir le panier", closeBag: "Fermer le panier", eyebrow: "LEON MARCHANDISE", titleFirst: "Choisi avec", titleSecond: "soin.", intro: "Découvrez une petite sélection soigneusement choisie. Ajoutez un article au panier pour poursuivre vers le paiement sécurisé.", demoNotice: "Catalogue de démonstration — le paiement n’est pas configuré.", add: "Ajouter au panier", remove: "Retirer", cartTitle: "Votre panier", emptyBag: "Votre panier est vide.", subtotal: "Sous-total", checkoutNotConfigured: "Le paiement n’est pas activé dans cet aperçu. Aucun paiement ne sera effectué.", checkoutUnavailable: "Paiement indisponible", checkoutReady: "Payer en toute sécurité", checkoutLoading: "Préparation du paiement sécurisé…", checkoutError: "Impossible de démarrer le paiement. Veuillez réessayer.", added: "ajouté à votre panier.", demoAdded: "Catalogue de démonstration uniquement ; le paiement est désactivé.", liveAdded: "Le paiement n’est pas activé dans cet aperçu.", catalogLoaded: "Catalogue chargé. Le paiement reste désactivé tant que sa configuration n’est pas vérifiée.", catalogEmptyReady: "Le catalogue de la boutique est actuellement vide.", catalogEmptyDisabled: "Aucun produit n’est disponible dans le catalogue de démonstration.", analyticsDemo: "Aperçu des statistiques", footerHome: "Leon Marchandise"
  }
};
const cart = new Map();
const grid = document.querySelector("#product-grid");
const dialog = document.querySelector("#cart-dialog");
const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
let language = "en";
let products = demoProducts;
let productsAreLive = false;
let checkoutAvailable = false;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function text(key) { return copy[language][key] || copy.en[key] || key; }
function productName(product) { return language === "fr" ? (product.nameFr || product.name) : (product.name || product.nameFr); }
function productDescription(product) { return language === "fr" ? (product.descriptionFr || product.description || "") : (product.description || product.descriptionFr || ""); }

function applyLanguage(nextLanguage, persist = true) {
  language = nextLanguage === "fr" ? "fr" : "en";
  document.documentElement.lang = language;
  document.title = text("pageTitle");
  document.querySelector('meta[name="description"]')?.setAttribute("content", text("metaDescription"));
  document.querySelectorAll("[data-store-i18n]").forEach((element) => { element.textContent = text(element.dataset.storeI18n); });
  document.querySelectorAll("[data-store-aria]").forEach((element) => { element.setAttribute("aria-label", text(element.dataset.storeAria)); });
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (persist) {
    try { localStorage.setItem("site-language", language); } catch { /* optional preference */ }
  }
  document.querySelector("#store-notice").textContent = productsAreLive ? text("catalogLoaded") : text("demoNotice");
  renderProducts(products);
  renderCart();
  if (productsAreLive) void loadCatalog();
}

function renderProducts(items) {
  const valid = items.filter((product) => typeof product.id === "string" && Number.isInteger(product.pricePence) && product.pricePence > 0);
  grid.innerHTML = valid.map((product, index) => {
    const price = currency.format(product.pricePence / 100);
    const mark = String(index + 1).padStart(2, "0");
    return `<article class="product-card"><div class="product-art" role="img" aria-label="Decorative product artwork"><span aria-hidden="true">${mark}</span></div><div class="product-info"><h2>${escapeHTML(productName(product))}</h2><p>${escapeHTML(productDescription(product))}</p><div class="product-action"><span class="product-price">${price}</span><button class="add-button" type="button" data-add="${escapeHTML(product.id)}">${text("add")}</button></div></div></article>`;
  }).join("");
}

function renderCart() {
  const lines = document.querySelector("#cart-lines");
  const empty = document.querySelector("#cart-empty");
  const count = Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
  const total = Array.from(cart.values()).reduce((sum, item) => sum + item.quantity * item.pricePence, 0);
  document.querySelector("#cart-count").textContent = String(count);
  document.querySelector("#cart-total").textContent = currency.format(total / 100);
  empty.textContent = text("emptyBag");
  empty.hidden = count > 0;
  lines.innerHTML = Array.from(cart.values()).map((item) => {
    const current = products.find((product) => product.id === item.id);
    const name = current ? productName(current) : item.name;
    return `<div class="cart-line"><span class="cart-line-name">${escapeHTML(name)} × ${item.quantity}</span><span class="cart-line-price">${currency.format(item.pricePence * item.quantity / 100)}</span><button class="cart-remove" type="button" data-remove="${escapeHTML(item.id)}">${text("remove")}</button></div>`;
  }).join("");
  const button = document.querySelector("#checkout-button");
  button.textContent = checkoutAvailable ? text("checkoutReady") : text("checkoutUnavailable");
  button.disabled = !checkoutAvailable || count === 0;
}

async function loadCatalog() {
  try {
    const response = await fetch(`/api/catalog?lang=${language}`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      productsAreLive = false;
      checkoutAvailable = false;
      products = demoProducts;
      renderProducts(products);
      renderCart();
      document.querySelector("#store-notice").textContent = text("demoNotice");
      return;
    }
    const data = await response.json();
    if (Array.isArray(data.products)) {
      products = data.products.filter((product) => typeof product.id === "string" && Number.isInteger(product.pricePence));
      productsAreLive = true;
      checkoutAvailable = false;
      renderProducts(products);
      renderCart();
      document.querySelector("#store-notice").textContent = products.length
        ? (checkoutAvailable ? text("catalogLoaded") : text("liveAdded"))
        : (checkoutAvailable ? text("catalogEmptyReady") : text("catalogEmptyDisabled"));
    }
  } catch {
    productsAreLive = false;
    checkoutAvailable = false;
    products = demoProducts;
    renderProducts(products);
    renderCart();
    document.querySelector("#store-notice").textContent = text("demoNotice");
  }
}

async function checkCheckout() {
  try {
    const response = await fetch("/api/checkout", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      checkoutAvailable = false;
      renderCart();
      return;
    }
    const result = await response.json();
    checkoutAvailable = result.available === true && productsAreLive;
    renderCart();
    if (productsAreLive && products.length === 0) document.querySelector("#store-notice").textContent = checkoutAvailable ? text("catalogEmptyReady") : text("catalogEmptyDisabled");
    if (checkoutAvailable) document.querySelector("#store-notice").textContent = text("catalogLoaded");
  } catch {
    // Checkout stays disabled unless the server confirms it is configured.
  }
}

async function initializeStore() {
  await loadCatalog();
  await checkCheckout();
}

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.add);
  if (!product) return;
  const line = cart.get(product.id) || { id: product.id, name: productName(product), pricePence: product.pricePence, quantity: 0 };
  line.name = productName(product);
  line.pricePence = product.pricePence;
  line.quantity += 1;
  cart.set(product.id, line);
  renderCart();
  document.querySelector("#store-notice").textContent = `${productName(product)} ${text("added")} ${productsAreLive ? text("liveAdded") : text("demoAdded")}`;
});

document.querySelector("#cart-lines").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  cart.delete(button.dataset.remove);
  renderCart();
});
document.querySelector("#cart-toggle").addEventListener("click", () => dialog.showModal());
document.querySelector("#cart-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.querySelector("#checkout-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (button.disabled || !checkoutAvailable) return;
  button.disabled = true;
  button.textContent = text("checkoutLoading");
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: Array.from(cart.values(), ({ id, quantity }) => ({ id, quantity })) })
    });
    const result = await response.json();
    if (!response.ok || typeof result.url !== "string") throw new Error("Checkout request failed");
    const destination = new URL(result.url);
    if (destination.protocol !== "https:" || destination.hostname !== "checkout.stripe.com") throw new Error("Invalid payment destination");
    window.location.assign(destination.href);
  } catch {
    document.querySelector("#store-notice").textContent = text("checkoutError");
    renderCart();
  }
});

document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => applyLanguage(button.dataset.language)));
let preferred = "en";
try { preferred = localStorage.getItem("site-language") === "fr" ? "fr" : "en"; } catch { /* default to English */ }
applyLanguage(preferred, false);
renderProducts(products);
renderCart();
void initializeStore();