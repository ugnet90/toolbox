# Toolbox

`toolbox` ist eine öffentliche, über GitHub Pages erreichbare Sammlung kleiner Rechen- und Alltagstools. Die Oberfläche ist responsiv und für Desktop sowie mobile Geräte ausgelegt.

## Aktueller Stand

- **Toolbox:** 0.5.9
- **Cloudflare-Datenworker:** 0.5.6
- **Öffentliche Oberfläche:** GitHub Pages
- **Kanonische Tool-Liste:** `data/tools.json`

Toolbox und Cloudflare-Worker werden unabhängig voneinander versioniert. Die Toolbox-Version steht kanonisch in `VERSION`; `SITE_VERSION` in `docs/js/site-map.js` muss dazu identisch sein.

## Funktionsumfang

### Datumsrechner

- Zieldatum aus Ausgangsdatum plus/minus Tage, Wochen oder Monate.
- Zeitspanne zwischen zwei Daten mit Kalenderzeit, Tagen, Stunden, Wochen und vollen Monaten.
- Kalenderkorrekte Monatsrechnung.
- Für mobile Geräte optimierte Datumseingabe.

### Bundesschatz-Vergleich

- Live-Abruf aktuell veröffentlichter Bundesschatz-Produkte über den Cloudflare-Worker.
- Dynamische Laufzeiten statt fest hinterlegter Produktliste.
- Vergleich mit einer österreichischen Spareinlage nach Steuern.
- Manuelle Eingabe als Fallback, falls Live-Daten nicht verfügbar sind.

Worker-Endpunkt:

`/bundesschatz`

### Effektivzins & Vergleich

- Einzahlungs- und Auszahlungsbetrag.
- Netto-/Brutto-Modus.
- KESt 0 %, 25 % oder 27,5 %.
- Versicherungssteuer 0 %, 4 % oder 11 %.
- Annualisierter Netto-Effektivzins.
- Vergleich mit österreichischer Spareinlage.

### Depotrendite & Vergleich

Der Rechner bildet ein Depot als datierte Zahlungsströme aus Sicht des Anlegers ab. Unterstützt werden unter anderem:

- Startinvestition,
- Zuzahlungen und Sparraten,
- Ausschüttungen,
- KESt-/Steuerbelastungen,
- Depot- und sonstige Gebühren,
- Entnahmen,
- End-/Verkaufswert.

Die Depotrendite wird als datumsgenaue XIRR berechnet.

#### Bank-CSV-Import

Unterstützt werden insbesondere die Spalten:

- `Abrechnungsbetrag`
- `Geschäftsart`
- `Abrechnungsdatum`
- `Titel`
- `ISIN`
- `Menge`
- `Einheit`
- `Stichtag`
- `Rechenwert`

Mehrere CSV-Dateien können in einer Importsitzung nacheinander ergänzt werden. Nach dem letzten Import kann Startdatum/-wert manuell eingegeben werden; alternativ übernimmt die Toolbox Startwert `0,00 €` und das früheste Buchungsdatum der Importsitzung.

Nullbuchungen werden nicht als Zahlungsstrom übernommen, können aber für die automatische Startdatumsbestimmung relevant sein.

#### Buchungsgenaue Fondskaufspesen aus CSV

Für Kaufbuchungen mit `Stichtag`, `Rechenwert`, `Menge` und `Abrechnungsbetrag` werden die tatsächlichen Kaufspesen bzw. die Preisabweichung buchungsgenau abgeleitet:

`effektiver Preis je Anteil = |Abrechnungsbetrag| / |Menge|`

`Differenz je Anteil = effektiver Preis je Anteil - Rechenwert`

`Differenz gesamt = |Abrechnungsbetrag| - Rechenwert × |Menge|`

Die Toolbox fasst diese Werte je Fonds zusammen und zeigt Rechenwert gesamt, Anlegeraufwand, Differenz/Spesen und den gewichteten durchschnittlichen Prozentsatz an. CSV-Abrechnungsbeträge bleiben als tatsächliche Anleger-Cashflows unverändert.

Für manuell angelegte Start-/Einmalanlagen und manuell erzeugte Sparraten bleiben separate Kaufspesen-Einstellungen verfügbar.

#### Historische Depotwertentwicklung

Für Wertpapierbuchungen mit ISIN und Menge kann die historische Depotentwicklung aus offiziellen Union-Investment-Rücknahmepreisen rekonstruiert werden.

Darstellbar sind per Checkbox unter anderem:

- Depotwert,
- kumulierte Nettoinvestitionen,
- Gewinn / Verlust,
- historische Depotrendite,
- Positionsrenditen einzelner Fonds,
- ausgewählte Benchmark-Wertentwicklungen,
- ausgewählte Benchmark-Renditen.

Positionsrenditen beginnen erst mit der ersten Kaufposition der jeweiligen ISIN. Fehlende Renditewerte werden nicht als 0-%-Linie dargestellt.

Für Bewertungstage ohne eigenen NAV wird der letzte verfügbare offizielle Rücknahmepreis davor verwendet.

Der Button **„Depotwert aus historischen Kursen ermitteln“** kann bereits vor der eigentlichen Renditeberechnung verwendet werden und übernimmt den berechneten Depotwert als End-/Verkaufswert.

#### Historische Benchmarks

Verfügbar sind:

- österreichische täglich fällige Haushaltseinlagen,
- 3-Monats-Euribor,
- 6-Monats-Euribor,
- 12-Monats-Euribor.

Die ECB-Reihen werden über den Cloudflare-Worker geladen. Für fehlende Monate nach dem letzten offiziellen Datenpunkt kann der letzte verfügbare Zinssatz bis zum Vergleichsende fortgeführt werden; echte Lücken innerhalb der Datenreihe bleiben Fehler.

#### PDF und Datenexport

- Clientseitige PDF-Erzeugung, auch für iPhone/iPad.
- Wahlweise Zusammenfassung oder einzelne Zahlungsströme.
- Historische Diagramme optional im PDF.
- Vollständiger JSON-Import/-Export des Rechnerzustands.
- Aktuelles JSON-Schema: **v5**; ältere unterstützte Schema-Versionen bleiben importierbar.

## Daten- und Cache-Architektur

### Historische Union-Fondspreise

Die historische Preisabfrage verwendet den Cloudflare-Worker-Endpunkt:

`/union-prices?isin=<ISIN>&start=YYYY-MM-DD&end=YYYY-MM-DD`

Datenweg:

```text
Union Investment API
        ↓
Cloudflare Worker
        ↓
Cloudflare KV je ISIN
        ↓
Browser / benötigter Zeitraum
        ↓
IndexedDB je ISIN
        ↓
Depotberechnung und Diagramme
```

- Der Union-API-Key liegt ausschließlich als Cloudflare-Secret `UNION_API_KEY` im Worker.
- Das KV-Binding heißt `UNION_PRICE_KV`.
- Historische Kursreihen werden serverseitig zwischengespeichert.
- Im Browser werden bereits geladene Kursbereiche zusätzlich in IndexedDB gespeichert.
- Die Seite fordert nur lokal fehlende Zeiträume beim Worker an.

### Weitere Worker-Endpunkte

- `/bundesschatz`
- `/savings-rates?start=YYYY-MM&end=YYYY-MM`
- `/euribor-3m?start=YYYY-MM&end=YYYY-MM`
- `/euribor-6m?start=YYYY-MM&end=YYYY-MM`
- `/euribor-12m?start=YYYY-MM&end=YYYY-MM`
- `/union-prices?isin=ISIN&start=YYYY-MM-DD&end=YYYY-MM-DD`

## Datenschutz

Berechnungsdaten und Depotbezeichnungen werden lokal im Browser verarbeitet. Beim Abruf historischer Union-Preise werden nur ISIN und benötigter Zeitraum an den Worker übertragen; Beträge, Mengen, Titel und Depotbezeichnungen werden nicht an Union übertragen.

JSON-Import und -Export erfolgen lokal. Historische Kursdaten werden lokal in IndexedDB zwischengespeichert; der Worker kann dieselben öffentlichen Preisreihen zusätzlich in Cloudflare KV cachen.

## Repository-Struktur

```text
toolbox/
├─ .github/
│  └─ workflows/
├─ data/
│  └─ tools.json
├─ docs/
│  ├─ assets/
│  ├─ css/
│  ├─ data/
│  ├─ js/
│  ├─ about.html
│  ├─ bundesschatz_compare.html
│  ├─ date_calculator.html
│  ├─ effective_interest.html
│  ├─ fund_return.html
│  └─ index.html
├─ scripts/
├─ tools/
├─ README.md
└─ VERSION
```

### Rollen

- `.github/workflows/`: GitHub-Actions-Workflows.
- `data/`: kanonische strukturierte Projektdaten.
- `docs/`: öffentliche GitHub-Pages-Oberfläche.
- `docs/css/`: gemeinsame und seitenbezogene Stylesheets.
- `docs/js/`: Navigation und Tool-Logik.
- `scripts/`: technische Tests.
- `tools/`: Python-Hilfsprogramme für Synchronisierung und Validierung.

Webseiten werden bewusst nicht unter `tools/` abgelegt.

## Navigation und Build

Die Navigation wird zentral über `SITE_MAP` und `SITE_NAV` in `docs/js/site-map.js` gepflegt.

`data/tools.json` ist die kanonische Tool-Liste. `docs/data/tools.json` ist nur die veröffentlichte Build-Kopie und wird im Workflow synchronisiert.

Der GitHub-Pages-Workflow synchronisiert die öffentlichen Daten, validiert die Projektstruktur, führt die Tests aus und veröffentlicht anschließend `docs/`.

## Versionierung

Für die Toolbox gilt:

1. `VERSION` enthält die kanonische Projektversion.
2. `SITE_VERSION` in `docs/js/site-map.js` muss exakt identisch sein.
3. Der Cloudflare-Worker besitzt eine eigene, unabhängige Versionsnummer.
4. Versionsinformationen werden nicht zusätzlich in einzelnen HTML-Seiten gepflegt.
5. Der Änderungsverlauf steht ausschließlich im folgenden Changelog.

## Changelog

### 0.5.9

- Historische Positionsrenditen korrigiert: `null`/fehlende Renditewerte werden nicht mehr versehentlich als 0 % gezeichnet.
- Positionsrenditen beginnen explizit erst ab der ersten Kaufposition der jeweiligen ISIN.
- CSV-Import wertet zusätzlich `Stichtag` und `Rechenwert` aus.
- Buchungsgenaue Fondskaufspesen-/Preisabweichung aus Abrechnungsbetrag, Menge und Rechenwert ergänzt.
- Kaufspesen werden je Fonds zusammengefasst angezeigt.
- JSON-Datenformat auf Schema v5 erweitert; CSV-spezifische Bewertungs- und Speseninformationen bleiben dadurch auch im JSON-Export erhalten.
- README vollständig neu strukturiert; doppelte und widersprüchliche Versionsangaben entfernt.

### 0.5.8

- Gewinn-/Verlustlinie in der historischen Depotentwicklung ergänzt.
- End-/Bewertungsdatum standardmäßig auf heutiges Datum gesetzt.
- historische Depotwertermittlung vor die Renditeberechnung verlegt.
- Diagramm-Checkboxen und Achsenbeschriftungen vereinheitlicht.

### 0.5.7

- Historische Depot- und Positionsrenditen ergänzt.
- Fonds-, Depot- und Benchmark-Linien per Checkbox auswählbar.
- Historische Diagramme optional in PDF-Ausgabe integriert.
- Kaufspesen für manuelle Einmalanlage und manuelle Sparrate getrennt.

### 0.5.6

- Mehrstufiger CSV-Import mit mehreren Dateien und anschließender Startwertentscheidung.
- Cloudflare-Worker 0.5.6 mit optionalem KV-Cache für Union-Preisreihen.

### 0.5.5

- 0-Euro-Depotstart unterstützt.
- Fehler in der historischen Datumsformatierung behoben.

### 0.5.4

- Historische Depotwertentwicklung aus ISIN, Menge und Union-Rücknahmepreisen eingeführt.
- IndexedDB-Cache für historische Fondspreise ergänzt.
- CSV-Import um ISIN, Menge und Einheit erweitert.

### 0.5.0–0.5.3

- Umbenennung auf **Depotrendite & Vergleich**.
- 6M-/12M-Euribor, flexible Benchmark-Auswahl, Sparplan-Erkennung und erweiterter CSV-Import.
- Mobile Datumseingabe verbessert.
- Clientseitige PDF-Erzeugung für iOS eingeführt.

### 0.4.x

- Depotrendite-Rechner mit XIRR eingeführt.
- Historische Spareinlagen- und Euribor-Benchmarks ergänzt.
- JSON-Import/-Export, Druck/PDF, CSV-Import und Ergebnisgrafiken schrittweise ausgebaut.

### 0.3.x

- Dashboard/About-Struktur, Effektivzins-Rechner und Steuerlogik ausgebaut.
- Responsive Darstellung und österreichische Betragsformatierung verbessert.
