const translations = {
  en: {
    title: "Leon Marchandise — Coming Soon",
    description: "A new online home for Leon Marchandise is coming soon.",
    ogTitle: "Leon Marchandise — Coming Soon",
    ogDescription: "A new online home for Leon Marchandise is coming soon.",
    skipLink: "Skip to content",
    homeAria: "Leon Marchandise home",
    languagePicker: "Choose language",
    languageEnglish: "English",
    languageFrench: "French",
    storeLink: "Visit the store",
    status: "Website coming soon",
    eyebrow: "A new online home",
    titleFirst: "Good things",
    titleSecond: "are on the way.",
    heroDescription: "We’re preparing a new online home for Leon Marchandise. The full website will be available here soon.",
    updateLink: "A little update",
    artDescription: "Abstract green and amber artwork with the initials LM",
    artCardLabel: "A fresh start",
    artCaption: "IN THE MAKING",
    noteLabel: "THE NEXT CHAPTER",
    noteTitle: "See you here soon.",
    noteText: "This is the first step. More information about Leon Marchandise will follow."
  },
  fr: {
    title: "Leon Marchandise — Bientôt disponible",
    description: "Un nouveau site pour Leon Marchandise sera bientôt disponible.",
    ogTitle: "Leon Marchandise — Bientôt disponible",
    ogDescription: "Un nouveau site pour Leon Marchandise sera bientôt disponible.",
    skipLink: "Aller au contenu",
    homeAria: "Accueil de Leon Marchandise",
    languagePicker: "Choisir la langue",
    languageEnglish: "Anglais",
    languageFrench: "Français",
    storeLink: "Visiter la boutique",
    status: "Site en préparation",
    eyebrow: "Un nouveau site en préparation",
    titleFirst: "De belles choses",
    titleSecond: "arrivent bientôt.",
    heroDescription: "Nous préparons un nouveau site pour Leon Marchandise. Il sera disponible ici bientôt.",
    updateLink: "Quelques nouvelles",
    artDescription: "Composition abstraite verte et ambrée avec les initiales LM",
    artCardLabel: "Un nouveau départ",
    artCaption: "EN PRÉPARATION",
    noteLabel: "LA SUITE",
    noteTitle: "À très bientôt ici.",
    noteText: "Ceci est une première étape. Plus d’informations sur Leon Marchandise suivront."
  }
};

function applyLanguage(language, persist = true) {
  const selected = Object.prototype.hasOwnProperty.call(translations, language) ? language : "en";
  const copy = translations[selected];
  document.documentElement.lang = selected;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = copy[element.dataset.i18n];
    if (typeof value === "string") element.textContent = value;
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    const value = copy[element.dataset.i18nAria];
    if (typeof value === "string") element.setAttribute("aria-label", value);
  });

  document.title = copy.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", copy.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", copy.ogTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", copy.ogDescription);

  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === selected;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (persist) {
    try {
      window.localStorage.setItem("site-language", selected);
    } catch {
      // Keep the language switcher usable when storage is unavailable.
    }
  }
}

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

let preferredLanguage = "en";
try {
  const savedLanguage = window.localStorage.getItem("site-language");
  if (savedLanguage && Object.prototype.hasOwnProperty.call(translations, savedLanguage)) {
    preferredLanguage = savedLanguage;
  }
} catch {
  // Default to English when storage is unavailable.
}
applyLanguage(preferredLanguage, false);
