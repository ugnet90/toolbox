# Toolbox

**Aktuell: v0.4.9** – CSV-Buchungsimport, automatischer Ergebnis-Sprung und druckfeste Vergleichsbalken.

**Version:** 0.4.9

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

Optional kann derselbe historische Zahlungsstrom mit zwei Benchmarks verglichen werden; standardmäßig werden beide gleichzeitig berechnet:

- **Ø täglich fällige Einlagen Österreich**: monatliche ECB-MIR-Serie `MIR.M.AT.B.L21.A.R.A.2250.EUR.N`; statistischer Durchschnitt österreichischer Haushaltseinlagen, positive Zinsen mit 25 % KESt.
- **3-Monats-Euribor**: monatliche Durchschnittsreihe `FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA`; für den Vergleich wie ein fiktives Sparprodukt behandelt, daher grundsätzlich 25 % KESt auf positive Zinsen.

Für beide Benchmarks werden neben dem historischen Endwert auch die **datumsgenaue effektive Rendite (XIRR) p.a.** ausgewiesen. Eine grafische Vergleichsdarstellung stellt Fonds, Spareinlage und 3-Monats-Euribor sowohl nach Endwert als auch nach Effektivrendite gegenüber. Ein Reset-Button leert Eingaben, Zahlungsströme und Ergebnisse für eine neue Berechnung.

Die historischen Zinsen werden über den bestehenden Cloudflare-Worker geladen. Bei beiden Benchmarks wird nach dem letzten verfügbaren offiziellen ECB-Monat der letzte Wert bis zum Vergleichsende unverändert fortgeführt und in der Oberfläche entsprechend gekennzeichnet.

Zusätzlich kann angegeben werden, ob eine **wirksame KESt-Befreiungserklärung** vorliegt. Bei aktivierter Befreiung werden die beiden historischen Zinsbenchmarks mit 0 % KESt gerechnet. Auf Fondsebene werden Cashflows der Kategorie „KESt / Steuer auf ausschüttungsgleichen Ertrag“ aus der XIRR-Berechnung entfernt. Bereits netto zusammengefasste Ausschüttungen können nicht automatisch in Ausschüttung und KESt zerlegt werden. Die Option bildet ausschließlich den KESt-Abzug ab und nicht eine allfällige Körperschaftsteuer oder sonstige Steuerfolgen.



## Änderungen in Version 0.4.9

- Nach „Fondsrendite berechnen“ wird automatisch zum Ergebnisbereich gescrollt.
- Vergleichsbalken werden im A4-/PDF-Druck auch ohne aktivierte Hintergrundgrafiken sichtbar gezeichnet.
- CSV-Import für Buchungsexporte mit `Abrechnungsbetrag`, `Geschäftsart` und `Abrechnungsdatum` ergänzt; Windows-1252 und UTF-8 werden unterstützt.
- `Kauf` wird als Zuzahlung/Sparrate erkannt; weitere bekannte Geschäftsarten werden kategorisiert, unbekannte als sonstiger Cashflow mit Originaltext in der Notiz übernommen.

## Änderungen in Version 0.4.8

- Fonds-Ergebnisse und Benchmark-Ergebnisse farblich deutlich getrennt; dieselbe Zuordnung gilt für Kennzahlen, Berechnungsdetails und Vergleichsgrafiken.
- dauerhaft sichtbare Aktionsleiste mit „Fondsrendite berechnen“, Datenimport, Datenexport und Zurücksetzen ergänzt.
- JSON-Export verwendet in unterstützten Browsern den nativen „Speichern unter …“-Dialog mit frei wählbarem Speicherordner und merkt sich den zuletzt gewählten Ort; nicht unterstützte Browser verwenden weiterhin den Download-Fallback.
- PDF-/Druckaktion bleibt ergebnisbezogen außerhalb der dauerhaften Aktionsleiste.
- CSV-Import ist als nächster Ausbau vorgesehen; die konkrete Spaltenzuordnung wird erst nach Festlegung des Quellformats implementiert.

## Änderungen in Version 0.4.7

- vollständigen JSON-Import/-Export für Fondsrechner-Berechnungsdaten ergänzt: Start-/Enddaten, Beträge, Kaufspesen, Brutto/Netto-Modus, Benchmark-Auswahl, KESt-Befreiung und sämtliche zusätzlichen Zahlungsströme.
- Importdateien werden vor Übernahme validiert und anschließend bewusst nicht automatisch berechnet.
- Tabulator-Navigation bei HTML-Datumsfeldern zentral verbessert: der Fokus springt direkt zum nächsten bzw. vorherigen Formularfeld und überspringt das interne Kalender-Steuerelement des Browsers.

## Änderungen in Version 0.4.6

- JavaScript-Ausgabe im Fondsrechner gegen fehlende DOM-Elemente abgesichert; der gemeldete `textContent`-Fehler wird damit behoben.
- historischer Vergleich standardmäßig auf **beide Benchmarks** erweitert; Einzelbenchmark oder kein Vergleich bleiben auswählbar.
- Effektivrendite (XIRR) auch für historische Spareinlage und 3-Monats-Euribor ergänzt.
- grafischen Vergleich für Endwert und Effektivrendite von Fonds und Benchmarks ergänzt.
- Reset-Button für eine vollständige Neuberechnung ergänzt.
- laufende Benchmark-Abrufe werden bei nachträglicher Eingabeänderung nicht mehr als veraltete Ergebnisse gerendert.

## Änderungen in Version 0.4.4

- 3-Monats-Euribor-Benchmark wird wie ein fiktives Sparprodukt behandelt und grundsätzlich mit 25 % KESt auf positive Zinsen gerechnet.
- zentrale Auswahl „KESt-Befreiungserklärung“ im Fondsrechner ergänzt.
- bei aktiver Befreiung werden Spareinlagen- und Euribor-Benchmark ohne KESt-Abzug gerechnet.
- auf Fondsebene werden ausdrücklich als KESt/Steuer auf ausschüttungsgleichen Ertrag kategorisierte Cashflows bei aktiver Befreiung ignoriert.
- Berechnungsdetails und Hinweise zeigen die gewählte KESt-Behandlung transparent an.

## Änderungen in Version 0.4.3

- 3-Monats-Euribor als zweiten historischen Vergleichsbenchmark im Fondsrechner ergänzt.
- offizielle monatliche ECB-Reihe `FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA` angebunden.
- Euribor-Vergleich wird als Brutto-Marktbenchmark ohne fiktive KESt dargestellt.
- Cloudflare-Worker um `/euribor-3m` erweitert.
- bestehende Fortschreibung des letzten verfügbaren ECB-Monats gilt auch für den Euribor-Benchmark.

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

Die Navigation wird zentral über `SITE_MAP` und `SITE_NAV` in `docs/js/site-map.js` gepflegt. Auf dem Desktop erscheinen `Dashboard` und `About` als direkte Menüpunkte sowie `Datum & Zeit` und `Finanzen` als Dropdown-Gruppen. Im mobilen Hamburger-Menü werden dieselben Bereiche gruppiert dargestellt. Breadcrumbs und die Markierung der aktiven Seite werden ebenfalls daraus erzeugt.

## Dashboard

Die Startseite `docs/index.html` ist bewusst kompakt und zeigt primär die verfügbaren Tools. Hintergrundinformationen stehen auf `docs/about.html`.

Die Tool-Karten werden aus `data/tools.json` erzeugt. `docs/data/tools.json` ist nur die öffentliche Build-Kopie und wird mit `tools/sync_public_data.py` automatisch aus der kanonischen Datei synchronisiert.

## Datenschutz und externe Daten

Rechner-Eingaben werden lokal im Browser verarbeitet und nicht gespeichert. Exportierte Fondsrechner-JSON-Dateien werden ausschließlich lokal erzeugt bzw. lokal eingelesen und nicht hochgeladen. Der Bundesschatz-Vergleich ruft öffentliche Konditionsdaten über den Cloudflare-Worker ab. Der Fondsrechner lädt bei aktiviertem historischem Vergleich ausschließlich den benötigten Monatsbereich der ausgewählten öffentlichen ECB-Zinsserie (österreichische täglich fällige Einlagen oder 3-Monats-Euribor); die eingegebenen Fonds-Cashflows werden nicht an den Worker übertragen.

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

Aktuelle Version: **0.4.7**

- Fondsrendite-Ergebnisse können über **PDF / Drucken** als A4-Bericht mit Eingaben, Cashflows, Ergebnissen, Benchmarks, Vergleichsgrafiken und Berechnungsdetails ausgegeben werden.
