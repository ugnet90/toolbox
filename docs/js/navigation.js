import { SITE_MAP, SITE_NAV, SITE_VERSION } from "./site-map.js";

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
  return SITE_NAV.map((entry) => {
    if (entry.type === "link") {
      const page = SITE_MAP[entry.key];
      const activeClass = entry.key === activeKey ? " is-active" : "";
      const ariaCurrent = entry.key === activeKey ? ' aria-current="page"' : "";
      return `<a class="topnav__link${activeClass}" href="${page.href}"${ariaCurrent}>${entry.label ?? page.label}</a>`;
    }

    const groupActive = entry.items.includes(activeKey);
    const items = entry.items.map((key) => {
      const page = SITE_MAP[key];
      const activeClass = key === activeKey ? " is-active" : "";
      const ariaCurrent = key === activeKey ? ' aria-current="page"' : "";
      return `<a class="topnav-dropdown__link${activeClass}" href="${page.href}"${ariaCurrent}>${page.label}</a>`;
    }).join("");

    return `
      <details class="topnav-dropdown${groupActive ? " is-active" : ""}">
        <summary class="topnav-dropdown__summary">
          <span>${entry.label}</span>
          <span class="topnav-dropdown__chevron" aria-hidden="true"></span>
        </summary>
        <div class="topnav-dropdown__panel">
          ${items}
        </div>
      </details>
    `;
  }).join("");
}

function renderMobileNavigation(activeKey) {
  return SITE_NAV.map((entry) => {
    if (entry.type === "link") {
      const page = SITE_MAP[entry.key];
      const activeClass = entry.key === activeKey ? " is-active" : "";
      const ariaCurrent = entry.key === activeKey ? ' aria-current="page"' : "";
      return `<a class="mobile-nav__link mobile-nav__link--top${activeClass}" href="${page.href}"${ariaCurrent}>${entry.label ?? page.label}</a>`;
    }

    const items = entry.items.map((key) => {
      const page = SITE_MAP[key];
      const activeClass = key === activeKey ? " is-active" : "";
      const ariaCurrent = key === activeKey ? ' aria-current="page"' : "";
      return `<a class="mobile-nav__link${activeClass}" href="${page.href}"${ariaCurrent}>${page.label}</a>`;
    }).join("");

    return `
      <section class="mobile-nav__group">
        <h2 class="mobile-nav__heading">${entry.label}</h2>
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

function closeDesktopDropdowns(except = null) {
  document.querySelectorAll(".topnav-dropdown[open]").forEach((details) => {
    if (details !== except) {
      details.removeAttribute("open");
    }
  });
}

function setupDesktopDropdowns(headerHost) {
  const dropdowns = headerHost.querySelectorAll(".topnav-dropdown");

  dropdowns.forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open) {
        closeDesktopDropdowns(details);
      }
    });

    details.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        details.removeAttribute("open");
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".topnav-dropdown")) {
      closeDesktopDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDesktopDropdowns();
    }
  });
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

function setupDateInputTabNavigation() {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const visibleTabStops = () => [...document.querySelectorAll(selector)].filter((element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('[hidden]')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'date') return;

    const stops = visibleTabStops();
    const index = stops.indexOf(target);
    if (index < 0) return;
    const nextIndex = index + (event.shiftKey ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= stops.length) return;

    event.preventDefault();
    stops[nextIndex].focus();
  }, true);
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

  document.querySelectorAll(".site-footer").forEach((footer) => {
    footer.textContent = `Toolbox · v${SITE_VERSION}`;
  });

  setupDesktopDropdowns(headerHost);

  const button = headerHost.querySelector(".menu-button");
  const panel = headerHost.querySelector(".mobile-nav");
  const backdrop = headerHost.querySelector(".mobile-nav-backdrop");
  setupMenu(button, panel, backdrop);
  setupDateInputTabNavigation();
}

initNavigation();
