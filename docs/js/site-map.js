export const SITE_MAP = {
  dashboard: {
    label: "Dashboard",
    href: "index.html",
    parent: null
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
  }
};

export const SITE_NAV = [
  {
    label: "Übersicht",
    items: ["dashboard"]
  },
  {
    label: "Datum & Zeit",
    items: ["dateCalculator"]
  },
  {
    label: "Finanzen",
    items: ["bundesschatzCompare"]
  }
];
