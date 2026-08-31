# Toolbox

**Version:** 0.2.1

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

### Bundesschatz-Vergleich

Der Rechner lädt beim Öffnen die aktuell veröffentlichten Bundesschatz-Produkte über einen schlanken Cloudflare-Worker-Proxy:

`https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev/bundesschatz`

Der Worker ruft seinerseits ausschließlich die öffentliche Bundesschatz-Schnittstelle ab. Er speichert keine Zinssätze und enthält keine feste Laufzeitenliste. Der Proxy ist notwendig, weil die Bundesschatz-Schnittstelle direkte Browserabrufe von GitHub Pages per CORS nicht zulässt.

Die Laufzeiten werden **nicht fest im Quellcode hinterlegt**. Alle von der Schnittstelle für den relevanten Valutatag gelieferten und unterstützten Laufzeiten werden dynamisch angezeigt. Dadurch können Produkte hinzukommen oder wegfallen, ohne dass die Auswahl manuell geändert werden muss.

Ablauf:

1. aktuelle Produkte und Zinssätze laden,
2. relevanten Valutatag nach Bundesschatz-Logik bestimmen,
3. gewünschte Laufzeit auswählen,
4. Netto-Endbetrag des Bundesschatzes nach 27,5 % KESt berechnen,
5. Bruttozinssatz einer österreichischen Spareinlage ermitteln, der nach 25 % KESt denselben Endbetrag erreicht.

Der angezeigte erforderliche Bankzinssatz wird auf 0,01 Prozentpunkte **aufgerundet**, damit der gerundete Vergleichswert den Bundesschatz-Endbetrag nicht unterschreitet. Der rechnerisch genaue Wert wird in den Berechnungsdetails angezeigt.

Vergleichsannahmen für Spareinlagen:

- 25 % KESt,
- Zinsrechnung 30/360,
- Jahresabschluss zum Kalenderjahresende,
- keine Gebühren oder Spesen.

Bundesschatz wird entsprechend der veröffentlichten Berechnungsmethode gerechnet: bis einschließlich ein Jahr einfache Verzinsung mit tatsächlichen Tagen/365, bei längeren Laufzeiten Zinseszins mit tatsächlichen Tagen/365. Die KESt von 27,5 % wird auf den Zinsertrag berücksichtigt.

Die Website verwendet keine fest gespeicherten Ersatz-Zinssätze. Scheitert der Live-Abruf, wird dies sichtbar gemeldet, anstatt möglicherweise veraltete Werte zu verwenden.

## Änderungen in Version 0.2.1

- Live-Abruf der Bundesschatz-Produkte auf den Cloudflare-Worker `toolbox-bundesschatz-proxy` umgestellt,
- CORS-Problem des direkten Browserzugriffs auf die Bundesschatz-Schnittstelle behoben,
- dynamische Laufzeiten- und Zinssatzlogik unverändert beibehalten,
- keine fest gespeicherten Ersatzwerte eingeführt.

## Frühere Änderungen

### Version 0.2.0

- neuen Rechner **Bundesschatz-Vergleich** ergänzt,
- Bundesschatz-Angebote und Zinssätze werden beim Öffnen dynamisch aus der öffentlichen Schnittstelle geladen,
- Auswahl ist nicht auf bestimmte Laufzeiten festgelegt und reagiert auf hinzukommende bzw. wegfallende Angebote,
- Valutatag berücksichtigt die offizielle 12:00-Uhr-Regel in der Zeitzone Europe/Vienna,
- Vergleich von 27,5 % Bundesschatz-KESt mit 25 % KESt für österreichische Spareinlagen,
- Spareinlagen-Vergleich mit 30/360 und kalenderjährlichem Jahresabschluss,
- neue Berechnungslogik durch eigene Node-Tests abgesichert,
- Navigation und Dashboard um die Kategorie **Finanzen** erweitert,
- Dashboard auf Mobilgeräten kompakter gemacht: Einleitung wird ausgeblendet, damit die Tool-Karten schneller sichtbar sind.

### Version 0.1.4

- Toolbox-Dashboard-Logo in die zentrale Navigation eingebunden.
- Vollständigen Favicon-Satz in Dashboard und Datumsrechner eingebunden.
- Apple-Touch-Icon und Web-App-Manifest eingebunden.
- Projektvalidierung um die Branding-Dateien erweitert.

### Version 0.1.3

- Neues Toolbox-Branding mit gekreuztem Schraubenschlüssel und Hammer ergänzt.
- Vollständigen Favicon-Satz und Dashboard-Logo unter `docs/assets/` angelegt.

### Version 0.1.2

- iOS-/Safari-spezifische Mindestbreite nativer Datumsfelder auf kleinen Displays aufgehoben.
- Form-, Grid- und Feldcontainer mobil zusätzlich auf die verfügbare Kartenbreite begrenzt.

### Version 0.1.1

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
│  │  ├─ favicon/
│  │  └─ logo/
│  ├─ css/
│  │  ├─ base.css
│  │  ├─ bundesschatz.css
│  │  ├─ calculator.css
│  │  ├─ dashboard.css
│  │  └─ navigation.css
│  ├─ data/
│  │  └─ tools.json
│  ├─ js/
│  │  ├─ bundesschatz-compare.js
│  │  ├─ bundesschatz-utils.js
│  │  ├─ dashboard.js
│  │  ├─ date-calculator.js
│  │  ├─ date-utils.js
│  │  ├─ navigation.js
│  │  └─ site-map.js
│  ├─ bundesschatz_compare.html
│  ├─ date_calculator.html
│  └─ index.html
├─ scripts/
│  ├─ test_bundesschatz_utils.mjs
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

Daraus werden automatisch Desktop-Navigation, mobiles Hamburger-Menü, Breadcrumbs und die Markierung der aktiven Seite erzeugt.

## Dashboard

Die Startseite `docs/index.html` ist das zentrale Dashboard. Die Tool-Karten werden aus `data/tools.json` erzeugt. Die öffentliche Kopie unter `docs/data/tools.json` wird mit `tools/sync_public_data.py` synchronisiert.

Auf kleinen Displays wird die ausführliche Dashboard-Einleitung ausgeblendet, damit die verfügbaren Tools möglichst ohne Scrollen erreichbar sind.

## Datenschutz und externe Daten

Die eigentlichen Rechner-Eingaben werden lokal im Browser verarbeitet und nicht gespeichert. Der Bundesschatz-Vergleich ruft beim Öffnen öffentliche Konditionsdaten von `bundesschatz.at` ab; dabei werden keine vom Benutzer eingegebenen persönlichen Daten übertragen.

## GitHub Pages

Das Repository wird über **GitHub Actions** bereitgestellt. Der Workflow `.github/workflows/pages.yml`:

1. synchronisiert öffentliche Daten,
2. prüft die Projektstruktur,
3. testet die Datumslogik,
4. testet die Bundesschatz-Vergleichslogik,
5. lädt `docs/` als Pages-Artefakt hoch,
6. veröffentlicht die Seite über GitHub Pages.

## Erweiterung um ein neues Tool

Für einen neuen Rechner sind im Regelfall folgende Schritte nötig:

1. neue HTML-Seite unter `docs/` anlegen,
2. eigenes JavaScript-Modul unter `docs/js/` anlegen,
3. bei Bedarf eigenes Stylesheet unter `docs/css/` anlegen,
4. Seite in `SITE_MAP` und `SITE_NAV` ergänzen,
5. Tool in `data/tools.json` ergänzen,
6. Tests ergänzen,
7. `tools/sync_public_data.py` ausführen bzw. den GitHub-Actions-Workflow die Synchronisierung beim Deployment durchführen lassen.

## Versionierung

Die Projektversion steht in `VERSION` und wird zusätzlich im Dashboard und Footer angezeigt.

Aktuelle Version: **0.2.1**
