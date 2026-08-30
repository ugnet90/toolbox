# Toolbox

**Version:** 0.1.2

`toolbox` ist eine öffentliche, über GitHub Pages erreichbare Sammlung kleiner Rechen- und Alltagstools. Die Oberfläche ist responsiv und für Desktop sowie mobile Geräte ausgelegt.

## Aktueller Funktionsumfang

### Datumsrechner

1. **Zieldatum berechnen**
   - Ausgangsdatum
   - ganze Anzahl
   - Einheit: Tage, Wochen oder Monate
   - negative Werte für Rückwärtsrechnung
   - Ausgabe des Zieldatums

2. **Zeitspanne berechnen**
   - Ausgangsdatum bzw. Geburtsdatum
   - Enddatum, standardmäßig heute
   - Ausgabe als Kalenderzeit in Jahren, Monaten und Tagen
   - Gesamttage
   - Stunden auf Basis `Kalendertage × 24`
   - volle Wochen plus Resttage und zusätzlich dezimale Wochen
   - volle Monate

Die beiden Felder für das Ausgangsdatum sind gekoppelt: Wird das Datum in einem der beiden Rechner geändert, wird es automatisch in den jeweils anderen übernommen.

Bei Monatsrechnungen wird kalendarisch gerechnet. Existiert der Ausgangstag im Zielmonat nicht, wird auf den letzten Tag des Zielmonats begrenzt. Beispiel: `31.01.2026 + 1 Monat = 28.02.2026`.

## Änderungen in Version 0.1.2

- iOS-/Safari-spezifische Mindestbreite nativer Datumsfelder auf kleinen Displays aufgehoben.
- Form-, Grid- und Feldcontainer mobil zusätzlich auf die verfügbare Kartenbreite begrenzt.

## Änderungen in Version 0.1.1

- Datumsfelder auf kleinen mobilen Displays gegen horizontales Überlaufen abgesichert.
- Auswahlfeld „Einheit“ im Desktop-Layout auf die normale Eingabefeldhöhe ausgerichtet.
- Ausgangsdatum beider Berechnungsbereiche wird bidirektional synchronisiert.

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
│  ├─ css/
│  │  ├─ base.css
│  │  ├─ calculator.css
│  │  ├─ dashboard.css
│  │  └─ navigation.css
│  ├─ js/
│  │  ├─ dashboard.js
│  │  ├─ date-calculator.js
│  │  ├─ date-utils.js
│  │  ├─ navigation.js
│  │  └─ site-map.js
│  ├─ data/
│  │  └─ tools.json
│  ├─ date_calculator.html
│  └─ index.html
├─ scripts/
│  └─ test_date_utils.mjs
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

Webseiten werden bewusst **nicht** im Ordner `tools/` abgelegt.

## Navigation

Die Navigation wird zentral über zwei Strukturen in `docs/js/site-map.js` gepflegt:

- `SITE_MAP`: Seiten, Seitentitel, Links und Breadcrumb-Hierarchie.
- `SITE_NAV`: Gruppierung und Reihenfolge der Hauptnavigation.

Daraus werden automatisch erzeugt:

- Desktop-Navigation
- mobiles Hamburger-Menü
- Breadcrumbs
- Markierung der aktiven Seite

Neue Rechner benötigen dadurch keine eigene Navigationslogik.

## Dashboard

Die Startseite `docs/index.html` ist das zentrale Dashboard. Die Tool-Karten werden aus `data/tools.json` erzeugt. Die öffentliche Kopie unter `docs/data/tools.json` wird mit `tools/sync_public_data.py` synchronisiert.

## Datenschutz

Die derzeitigen Berechnungen laufen vollständig im Browser. Eingegebene Datumswerte werden nicht an einen Server übertragen und nicht gespeichert.

## GitHub Pages

Das Repository ist für die Bereitstellung über **GitHub Actions** vorbereitet. Der Workflow `.github/workflows/pages.yml`:

1. synchronisiert öffentliche Daten,
2. prüft die Projektstruktur,
3. führt Tests der Datumslogik aus,
4. lädt `docs/` als Pages-Artefakt hoch,
5. veröffentlicht die Seite über GitHub Pages.

Nach dem ersten Upload des Repositories muss unter **Settings → Pages → Build and deployment → Source** einmalig **GitHub Actions** ausgewählt werden.

## Erweiterung um ein neues Tool

Für einen neuen Rechner sind im Regelfall folgende Schritte nötig:

1. neue HTML-Seite unter `docs/` anlegen,
2. eigenes JavaScript-Modul unter `docs/js/` anlegen,
3. bei Bedarf eigenes Stylesheet unter `docs/css/` anlegen,
4. Seite in `SITE_MAP` und `SITE_NAV` ergänzen,
5. Tool in `data/tools.json` ergänzen,
6. `tools/sync_public_data.py` ausführen bzw. den GitHub-Actions-Workflow die Synchronisierung beim Deployment durchführen lassen.

## Versionierung

Die Projektversion steht in `VERSION` und wird zusätzlich im Dashboard und Footer angezeigt.

Aktuelle Version: **0.1.2**
