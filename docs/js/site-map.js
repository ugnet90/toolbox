export const SITE_VERSION = "0.5.6";

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
  },
  fundReturn: {
    label: "Depotrendite & Vergleich",
    href: "fund_return.html",
    parent: "dashboard"
  }
};

export const SITE_NAV = [
  {
    type: "link",
    key: "dashboard",
    label: "Dashboard"
  },
  {
    type: "link",
    key: "about",
    label: "About"
  },
  {
    type: "group",
    label: "Datum & Zeit",
    items: ["dateCalculator"]
  },
  {
    type: "group",
    label: "Finanzen",
    items: ["bundesschatzCompare", "effectiveInterest", "fundReturn"]
  }
];
