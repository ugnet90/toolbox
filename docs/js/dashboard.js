async function loadToolRegistry() {
  const response = await fetch("data/tools.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Tool-Registry konnte nicht geladen werden (${response.status}).`);
  }
  return response.json();
}

function renderToolCard(tool) {
  return `
    <a class="tool-card" href="${tool.href}">
      <span class="tool-card__icon" aria-hidden="true">${tool.icon || "🧰"}</span>
      <span class="tool-card__content">
        <span class="tool-card__title">${tool.title}</span>
        <span class="tool-card__description">${tool.description}</span>
      </span>
      <span class="tool-card__arrow" aria-hidden="true">→</span>
    </a>
  `;
}

function renderDashboard(registry) {
  const host = document.querySelector("[data-tool-dashboard]");
  if (!host) return;

  const activeTools = (registry.tools || []).filter((tool) => tool.status === "active");
  const categories = [...new Set(activeTools.map((tool) => tool.category))];

  if (!activeTools.length) {
    host.innerHTML = '<p class="empty-state">Noch keine Tools vorhanden.</p>';
    return;
  }

  host.innerHTML = categories.map((category) => {
    const cards = activeTools
      .filter((tool) => tool.category === category)
      .map(renderToolCard)
      .join("");

    return `
      <section class="dashboard-section">
        <div class="dashboard-section__header">
          <h2>${category}</h2>
        </div>
        <div class="tool-grid">${cards}</div>
      </section>
    `;
  }).join("");
}

async function initDashboard() {
  const host = document.querySelector("[data-tool-dashboard]");
  if (!host) return;

  try {
    const registry = await loadToolRegistry();
    renderDashboard(registry);
  } catch (error) {
    console.error(error);
    host.innerHTML = `
      <div class="error-box" role="alert">
        <strong>Dashboard konnte nicht geladen werden.</strong>
        <span>${error.message}</span>
      </div>
    `;
  }
}

initDashboard();
