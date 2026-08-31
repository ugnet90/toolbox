export const SITE_MAP = {
  dashboard: {
    label: "Dashboard",
    href: "index.html",
    parent: null
  },
  about: {
    label: "Über die Toolbox",
    href: "about.html",
    parent: "dashboard"
  },
  dateCalculator: {
    label: "Datumsrechner",
    href: "date_calculator.html",
    parent: "dashboard"
  },
  bundesschatzCompare: {
    label: "Bundesschatz-Vergleich",
    href: "bundesschatz_compare.html",
    parent: "dashboard"
  },
  effectiveInterest: {
    label: "Effektivzins & Vergleich",
    href: "effective_interest.html",
    parent: "dashboard"
  }
};

export const SITE_NAV = [
  {
    label: "Übersicht",
    items: ["dashboard", "about"]
  },
  {
    label: "Datum & Zeit",
    items: ["dateCalculator"]
  },
  {
    label: "Finanzen",
    items: ["bundesschatzCompare", "effectiveInterest"]
  }
];
