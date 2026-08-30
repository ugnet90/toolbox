import { SITE_MAP, SITE_NAV } from "./site-map.js";

function currentPageKey() {
  const fileName = window.location.pathname.split("/").pop() || "index.html";
  const match = Object.entries(SITE_MAP).find(([, page]) => page.href === fileName);
  return match?.[0] ?? "dashboard";
}

function createBreadcrumbTrail(pageKey) {
  const trail = [];
  let key = pageKey;

  while (key && SITE_MAP[key]) {
    trail.unshift({ key, ...SITE_MAP[key] });
    key = SITE_MAP[key].parent;
  }

  return trail;
}

function renderDesktopNavigation(activeKey) {
  return SITE_NAV.flatMap((group) => group.items)
    .map((key) => {
      const page = SITE_MAP[key];
      const activeClass = key === activeKey ? " is-active" : "";
      const ariaCurrent = key === activeKey ? ' aria-current="page"' : "";
      return `<a class="topnav__link${activeClass}" href="${page.href}"${ariaCurrent}>${page.label}</a>`;
    })
    .join("");
}

function renderMobileNavigation(activeKey) {
  return SITE_NAV.map((group) => {
    const items = group.items.map((key) => {
      const page = SITE_MAP[key];
      const activeClass = key === activeKey ? " is-active" : "";
      const ariaCurrent = key === activeKey ? ' aria-current="page"' : "";
      return `<a class="mobile-nav__link${activeClass}" href="${page.href}"${ariaCurrent}>${page.label}</a>`;
    }).join("");

    return `
      <section class="mobile-nav__group">
        <h2 class="mobile-nav__heading">${group.label}</h2>
        ${items}
      </section>
    `;
  }).join("");
}

function renderBreadcrumbs(activeKey) {
  const trail = createBreadcrumbTrail(activeKey);

  return trail.map((page, index) => {
    const isLast = index === trail.length - 1;
    if (isLast) {
      return `<span class="breadcrumbs__current" aria-current="page">${page.label}</span>`;
    }

    return `<a class="breadcrumbs__link" href="${page.href}">${page.label}</a><span class="breadcrumbs__separator" aria-hidden="true">›</span>`;
  }).join("");
}

function setupMenu(button, panel, backdrop) {
  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    backdrop.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  };

  button.addEventListener("click", () => {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  backdrop.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      button.focus();
    }
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setOpen(false);
    }
  });
}

function initNavigation() {
  const activeKey = currentPageKey();
  const headerHost = document.querySelector("[data-site-header]");
  const breadcrumbHost = document.querySelector("[data-breadcrumbs]");

  if (!headerHost) return;

  headerHost.innerHTML = `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="index.html" aria-label="Toolbox Dashboard">
          <img class="site-brand__logo" src="assets/logo/toolbox-dashboard-logo.png" alt="" aria-hidden="true">
        </a>

        <nav class="topnav" aria-label="Hauptnavigation">
          ${renderDesktopNavigation(activeKey)}
        </nav>

        <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobile-navigation" aria-label="Navigation öffnen">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <div class="mobile-nav-backdrop" hidden></div>
    <nav id="mobile-navigation" class="mobile-nav" aria-label="Mobile Navigation" hidden>
      <div class="mobile-nav__top">
        <span class="mobile-nav__title">Navigation</span>
      </div>
      ${renderMobileNavigation(activeKey)}
    </nav>
  `;

  if (breadcrumbHost) {
    breadcrumbHost.innerHTML = renderBreadcrumbs(activeKey);
  }

  const button = headerHost.querySelector(".menu-button");
  const panel = headerHost.querySelector(".mobile-nav");
  const backdrop = headerHost.querySelector(".mobile-nav-backdrop");
  setupMenu(button, panel, backdrop);
}

initNavigation();
