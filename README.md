# Toolbox

**Version:** 0.4.1

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
- Auszahlungsbetrag,
- Auswahl, ob der Auszahlungsbetrag netto oder brutto vor KESt vorliegt,
- Laufzeit in Tagen, Monaten oder Jahren.

Bei **Netto-Auszahlung** werden keine Steuerangaben benötigt. Die Rendite wird ausschließlich aus dem tatsächlichen Einzahlungsbetrag und der bereits netto vorliegenden Auszahlung ermittelt.

Bei **Brutto-Auszahlung** werden zusätzlich eingeblendet:

- KESt-Satz: 0 %, 25 % oder 27,5 %,
- Versicherungssteuer: 0 %, 4 % oder 11 %.

Eine Versicherungssteuer ist im Einzahlungsbetrag enthalten und wird bei Brutto-Berechnung durch Division durch 1,04 bzw. 1,11 herausgerechnet. KESt wird auf einen positiven Ertrag gegenüber dem netto veranlagten Betrag gerechnet. Bei Versicherungssteuer > 0 % zusammen mit KESt > 0 % erscheint ein Plausibilitätshinweis.

Ausgegeben werden Netto-Gesamtrendite, annualisierter Netto-Effektivzins und der Bruttozinssatz einer österreichischen Spareinlage, die nach 25 % KESt bei gleichem tatsächlichem Einzahlungsbetrag denselben Netto-Endbetrag erreicht. Der angezeigte Vergleichszinssatz wird kaufmännisch auf zwei Nachkommastellen gerundet; der exakte Rechenwert bleibt in den Berechnungsdetails sichtbar. Betragsfelder werden beim Verlassen im österreichischen Zahlenformat formatiert.


### Fondsrendite & Vergleich

Der Rechner bildet Fondsveranlagungen als datierte Zahlungsströme aus Sicht des Anlegers ab. Unterstützt werden insbesondere:

- Startinvestition mit Brutto-/Netto-Auswahl und Kaufspesen/Ausgabeaufschlag,
- unregelmäßige Zuzahlungen und Sparraten,
- automatisch erzeugte regelmäßige Zahlungen (monatlich, vierteljährlich, halbjährlich oder jährlich),
- Ausschüttungen – auch negative Beträge,
- Steuerbelastungen, z. B. für ausschüttungsgleiche Erträge,
- Depot-/sonstige Gebühren,
- Entnahmen und sonstige Cashflows,
- End-/Verkaufswert zum Bewertungsdatum.

Die effektive Nettorendite wird als datumsgenaue XIRR aus allen Anleger-Cashflows berechnet. Eine österreichische Fondsbesteuerung wird bewusst nicht pauschal nachgebildet; steuerliche Belastungen werden über die tatsächlich angefallenen Netto-Cashflows erfasst.

Optional wird derselbe historische Zahlungsstrom mit einem fiktiven österreichischen Sparkonto verglichen. Grundlage ist die monatliche ECB-MIR-Serie `MIR.M.AT.B.L21.A.R.A.2250.EUR.N` (österreichische täglich fällige Haushaltseinlagen, durchschnittlicher Jahreszinssatz). Die historischen Zinsen werden über den bestehenden Cloudflare-Worker geladen. Der Benchmark ist ein statistischer Durchschnitt und kein Bestzins einzelner Banken. Für positive Sparzinsen werden 25 % KESt angenommen.

## Änderungen in Version 0.4.1

- historischer Sparvergleich: fehlen nur Monate nach dem letzten verfügbaren ECB-Datenpunkt, wird der zuletzt verfügbare Zinssatz bis zum Vergleichsende unverändert fortgeschrieben.
- die Oberfläche weist in diesem Fall ausdrücklich auf den verwendeten letzten offiziellen Monat, den fortgeschriebenen Zinssatz und den Fortführungszeitraum hin.
- echte Lücken innerhalb der historischen ECB-Datenreihe bleiben ein Fehler und werden nicht stillschweigend aufgefüllt.

## Änderungen in Version 0.4.0

- neuen Rechner **Fondsrendite & Vergleich** ergänzt.
- beliebig viele datierte, editierbare Zahlungsströme sowie Generator für regelmäßige Zahlungen ergänzt.
- datumsgenaue XIRR-Berechnung mit Testabdeckung ergänzt.
- historischen Vergleich mit österreichischen täglich fälligen Haushaltseinlagen über ECB/OeNB-Daten ergänzt.
- Cloudflare-Worker um einen normalisierten `/savings-rates`-Endpunkt erweitert.
- sichtbare Versionsnummer wird nun zentral über `SITE_VERSION` in `docs/js/site-map.js` gesetzt; künftige Versionssprünge ändern daher nicht mehr alle HTML-Seiten nur wegen des Footers.

## Änderungen in Version 0.3.3

- Betragsfelder verwenden nun unabhängig vom Browser das Format `110.000,00`.
- Laufzeit-Eingabe und Einheit-Dropdown sind mobil gleich hoch.
- Steuerfelder sind bei Netto-Auszahlung vollständig unsichtbar.
- Bei Brutto-Auszahlung stehen KESt und Versicherungssteuer am Desktop rechts neben dem Auszahlungsmodus; mobil bleiben beide Steuersätze nebeneinander.
- Allgemeiner Hinweis auf mögliche Abweichungen durch Gebühren, Steuerregeln, Rundungen und Produktbesonderheiten ergänzt.

## Änderungen in Version 0.3.2

- Netto-/Brutto-Auswahl für den Auszahlungsbetrag ergänzt.
- Steuerfelder bei Netto-Auszahlung vollständig ausgeblendet und rechnerisch ignoriert.
- KESt und Versicherungssteuer werden nur bei Brutto-Auszahlung berücksichtigt.
- Vergleichszinssatz wird kaufmännisch auf zwei Nachkommastellen gerundet.
- Betragsfelder werden beim Verlassen als österreichische Beträge formatiert.
- Eingabe- und Auswahlfelder am Desktop kompakter gestaltet.
- KESt- und Versicherungssteuer-Dropdowns bleiben mobil nebeneinander.
- bestehende Ergebnisse werden weiterhin bei jeder Eingabeänderung gelöscht.

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
│  │  ├─ fund-return.css
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
│  │  ├─ fund-return.js
│  │  ├─ fund-return-utils.js
│  │  ├─ navigation.js
│  │  └─ site-map.js
│  ├─ about.html
│  ├─ bundesschatz_compare.html
│  ├─ date_calculator.html
│  ├─ effective_interest.html
│  ├─ fund_return.html
│  └─ index.html
├─ scripts/
│  ├─ test_bundesschatz_utils.mjs
│  ├─ test_date_utils.mjs
│  ├─ test_effective_interest_utils.mjs
│  └─ test_fund_return_utils.mjs
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

Rechner-Eingaben werden lokal im Browser verarbeitet und nicht gespeichert. Der Bundesschatz-Vergleich ruft öffentliche Konditionsdaten über den Cloudflare-Worker ab. Der Fondsrechner lädt bei aktiviertem historischem Vergleich ausschließlich den benötigten Monatsbereich der öffentlichen ECB-Zinsserie; die eingegebenen Fonds-Cashflows werden nicht an den Worker übertragen.

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

Die Projektversion steht in `VERSION`. Für die sichtbaren Seiten-Footer wird sie zentral als `SITE_VERSION` in `docs/js/site-map.js` gesetzt und von `docs/js/navigation.js` ausgegeben.

Aktuelle Version: **0.4.1**
