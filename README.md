# Toolbox

**Version:** 0.3.1

`toolbox` ist eine öffentliche, über GitHub Pages erreichbare Sammlung kleiner Rechen- und Alltagstools. Die Oberfläche ist responsiv und für Desktop sowie mobile Geräte ausgelegt.

## Aktueller Funktionsumfang

### Datumsrechner

- Zieldatum aus Ausgangsdatum plus/minus Tage, Wochen oder Monate.
- Zeitspanne zwischen zwei Daten mit Kalenderzeit, Tagen, Stunden, Wochen und vollen Monaten.
- Beide Ausgangsdatumsfelder werden bidirektional synchronisiert.
- Monatsrechnungen erfolgen kalendarisch; nicht vorhandene Zieltage werden auf den letzten Tag des Zielmonats begrenzt.

### Bundesschatz-Vergleich

Der Rechner lädt beim Öffnen die aktuell veröffentlichten Bundesschatz-Produkte über den Cloudflare-Worker:

`https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev/bundesschatz`

Die Laufzeiten sind nicht fest im Quellcode hinterlegt. Alle für den relevanten Valutatag gelieferten unterstützten Produkte werden dynamisch angezeigt. Fallen Laufzeiten weg oder kommen neue hinzu, passt sich die Auswahl automatisch an.

Der Vergleich ermittelt den Bruttozinssatz einer österreichischen Spareinlage, der nach 25 % KESt denselben Netto-Endbetrag wie der Bundesschatz nach 27,5 % KESt erreicht. Für die Spareinlage werden 30/360 und ein Jahresabschluss zum Kalenderjahresende angenommen.

Kann der Live-Abruf nicht durchgeführt werden, erscheint automatisch eine manuelle Eingabemaske für Valuta, Laufzeit, Laufzeiteinheit und Bundesschatz-Zinssatz. Es werden weiterhin keine veralteten Ersatzwerte gespeichert.

### Effektivzins & Vergleich

Eingaben:

- tatsächlich bezahlter Einzahlungsbetrag,
- bereits netto vorliegender Auszahlungsbetrag,
- Laufzeit in Tagen, Monaten oder Jahren,
- KESt-Satz: 0 %, 25 % oder 27,5 %,
- Versicherungssteuer: 0 %, 4 % oder 11 %.

Berechnet werden:

- bei Versicherungssteuer der daraus resultierende netto veranlagte Betrag (`Einzahlung / 1,04` bzw. `/ 1,11`),
- Versicherungssteueranteil im Einzahlungsbetrag,
- Netto-Rendite über die gesamte Laufzeit aus Kundensicht,
- annualisierter Netto-Effektivzins,
- rechnerisch bereits in der Netto-Auszahlung enthaltene KESt,
- Bruttozinssatz einer österreichischen Spareinlage, die nach 25 % KESt bei gleichem tatsächlichem Einzahlungsbetrag denselben Netto-Endbetrag erreicht.

Der Auszahlungsbetrag wird nicht nochmals um KESt vermindert. Bei einer Kombination aus Versicherungssteuer > 0 % und KESt > 0 % zeigt der Rechner einen Plausibilitätshinweis, lässt die Berechnung aber zu. Sobald eine Eingabe geändert wird, wird ein vorhandenes Ergebnis gelöscht und erst nach erneutem Klick auf **Effektivzins berechnen** wieder angezeigt.

## Änderungen in Version 0.3.1

- Versicherungssteuer wird aus dem tatsächlich bezahlten Einzahlungsbetrag herausgerechnet statt aufgeschlagen.
- KESt-Auswahl auf 0 %, 25 % und 27,5 % umgestellt.
- Auszahlungsbetrag wird als bereits netto nach allfälliger KESt behandelt.
- Plausibilitätshinweis für Versicherungssteuer > 0 % zusammen mit KESt > 0 % ergänzt.
- bestehende Berechnung wird bei jeder Eingabeänderung sofort zurückgesetzt.

## Änderungen in Version 0.3.0

- Dashboard-Erklärungen von der Startseite entfernt und auf die neue Seite **Über die Toolbox** verschoben.
- **Über die Toolbox** in Desktop- und Hamburger-Navigation ergänzt.
- Bundesschatz-Vergleich um manuelle Eingabe erweitert, wenn die Live-Daten nicht geladen werden können.
- neuen Rechner **Effektivzins & Vergleich** ergänzt.
- Effektivzins-Rechner berücksichtigt KESt-Freiheit, 0/4/11 % Versicherungssteuer und einen Spareinlagen-Vergleich.
- neue Berechnungslogik durch Node-Tests abgesichert.

## Repository-Struktur

```text
toolbox/
├─ .github/
│  └─ workflows/
│     └─ pages.yml
├─ data/
│  └─ tools.json
├─ docs/
│  ├─ assets/
│  │  ├─ favicon/
│  │  └─ logo/
│  ├─ css/
│  │  ├─ about.css
│  │  ├─ base.css
│  │  ├─ bundesschatz.css
│  │  ├─ calculator.css
│  │  ├─ dashboard.css
│  │  ├─ effective-interest.css
│  │  └─ navigation.css
│  ├─ data/
│  │  └─ tools.json
│  ├─ js/
│  │  ├─ bundesschatz-compare.js
│  │  ├─ bundesschatz-utils.js
│  │  ├─ dashboard.js
│  │  ├─ date-calculator.js
│  │  ├─ date-utils.js
│  │  ├─ effective-interest.js
│  │  ├─ effective-interest-utils.js
│  │  ├─ navigation.js
│  │  └─ site-map.js
│  ├─ about.html
│  ├─ bundesschatz_compare.html
│  ├─ date_calculator.html
│  ├─ effective_interest.html
│  └─ index.html
├─ scripts/
│  ├─ test_bundesschatz_utils.mjs
│  ├─ test_date_utils.mjs
│  └─ test_effective_interest_utils.mjs
├─ tools/
│  ├─ sync_public_data.py
│  └─ validate_project.py
├─ .gitignore
├─ README.md
└─ VERSION
```

## Rollen der Verzeichnisse

- `.github/workflows/`: GitHub-Actions-Workflows.
- `data/`: kanonische strukturierte Projektdaten.
- `docs/`: komplette öffentliche GitHub-Pages-Oberfläche.
- `docs/css/`: gemeinsame und seitenbezogene Stylesheets.
- `docs/js/`: gemeinsame Navigation sowie seitenbezogene JavaScript-Module.
- `scripts/`: technische Tests oder Hilfsskripte, die nicht Teil der Webseite sind.
- `tools/`: Python-Hilfsprogramme für Synchronisierung, Validierung oder spätere Build-Schritte.

Webseiten werden bewusst nicht im Ordner `tools/` abgelegt.

## Navigation

Die Navigation wird zentral über `SITE_MAP` und `SITE_NAV` in `docs/js/site-map.js` gepflegt. Daraus werden Desktop-Navigation, mobiles Hamburger-Menü, Breadcrumbs und die Markierung der aktiven Seite erzeugt.

## Dashboard

Die Startseite `docs/index.html` ist bewusst kompakt und zeigt primär die verfügbaren Tools. Hintergrundinformationen stehen auf `docs/about.html`.

Die Tool-Karten werden aus `data/tools.json` erzeugt. `docs/data/tools.json` ist nur die öffentliche Build-Kopie und wird mit `tools/sync_public_data.py` automatisch aus der kanonischen Datei synchronisiert.

## Datenschutz und externe Daten

Rechner-Eingaben werden lokal im Browser verarbeitet und nicht gespeichert. Der Bundesschatz-Vergleich ruft öffentliche Konditionsdaten über den Cloudflare-Worker ab; eingegebene persönliche Rechenwerte werden dabei nicht übertragen.

## GitHub Pages

Der Workflow `.github/workflows/pages.yml` synchronisiert die öffentlichen Daten, validiert die Projektstruktur, führt die Rechentests aus und veröffentlicht anschließend `docs/` über GitHub Pages.

## Erweiterung um ein neues Tool

1. HTML-Seite unter `docs/` anlegen.
2. eigenes JavaScript-Modul unter `docs/js/` anlegen.
3. bei Bedarf eigenes Stylesheet unter `docs/css/` anlegen.
4. Seite in `SITE_MAP` und `SITE_NAV` ergänzen.
5. Tool in `data/tools.json` ergänzen.
6. Tests ergänzen.
7. `tools/sync_public_data.py` beim Build ausführen lassen.

## Versionierung

Die Projektversion steht in `VERSION` und zusätzlich in den Seiten-Footern.

Aktuelle Version: **0.3.1**
