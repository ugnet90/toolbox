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
  }
];
