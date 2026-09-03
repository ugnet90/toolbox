# Toolbox

**Aktuell: v0.5.3** – Depotrendite, flexible Benchmark-Auswahl, Sparplan-Erkennung und erweiterter CSV-Import.

**Version:** 0.5.3

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


### Depotrendite & Vergleich

Der Rechner bildet ein Depot als datierte Zahlungsströme aus Sicht des Anlegers ab. Unterstützt werden Startinvestition mit Kaufspesen, beliebige Zuzahlungen/Sparraten, Ausschüttungen, Steuerbelastungen, Depotgebühren, Entnahmen und ein End-/Verkaufswert. Die effektive Nettorendite wird als datumsgenaue XIRR berechnet.

CSV-Buchungsimporte verwenden die Spalten `Abrechnungsbetrag`, `Geschäftsart`, `Abrechnungsdatum` und – sofern vorhanden – `Titel`. Nullbuchungen werden übersprungen. Regelmäßige Kaufbuchungen mit gleichem Titel und nur kleinen, kursbedingten Betragsabweichungen werden als mögliche monatliche Fondssparverträge zusammengefasst und im Ergebnis angezeigt. Die vollständige Detailtabelle der Zahlungsströme ist standardmäßig eingeklappt.

Historische Benchmarks werden per Checkbox ausgewählt und können auch nach einer bereits erfolgten Berechnung ein- oder ausgeschaltet werden; die Benchmark-Ergebnisse werden automatisch neu berechnet. Verfügbar sind:

- Ø täglich fällige österreichische Haushaltseinlagen,
- 3-Monats-Euribor,
- 6-Monats-Euribor,
- 12-Monats-Euribor.

Alle Benchmarks werden wie fiktive Sparprodukte behandelt: positive Zinsen unterliegen grundsätzlich 25 % KESt, bei aktivierter wirksamer KESt-Befreiungserklärung 0 %. Jede Benchmark besitzt eine eigene Abstufung innerhalb einer warmen Farbfamilie; die Depotrendite bleibt davon deutlich in Petrol/Blau getrennt.

Eine optionale lokale **Bezeichnung** kann für Depot, Exportdatei und PDF-Bericht vergeben werden. Sie wird nicht an GitHub oder den Daten-Worker übertragen. Der JSON-Export speichert den vollständigen Rechnerzustand einschließlich Bezeichnung, Benchmark-Auswahl und Zahlungsstrom-Titeln; alte v1-Fondsrendite-JSON-Dateien bleiben importierbar.

Beim PDF-/Druckbericht wird vorher gefragt, ob die einzelnen Zahlungsströme mit ausgegeben werden sollen.


## Änderungen in Version 0.5.4

- CSV-Import übernimmt zusätzlich die optionalen Spalten `ISIN`, `Menge` und `Einheit`; Kaufmengen werden positiv, Verkaufsmengen negativ als Stückbewegung normalisiert.
- JSON-Datenformat auf Schema v3 erweitert; bestehende v1-/v2-Exporte bleiben importierbar.
- historische Depotwertentwicklung aus Stückbewegungen und offiziellen Union-Investment-Rücknahmepreisen ergänzt.
- Grafik zeigt Depotwert und kumulierte Nettoinvestitionen; für Bewertungstage ohne eigenen Kurs wird der letzte verfügbare Rücknahmepreis verwendet.
- historische Kursdaten werden lokal in IndexedDB je ISIN gespeichert; beim nächsten Laden werden nur noch nicht lokal abgedeckte Zeiträume beim Worker angefordert.
- der aktuelle Kursrand wird höchstens einmal etwa alle 20 Stunden erneut abgefragt, damit nachgelieferte Tagespreise ergänzt werden können.
- Button zum Übernehmen des historisch berechneten Depotwerts in das Feld `End-/Verkaufswert` ergänzt.
- Cloudflare-Worker v0.5.6 unterstützt optional eine persistente KV-Zwischenspeicherung je ISIN, sodass Union selbst nicht bei jedem Browserabruf erneut angefragt werden muss.

## Änderungen in Version 0.5.3

- iOS-PDF-Erstellung neu aufgebaut: echte PDF-Datei statt automatischem Browserdruck; die PDF-Erzeugung erfolgt clientseitig mit `pdf-lib` (jsDelivr).
- PDF-Zahlungsstromauswahl als robustes Dropdown „Zusammenfassung / Einzelbuchungen“.
- Browser-Druck bleibt als separate Desktop-/Fallback-Funktion erhalten.

## Änderungen in Version 0.5.2

- iPhone/iPad: Datumsfelder lassen sich zusätzlich manuell im Format `TT.MM.JJJJ` eingeben; der Kalender bleibt über einen separaten Button verfügbar.
- Der Kalender-Button liegt nicht in der Tabulator-Reihenfolge.
- PDF/Drucken: eigener Druckdialog innerhalb der Toolbox; `window.print()` wird erst durch einen direkten Klick auf „Jetzt drucken / PDF“ ausgelöst und damit auf iOS nicht mehr als automatischer Druck behandelt.

## Änderungen in Version 0.5.1

- Hotfix: `VERSION` war in der v0.5.0-ZIP versehentlich leer.
- `VERSION` und `SITE_VERSION` sind wieder synchron.

## Änderungen in Version 0.5.0

- sichtbare Bezeichnung des Tools auf **Depotrendite & Vergleich** umgestellt; bestehende URL bleibt kompatibel.
- CSV-Import übernimmt zusätzlich `Titel`; Buchungen mit Abrechnungsbetrag 0 werden übersprungen und gemeldet.
- lange Zahlungsstromlisten standardmäßig eingeklappt; PDF fragt vor dem Druck, ob die Detailbuchungen enthalten sein sollen.
- automatische Erkennung monatlicher Fondssparverträge bei gleichbleibendem Titel und etwa ±1 % Buchungsabweichung ergänzt.
- Benchmark-Auswahl auf Checkboxen umgestellt; Ein-/Ausschalten nach Berechnung löst automatisch eine neue Benchmark-Berechnung aus.
- 6-Monats- und 12-Monats-Euribor ergänzt; alle Benchmarks farblich getrennt und deutlich vom Depot abgegrenzt.
- optionale lokale Bezeichnung für Export und PDF ergänzt.
- JSON-Datenformat auf Depotrendite v2 erweitert, mit Rückwärtskompatibilität zu alten Fondsrendite-v1-Exporten.

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

Rechner-Eingaben werden lokal im Browser verarbeitet und nicht gespeichert. Exportierte Depotrendite-JSON-Dateien werden ausschließlich lokal erzeugt bzw. lokal eingelesen und nicht hochgeladen. Der Bundesschatz-Vergleich ruft öffentliche Konditionsdaten über den Cloudflare-Worker ab. Der Depotrendite-Rechner lädt ausschließlich die benötigten Monatsbereiche der ausgewählten öffentlichen ECB-Zinsserien. Für die historische Depotwertentwicklung werden bei Wertpapierbuchungen nur ISIN und benötigter Zeitraum an den Cloudflare-Worker übertragen; Beträge, Mengen, Titel und Depotbezeichnungen bleiben lokal. Historische Union-Investment-Rücknahmepreise werden im Browser in IndexedDB zwischengespeichert; der Worker kann sie zusätzlich je ISIN in Cloudflare KV cachen.

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

Aktuelle Version: **0.5.8**

- Depotrendite-Ergebnisse können über **PDF / Drucken** als A4-Bericht mit Eingaben, optionalen Cashflow-Details, Sparplan-Hinweisen, Benchmarks, Vergleichsgrafiken und Berechnungsdetails ausgegeben werden.


### 0.5.5

- Historische Depotwertentwicklung: Fehler `formatDate is not defined` behoben.
- Ein Startbetrag von `0,00` ist zulässig, wenn die tatsächlichen Einzahlungen erst über spätere Zahlungsströme erfolgen.
- Beginnt ein Bank-CSV am frühesten Buchungsdatum mit einer Nullbuchung aus einem Dauerauftrag, wird diese Buchung weiterhin nicht als Zahlungsstrom importiert, kann bei leerem Startbereich aber automatisch das Depot-Startdatum mit Startwert `0,00` setzen.


### 0.5.6

- Nach jedem erfolgreichen Bank-CSV-Import wird zuerst gefragt, ob eine weitere CSV-Datei importiert werden soll. Mehrere CSV-Dateien werden dabei zu einer gemeinsamen Importsitzung zusammengefasst.
- Wird keine weitere CSV-Datei gewählt, folgt die Frage, ob Startdatum und Startwert manuell eingegeben werden sollen.
- Bei „Nein“ werden Startwert `0,00` und das früheste Buchungsdatum aller in dieser Importsitzung eingelesenen CSV-Inhalte automatisch als Depotstart übernommen. Das gilt auch, wenn die früheste CSV-Zeile eine übersprungene Nullbuchung ist.
- Bei „Ja“ bleiben Startdatum und Startwert zur manuellen Eingabe offen und der Fokus springt zum Startdatum.


### 0.5.7

- Historische Depotentwicklung erweitert: kleinere und kompaktere Achsenbeschriftungen sowie getrennte Diagramme für Wertentwicklung und Renditen.
- Neue historische Depotrendite als geldgewichtete, datumsgenaue XIRR p.a. zum jeweiligen Bewertungstag. Werte für Zeiträume unter 30 Tagen werden bewusst nicht annualisiert dargestellt.
- Für jede erkannte ISIN kann zusätzlich eine eigene historische Fondsrendite eingeblendet werden; ISIN-bezogene Ausschüttungen, Steuern und Gebühren fließen dabei mit ein, sofern sie im Zahlungsstrom einer ISIN zugeordnet sind.
- Erfolgreich geladene Benchmarks können in der historischen Darstellung jeweils als Wert- und Renditelinie eingeblendet werden. Alle verfügbaren Linien werden über Checkboxen gesteuert.
- Historische Diagramme können optional in die PDF-Ausgabe aufgenommen werden; dabei werden die aktuell ausgewählten Linien verwendet.
- Der Button unter der Depotentwicklung heißt nun „Berechneten Depotwert als Endwert verwenden“ und wird direkt erklärt. Er übernimmt den aus Mengen und historischen Rücknahmepreisen berechneten Depotwert in das Feld End-/Verkaufswert.
- Kaufspesen sind für Start-/Einmalanlage und manuell erzeugte Sparraten/Daueraufträge getrennt. Für Sparraten kann zwischen Brutto-Kundenaufwand und Nettoanlagebetrag gewählt werden. CSV-Abrechnungsbeträge bleiben unverändert, da sie bereits die tatsächlichen Anleger-Cashflows darstellen.
- Depotrendite-JSON-Format auf Schema v4 erweitert; ältere v1/v2/v3-Dateien bleiben importierbar. Ein Startwert von 0,00 Euro ist auch beim JSON-Import zulässig.


### 0.5.8

- Checkboxen in der historischen Diagrammauswahl werden unabhängig von globalen Eingabefeld-Styles einheitlich mit 16 × 16 px dargestellt.
- Die Euro-Wertentwicklung kann zusätzlich „Gewinn / Verlust“ anzeigen. Berechnet wird der jeweilige Depotwert zuzüglich aller bis zum Bewertungszeitpunkt angefallenen Anleger-Cashflows; Ausschüttungen, Entnahmen, Gebühren und Steuern wirken damit entsprechend ihrer erfassten Cashflows auf die Gewinnlinie.
- Das End-/Bewertungsdatum wird beim erstmaligen Öffnen und nach einem Reset standardmäßig mit dem heutigen lokalen Datum vorbelegt. Importierte gespeicherte Enddaten bleiben davon unberührt.
- „Depotwert aus historischen Kursen ermitteln“ steht direkt beim Feld End-/Verkaufswert zur Verfügung und kann vor der eigentlichen Renditeberechnung verwendet werden. Der Button lädt die benötigten historischen Rücknahmepreise, zeigt die historische Depotentwicklung und setzt den ermittelten Depotwert als Endwert ein.
- Historische Renditelinien bleiben erhalten; die neue Gewinn-/Verlustlinie ist wie alle anderen verfügbaren historischen Linien per Checkbox ein-/ausblendbar und wird bei aktivierter PDF-Option ebenfalls berücksichtigt.
- Achsenbeschriftungen der historischen SVG-Diagramme wurden nochmals verkleinert.
