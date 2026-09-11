# Toolbox

`toolbox` ist eine öffentliche, über GitHub Pages erreichbare Sammlung kleiner Rechen- und Alltagstools. Die Oberfläche ist responsiv und für Desktop sowie mobile Geräte ausgelegt.

## Aktueller Stand

- **Toolbox:** 0.7.6
- **Cloudflare-Datenworker:** 0.5.6
- **Öffentliche Oberfläche:** GitHub Pages
- **Kanonische Tool-Liste:** `data/tools.json`

Toolbox und Cloudflare-Worker werden unabhängig voneinander versioniert. Die Toolbox-Version steht kanonisch in `VERSION`; `SITE_VERSION` in `docs/js/site-map.js` muss dazu identisch sein.

## Änderungen in 0.7.6

- Fondswechsel über das Dropdown verbessert: Das Fondsfeld bleibt weiterhin frei eintippbar, besitzt jetzt aber einen eigenen Auswahlpfeil. Dieser öffnet unabhängig vom aktuell eingetragenen Fonds immer die vollständige aktuelle ERGO-/Union-Fondspalette. Ein Fonds kann dadurch direkt gewechselt werden, ohne den bisherigen Namen zu löschen oder den Rechner zurückzusetzen.
- Die bisherige Datalist bleibt für die Texteingabe erhalten; vollständige Fondsnamen bzw. ISINs werden weiterhin automatisch erkannt und ergänzen Name, ISIN, Ausgabeaufschlag und historischen Renditevorschlag.
- Die Veröffentlichung von Projektdaten wurde zentralisiert: `tools/sync_public_data.py` synchronisiert nun sowohl `data/tools.json` nach `docs/data/tools.json` als auch `data/ergo_union_funds.json` nach `docs/data/ergo_union_funds.json`. Mit `--check` wird die Byte-Gleichheit geprüft.
- `tools/update_ergo_fund_palette.py` schreibt nur noch die kanonische Fondsdatei unter `data/`. Der manuelle Workflow ruft anschließend die zentrale Datensynchronisierung auf und prüft die Übereinstimmung, bevor kanonische Datei und Pages-Spiegel gemeinsam committed werden.
- Der GitHub-Pages-Workflow verwendet weiterhin dieselbe zentrale Synchronisierung vor dem Build. Damit existiert keine zweite unabhängig gepflegte ERGO-Fondsdatei mehr.

## Änderungen in 0.7.5

- Für die beiden ERGO-Einmalprämienprodukte wird die Versicherungssteuer automatisch aus der gewählten Laufzeit und der 50+-Voraussetzung bestimmt: 4 % ab 15 Jahren bzw. ab 10 Jahren, wenn Versicherungsnehmer und versicherte Person(en) bei Abschluss jeweils mindestens 50 Jahre alt waren; darunter 11 %. Das Feld ist bei den ERGO-Produkten deshalb nicht mehr manuell editierbar.
- Bei einer individuellen Versicherung bleibt der Versicherungssteuersatz frei editierbar; die bisherige Modelllogik für einen vorzeitigen Ausstieg aus einer mit 4 % besteuerten Police bleibt dort erhalten.
- Berechnungsergebnisse werden bei jeder Eingabe- oder Auswahländerung zuverlässig invalidiert: Ergebnisbereich, Diagramm und Vergleichsdetails werden sofort entfernt. Ein expliziter CSS-Schutz stellt sicher, dass `hidden` nicht durch seitenbezogene `display`-Regeln übersteuert wird.
- Fondswechsel ohne Zurücksetzen repariert: Während der Texteingabe wird nur noch ein vollständiger Fondsname bzw. eine vollständige ISIN automatisch übernommen. Eindeutige Teilpräfixe setzen den bisherigen Fonds nicht mehr zurück; eine andere Auswahl aus der Datalist kann daher unmittelbar getroffen werden.

## Änderungen in 0.7.4

- Die Fondsreferenz des Rechners wird aus einer eigenen ERGO-/Union-Fondspalette geladen. Der ausgelieferte Stand enthält die aktuell in der gemeinsamen ERGO-Fondsliste für „ERGO fürs Leben / ERGO fürs Sparen / ERGO fürs Investment“ enthaltenen Union-Investment-Fonds mit Name und ISIN.
- Neue manuelle GitHub Action **„Update ERGO fund palette“** ergänzt. Sie besitzt ausschließlich `workflow_dispatch` und keinen Zeitplan: Die aktuelle ERGO-Fondsliste wird nur auf ausdrücklichen manuellen Start geprüft.
- Der Aktualisierungsworkflow übernimmt neu hinzugekommene Union-Fonds automatisch und archiviert nicht mehr enthaltene Fonds automatisch in `removed_funds`. Kanonische und öffentliche Fondsdatei werden gemeinsam aktualisiert.
- Beim Öffnen des Rechners wird nur der lokale Datenstand der gespeicherten Fondspalette geprüft. Ist `checked_at` älter als 60 Tage, erscheint ein Hinweis auf die manuelle GitHub-Action; beim Seitenaufruf erfolgt keine externe Aktualisierung.
- Fondsname und ISIN sind über die gesamte gespeicherte ERGO-/Union-Palette miteinander verknüpft. Nach eindeutiger Erkennung werden Name, ISIN und regulärer Ausgabeaufschlag automatisch vorbelegt.
- Reguläre Ausgabeaufschläge werden beim Fondslisten-Update bevorzugt aus dem offiziellen Union-Investment-Preis-/Leistungsverzeichnis übernommen. Fondsweb wird nur als Fallback verwendet.
- Historische Renditevorschläge verwenden – soweit gespeichert bzw. abrufbar – standardisierte annualisierte Performancewerte. Für die gewählte Vergleichslaufzeit wird der längste verfügbare Standardzeitraum verwendet, der die Laufzeit nicht überschreitet; bei kürzerer Laufzeit der kürzeste verfügbare Zeitraum.
- Fondsweb wird beim manuellen Update bestmöglich als Quelle für standardisierte Performancewerte genutzt. Kann keine standardisierte Performance geliefert werden, ermittelt der Rechner für Union-Fonds eine kursbasierte historische Näherung über die bestehende Union-Kursquelle; diese wird ausdrücklich als Kurs-CAGR ohne Ausschüttungen gekennzeichnet.
- Der historische Vorschlag bleibt weiterhin zusammen mit zwei niedrigeren und zwei höheren Renditeszenarien auswählbar. Quellenangabe und Datenstand werden nur beim historischen Wert angezeigt und bei manueller bzw. Szenario-Auswahl entfernt.
- Nach jeder relevanten Eingabe- oder Auswahländerung wird ein bereits berechnetes Ergebnis sofort ausgeblendet, auch bei `change`-Ereignissen wie dem Wechsel des Versicherungsprodukts.

## Änderungen in 0.7.3

- Fondsreferenz-Autovervollständigung repariert und auf unmittelbare Erkennung während der Eingabe umgestellt: bei vollständig erkanntem Fondsnamen oder ISIN werden ISIN/Fondsname, historischer Renditevorschlag und regulärer Ausgabeaufschlag sofort vorbelegt.
- Schutz gegen gemischte Browser-Cache-Stände ergänzt: Lädt eine ältere HTML-Struktur zusammen mit aktuellem JavaScript, werden die zwei getrennten Verwaltungskostenfelder automatisch nachgerüstet. Dadurch entfällt die irreführende Fehlermeldung „Verwaltungskosten auf die Netto-Einmalprämie eintragen“.
- Versicherungskosten bleiben strikt je Versicherungsprodukt getrennt gespeichert. ERGO fürs Investment und ERGO fürs Leben besitzen voneinander unabhängige lokale Kostenprofile; vorhandene v0.7.2-Werte werden produktbezogen übernommen.
- ERGO fürs Leben verwendet als Preset 5,5 % Abschlusskosten über fünf Jahre sowie 0,15 % p.a. der Netto-Einmalprämie plus 0,10 % p.a. des Vermögens. ERGO fürs Investment bleibt bei 5 % über fünf Jahre und 0,3 % p.a. des Vermögens.
- Depotkosten und Sonderkondition/Rabatt werden nun gemeinsam lokal gespeichert. Der Standard-Rabatt ist 0 %; damit gilt ohne individuelle Sonderkondition der reguläre Ausgabeaufschlag des Fonds.
- Versionsparameter für seitenbezogenes CSS/JavaScript angehoben, um Cache-Mischstände bei Updates zusätzlich zu reduzieren.

## Änderungen in 0.7.2

- ERGO-Kostenpresets aktualisiert: **ERGO fürs Investment** mit 5 % Abschlusskosten der Netto-Einmalprämie über fünf Jahre und 0,3 % p.a. Verwaltungskosten der Deckungsrückstellung; **ERGO fürs Leben – Einmalprämie** mit 5,5 % Abschlusskosten über fünf Jahre, 0,15 % p.a. der Netto-Einmalprämie plus 0,10 % p.a. des Vermögens.
- Versicherungs-Verwaltungskosten fachlich in zwei Komponenten getrennt: Prozentsatz der Netto-Einmalprämie und Prozentsatz des laufenden Vermögens. Beide Komponenten werden im jährlichen Rechenlauf separat belastet und ausgewiesen.
- Versicherungskosten werden gerätebezogen in `localStorage` gespeichert – getrennt je Versicherungsprodukt. Gespeichert werden Abschlusskostensatz, Verteilungsdauer, beide Verwaltungskostensätze und Risikokosten. Die Produktpresets bleiben die Ausgangswerte, solange keine eigenen Werte gespeichert wurden.
- Geldbeträge in Eingaben und Vergleichsausgabe verwenden konsequent österreichische Tausenderpunkte und zwei Dezimalstellen.
- Die bisher getrennten Kosten-/Steuerkarten wurden zu einer gemeinsamen Vergleichsübersicht zusammengeführt. Wirtschaftlich vergleichbare Positionen stehen jetzt zeilenweise direkt nebeneinander.
- Bei vergleichbaren Positionen wird der jeweilige Euro-Vorteil unmittelbar auf der günstigeren Seite angezeigt; günstigere Werte werden grün, ungünstigere rot hervorgehoben. Nicht direkt vergleichbare Einzelpositionen bleiben neutral.
- JSON-Schema des Vergleichstools auf v3 angehoben. Exporte aus Schema v1/v2 bleiben importierbar; der frühere einzelne Verwaltungskostensatz wird dabei als vermögensabhängige Verwaltungskomponente übernommen.

## Änderungen in 0.7.1

- Fondskosten aus dem Vergleich entfernt: Die angenommene Fondsrendite versteht sich nun ausdrücklich bereits nach den auf Fondsebene anfallenden Kosten. Dadurch wird derselbe Fonds auf beiden Wegen nicht doppelt mit identischen Fondskosten belastet.
- Fondsreferenzlogik ergänzt: Bei erkannten Union-Investment-Fonds können historischer Renditewert und regulärer Ausgabeaufschlag vorbelegt werden. Für UniGlobal ist der historische Wert 6,12 % p.a. seit Auflegung (Union Investment, Stand 20.01.2025) hinterlegt; der reguläre Ausgabeaufschlag beträgt 5 %.
- Zum historischen Renditewert werden automatisch zwei ganzzahlige Szenarien darunter und zwei darüber angeboten. Bei 6,12 % erscheinen damit 5 %, 6 %, 6,12 %, 7 % und 8 %.
- Quellen- und Standhinweis werden ausschließlich beim ausdrücklich gewählten historischen Wert gezeigt. Bei Szenarioauswahl oder manueller Überschreibung wechselt die Anzeige auf „Individuelle Renditeannahme“.
- Mindest-Einmalprämie wird als österreichischer Betrag formatiert.
- Prozentuelle und fixe Depotkosten werden gerätebezogen in `localStorage` gespeichert; Sonderkondition/Rabatt wird bewusst nicht gespeichert. „Zurücksetzen“ behält die gespeicherten Depotkosten.
- Break-even wird zusätzlich im Verlaufsdiagramm mit gestrichelter senkrechter Linie und angenähertem Schnittjahr markiert.
- Kosten- und Steuerübersichten nach Start, Kosten, Steuern und Ergebnis gegliedert. Vergleichbare Summen und Nettoendwerte werden dezent grün bzw. rot hervorgehoben.
- JSON-Schema des neuen Vergleichstools auf v2 angehoben; v1-Exporte bleiben importierbar.

## Änderungen in 0.7.0

- Neues Finanz-Tool **„Fondsversicherung vs. Fondsdepot“** für den Vergleich eines Einmalerlags in eine fondsgebundene Lebensversicherung mit einer direkten Fondsveranlagung.
- Gemeinsame Fondsannahmen: Einmalbetrag, Laufzeit, angenommene Fondsrendite vor Fondskosten und Fondskosten p.a.
- Preset **„ERGO fürs Investment“** mit 30.000 € Mindest-Einmalprämie, 4 % Versicherungssteuer, 5 % Abschlusskosten der Nettoeinmalprämie verteilt auf fünf Jahre und 0,2 % Verwaltungskosten p.a.; Risikokosten bleiben vertragsabhängig editierbar.
- Preset **„ERGO fürs Leben – Einmalprämie“** mit 5.000 € Mindest-Einmalprämie und 100-%-Fondsvergleich; individuelle Abschluss-, Verwaltungs- und Risikokosten müssen aus dem konkreten Antrag übernommen werden.
- Direkte Fondsveranlagung berücksichtigt regulären Ausgabeaufschlag, Rabatt/Sonderkondition, prozentuelle und fixe Depotkosten sowie 27,5 % KESt.
- Zwei Steuerverfahren für das Fondsdepot: vereinfachte Endbesteuerung oder erweiterte Modellrechnung mit jährlich steuerwirksamem Ertrag als OeKB-basierter Annahme.
- Steuerliche Mindestanlagedauer der Lebensversicherung wird mit 15 Jahren bzw. 10 Jahren bei 50+-Voraussetzung berücksichtigt. Bei kürzerem Vergleichshorizont werden 7 % zusätzliche Versicherungssteuer und eine optional einzugebende Differenz-ESt modelliert.
- Ergebnis mit Nettoendwerten, Netto-Effektivrenditen, Kosten-/Steueraufschlüsselung, Vorteil in Euro und Break-even-Jahr sowie grafischem Verlauf der hypothetischen Nettoauszahlungswerte.
- JSON-Im-/Export und Zurücksetzen sind integriert. Die OeKB-Steuerdatenseite kann aus einer eingegebenen ISIN direkt geöffnet werden.
- `data/tools.json` enthält nun auch die bereits vorhandenen Finanztools sowie das neue Vergleichstool, damit das Dashboard die vollständige aktive Tool-Liste erhält.

## Änderungen in 0.6.13

- Neuer optionaler Import **„Bestands-/Kurs-CSV importieren“** in der Kursversorgung. Das Format kann den vollständigen Depotbestand mit ISIN, Menge/Nominale, Kursdatum, aktuellem Kurs und Kurswert enthalten.
- Mehrfach vorkommende Spaltenüberschrift `Einheit` wird positionsbezogen ausgewertet: die Einheit direkt zur `Menge` und die Einheit direkt zum `aktuellen Kurs` werden getrennt erkannt.
- Stücknotierte Positionen (`Menge = Stk`, Kurs z. B. in `EUR`) und nominal notierte Anleihen (`Menge = EUR`, Kurs in `%`) werden automatisch unterschieden.
- Jeder importierte Bank-Bewertungskurs wird lokal je ISIN und Kursdatum im bestehenden IndexedDB-Kurscache ergänzt. Vorhandene automatische Union-Investment-Quellen oder historische lokale Kursdateien werden dadurch nicht ersetzt.
- Die Bestands-CSV wird zusätzlich mit dem aus den importierten Kauf-/Verkaufsbuchungen errechneten Bestand abgeglichen. Mengenabweichungen, fehlende Buchungspositionen und Positionen ohne passenden Buchungsbestand werden sichtbar zusammengefasst.
- Bei einheitlicher Berichtswährung EUR kann der in der Bestands-CSV enthaltene Gesamt-Kurswert per Klick als End-/Depotwert übernommen werden; als Bewertungsdatum wird der jüngste enthaltene Kursstand verwendet.
- Einzelne Bestandskurse gelten nicht automatisch als vollständige historische Kursabdeckung. Für eine komplette historische Depotkurve bleibt je ISIN weiterhin eine ausreichende historische Kursquelle erforderlich.
- **Reine Fondsdepots funktionieren unverändert wie bisher.** Der neue Bestands-/Kurs-CSV-Import ist optional und führt weder neue Pflichtfelder noch einen anderen Berechnungsweg für bestehende Fondsberechnungen ein.

## Änderungen in 0.6.12

- Zahlungsstromtabelle ist über die Spaltenköpfe sortierbar. Unterstützt werden `Datum`, `Art`, `Betrag`, `Titel`, `ISIN`, `Menge / Nominale` und `Notiz`.
- Erster Klick auf eine andere Spalte sortiert aufsteigend; erneuter Klick auf dieselbe Spalte wechselt auf absteigend. Pfeile im Spaltenkopf zeigen die aktuelle Sortierrichtung.
- Die Sortierung betrifft ausschließlich die Darstellung und verändert weder Cashflow-Daten noch JSON-Export oder Berechnungslogik.
- Tastaturbedienung über `Enter` bzw. Leertaste auf den fokussierbaren Spaltenköpfen ist ebenfalls möglich.

## Änderungen in 0.6.11

- Historische Depotbewertung auf allgemeine Wertpapierlogik erweitert: Stücknotierte Wertpapiere werden mit `Menge × Kurs` bewertet; bei `Einheit = EUR` wird die Menge als Nominale interpretiert und mit `Nominale × Prozentkurs / 100` bewertet.
- Damit können neben Fonds/ETFs/Aktien auch nominal notierte Anleihen aus der CSV-Buchungshistorie verarbeitet werden. Beispieltest: `8.000 EUR` Nominale bleibt 8.000 und wird nicht als 8 interpretiert.
- CSV-Geschäftsarten `Ertrag`, `Dividende`, `Kupon` und `Ausschüttung` werden als positive Wertpapiererträge ohne Bestandsänderung erkannt. `Ausschüttungsgleich`/KESt/Steuer bleibt Steuer-Cashflow.
- Kaufspesenableitung aus `Rechenwert × Menge` wird nur noch für stücknotierte Wertpapiere durchgeführt; bei Anleihen würde diese Fonds-/Stücklogik fachlich falsche Ergebnisse liefern.
- Kursversorgung und historische Positionsdarstellung verwenden fachlich allgemeine Wertpapierbegriffe. Union Investment bleibt automatische Spezialquelle; andere Wertpapiere werden weiterhin über lokale Kursdateien versorgt.
- Lokale Kursdateien können für nominal notierte Wertpapiere Prozentkurse enthalten. Die Kursversorgungsanzeige kennzeichnet pro ISIN, ob ein Stückkurs oder ein Prozentkurs erwartet wird.
- IndexedDB-Kurscache wurde auf den allgemeinen Store `securities` umgestellt; ältere lokale Kurscache-Einträge werden bewusst nicht übernommen.

## Änderungen in 0.6.10

- Klassifizierung von Wertpapierverkäufen korrigiert: `Verkauf` wird jetzt vor `Kauf` geprüft; positive Verkaufserlöse bleiben positive Anlegerzuflüsse, Verkaufsmengen werden weiterhin negativ geführt.
- Ursprüngliches CSV-Format nutzt `Abrechnungsnummer` und optional `Ausführungsnummer` als interne Buchungsreferenzen für eine robustere Duplikatkontrolle. Unterschiedliche Abrechnungsnummern werden nicht allein wegen identischer Beträge/ISIN/Mengen zusammengelegt.
- Abrechnungs-/Ausführungsnummern werden nicht in der Zahlungsstromtabelle angezeigt, aber als technische Buchungsreferenzen im JSON-Export mitgespeichert. Dadurch bleibt die sichere Duplikatkontrolle auch nach einem späteren Datenimport erhalten. Die Depotnummer wird weiterhin nicht exportiert.
- Sparplan-Erkennung wertet `Kauf aus Dauerauftrag`, `Sparplan` und `Sparrate` als direkten Hinweis aus. Dadurch werden auch historische, bereits beendete Sparpläne erkannt und als `beendet` gekennzeichnet. Die bisherige Mustererkennung bleibt als Fallback erhalten.
- Zahlungsstromtabelle neu gewichtet: mehr Breite für `Titel`, weniger für `Betrag`, `ISIN` und `Menge`.

## Änderungen in 0.6.9

- Build-Fehler aus 0.6.8 behoben: Die Depotkennung für die CSV-Duplikaterkennung ist jetzt reine interne Import-Metadaten und kein enumerierbares Feld des Zahlungsstromobjekts.
- Bestehende Parser-Tests mit exaktem Objektvergleich bleiben dadurch kompatibel.
- Die Depotkennung bleibt während der laufenden Sitzung für die Abgrenzung ansonsten identischer Buchungen verschiedener Depots erhalten, wird aber weiterhin weder angezeigt noch in JSON exportiert.

## Änderungen in 0.6.8

- CSV-Mehrfachimport dedupliziert Buchungen jetzt einzeln statt Dateien nur anzuhängen. Dadurch werden sowohl eine komplett doppelt importierte CSV als auch einzelne Überschneidungen zwischen verschiedenen CSV-Zeiträumen ignoriert.
- Die Duplikaterkennung verwendet einen normalisierten Buchungsschlüssel aus den verfügbaren Transaktionsmerkmalen (u. a. Datum, Geschäftsart, Betrag, Titel, ISIN, Menge sowie Bewertungs-/Kursdaten), nicht nur Datum und Betrag.
- Falls die CSV eine Depotkennung enthält, wird sie nur während der laufenden Sitzung zur Abgrenzung ansonsten identischer Buchungen verschiedener Depots verwendet; sie wird weiterhin nicht angezeigt oder in JSON exportiert.
- Importstatus und Importübersicht weisen die Anzahl ignorierter Duplikate separat aus.
- Ein reiner Duplikatimport verändert die Zahlungsströme nicht und verwirft deshalb auch keine bereits berechneten Ergebnisse.

## Änderungen in 0.6.7

- JSON-Export robuster gemacht: Wenn `showSaveFilePicker()` vom Browser oder Plattformkontext nicht erlaubt wird, fällt der Export automatisch auf den normalen Browser-Download zurück.
- Ein bewusst abgebrochener Speichern-Dialog (`AbortError`) bleibt weiterhin ein Abbruch und startet keinen unerwünschten Download.

## Änderungen in 0.6.6

- JSON-Export korrigiert: optionale numerische CSV-Metadaten wie Ausführungskurs, Rechenwert, Menge und berechnete Kaufspesen bleiben bei fehlendem Wert `null` und werden nicht mehr fälschlich zu `0`.
- Die sichtbare CSV-Bezeichnung wurde konsequent auf „CSV“ vereinheitlicht.

## Änderungen in 0.6.5

- CSV-Import akzeptiert Datumswerte jetzt sowohl als `TT.MM.JJJJ` als auch als `JJJJ-MM-TT`.
- Damit werden insbesondere Originaldateien im Depot-Umsatz-Format mit ISO-Datum wie `2024-10-14` ohne vorheriges Öffnen/Speichern in Excel importiert.
- Die Datumswerte werden intern weiterhin einheitlich als `JJJJ-MM-TT` verarbeitet; echte ungültige Kalenderdaten bleiben Fehler.

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

### Fondsversicherung vs. Fondsdepot

- Vergleich desselben Fonds in fondsgebundener Lebensversicherung und direktem Fondsdepot.
- Einmalerlag, Laufzeit und Fondsrendite nach den auf Fondsebene anfallenden Kosten.
- ERGO-Presets sowie frei editierbare Versicherungsparameter.
- Abschlusskosten können über mehrere Jahre verteilt werden.
- Versicherungssteuer, Verwaltungskosten, Risikokosten und steuerliche Mindestanlagedauer.
- Ausgabeaufschlag mit Rabatt/Sonderkondition, Depotkosten und Fondsbesteuerung für die Direktanlage.
- Vereinfachter Steuervergleich oder erweiterte OeKB-basierte Steuerannahme.
- Nettoendwerte, Effektivrenditen, Break-even-Jahr, Detailkosten und Verlaufsgrafik.
- JSON-Im-/Export.

### Depotrendite & Vergleich

Der Rechner bildet ein Depot als datierte Zahlungsströme aus Sicht des Anlegers ab. Die Oberfläche verwendet ab v0.6.0 eine progressive Darstellung: Beim Einstieg werden nur Datenquelle und die unmittelbar nötigen Eingaben gezeigt; Importdetails, Kosten/Steuern, Zahlungsströme und Vergleiche werden erst bei Bedarf eingeblendet. Unterstützt werden unter anderem:

- Startinvestition,
- Zuzahlungen und Sparraten,
- Erträge, Ausschüttungen und Dividenden,
- KESt-/Steuerbelastungen,
- Depot- und sonstige Gebühren,
- Entnahmen,
- End-/Verkaufswert.

Die Depotrendite wird als datumsgenaue XIRR berechnet.

#### CSV-Import

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

Zusätzlich wird das Depot-Umsatz-Format mit `Stichtag`, `Depot`, `Titel`, `ISIN`, `Menge`, `Mengeneinheit`, `Ausführungskurs`, `Ausführungskurseinheit`, `Abrechnungsbetrag`, `Abrechnungsbetrag-einheit` und `Geschäftsart` erkannt. Die Spalte `Depot` wird aus Datenschutzgründen bewusst nicht in den Rechnerzustand übernommen.

#### Buchungsgenaue Wertpapierkaufspesen aus CSV

Für Kaufbuchungen mit `Stichtag`, `Rechenwert`, `Menge` und `Abrechnungsbetrag` werden die tatsächlichen Kaufspesen bzw. die Preisabweichung buchungsgenau abgeleitet:

`effektiver Preis je Anteil = |Abrechnungsbetrag| / |Menge|`

`Differenz je Anteil = effektiver Preis je Anteil - Rechenwert`

`Differenz gesamt = |Abrechnungsbetrag| - Rechenwert × |Menge|`

Die Toolbox fasst diese Werte je Wertpapier zusammen und zeigt Rechenwert gesamt, Anlegeraufwand, Differenz/Spesen und den gewichteten durchschnittlichen Prozentsatz an. CSV-Abrechnungsbeträge bleiben als tatsächliche Anleger-Cashflows unverändert.

Für manuell angelegte Start-/Einmalanlagen und manuell erzeugte Sparraten bleiben separate Kaufspesen-Einstellungen verfügbar.

#### Historische Depotwertentwicklung

Für Wertpapierbuchungen mit ISIN und Menge kann die historische Depotentwicklung aus einer Kursquelle je ISIN rekonstruiert werden. Union-Investment-Wertpapiere werden weiterhin automatisch über den Worker versorgt; für andere Wertpapiere kann eine historische Kursdatei lokal importiert werden. Stücknotierte Positionen verwenden Stückkurse; bei Einheit `EUR` wird die Menge als Nominale behandelt und ein Prozentkurs erwartet.

Darstellbar sind per Checkbox unter anderem:

- Depotwert,
- kumulierte Nettoinvestitionen,
- Gewinn / Verlust,
- historische Depotrendite,
- Positionsrenditen einzelner Wertpapiere,
- ausgewählte Benchmark-Wertentwicklungen,
- ausgewählte Benchmark-Renditen.

Positionsrenditen beginnen erst mit der ersten Kaufposition der jeweiligen ISIN. Fehlende Renditewerte werden nicht als 0-%-Linie dargestellt.

Für Bewertungstage ohne eigenen Kurs wird der letzte verfügbare Kurs der jeweiligen Quelle davor verwendet.

Sind bei allen erkannten Wertpapierbewegungen – ausdrücklich Käufen **und Verkäufen** – ISIN und Menge vollständig vorhanden, kann die Toolbox den Depotwert am Bewertungsdatum aus den hinterlegten historischen Kursquellen ermitteln. Nach einem CSV-Import wird diese Bewertung automatisch versucht; der manuelle Button **„Depotwert aus historischen Kursen ermitteln“** bleibt zusätzlich verfügbar. Unvollständige Wertpapierbewegungen verhindern bewusst eine Teilbewertung.

#### Kursversorgung je ISIN

Die historische Depotbewertung ist nicht mehr auf Union-Fonds beschränkt. Für jede ISIN wird der tatsächlich benötigte Haltezeitraum aus Kauf- und Verkaufsbewegungen ermittelt. Bereits vollständig verkaufte Positionen werden für ihre früheren Haltezeiträume weiterhin berücksichtigt.

Kursquellen:

- **Union Investment:** automatischer Abruf über den bestehenden Worker (Stück-/Rücknahmepreise),
- **andere Wertpapiere:** lokaler Import einer historischen CSV-Kursdatei.

Der Kursdatei-Import akzeptiert mindestens eine Datums- und eine Kurs-/Preis-Spalte. Für Anleihen mit Einheit `EUR` wird der Kurswert als Prozentkurs interpretiert (z. B. `98,50` = 98,50 % der Nominale). Unterstützt werden u. a. `Datum`, `Date`, `Stichtag` sowie `Kurs`, `Preis`, `Rücknahmepreis`, `NAV`, `Close`, `Schlusskurs` oder `Rechenwert`. Eine `ISIN`- und `Währung`-Spalte ist optional. Importierte Kursdaten werden ausschließlich in IndexedDB gespeichert und nicht an den Worker oder GitHub übertragen. Weitere Dateien können später zur Ergänzung fehlender Zeiträume eingelesen werden.

Die Toolbox gibt keine scheinbar vollständige Teilbewertung aus: Fehlt für auch nur eine gehaltene Position die Kursquelle oder der notwendige Zeitraum, wird die historische Depotbewertung abgebrochen und die fehlende ISIN in **Kursversorgung** ausgewiesen. Derzeit wird die gemeinsame Depotbewertung in EUR durchgeführt; explizit als andere Währung gekennzeichnete Kursreihen werden bis zur späteren FX-Anbindung nicht stillschweigend zusammengerechnet.

#### Historische Benchmarks

Verfügbar sind:

- österreichische täglich fällige Haushaltseinlagen,
- 3-Monats-Euribor,
- 6-Monats-Euribor,
- 12-Monats-Euribor.

Die ECB-Reihen werden über den Cloudflare-Worker geladen. Für fehlende Monate nach dem letzten offiziellen Datenpunkt kann der letzte verfügbare Zinssatz bis zum Vergleichsende fortgeführt werden; echte Lücken innerhalb der Datenreihe bleiben Fehler.

Die Benchmark-Auswahl wird lokal auf dem jeweiligen Gerät gespeichert und bleibt auch nach einem Reset oder erneuten Öffnen bis zur nächsten Änderung erhalten. Dasselbe gilt für die ausgewählten historischen Diagrammlinien sowie die PDF-Darstellungsoptionen.

Die Oberfläche enthält bereits eine getrennte Kategorie **Aktienmärkte** für Europa, USA, Asien/Pazifik und Global. Diese Marktbenchmarks sind noch nicht aktiv an eine Datenquelle angebunden. Eine öffentliche Datenreihe wird erst aktiviert, wenn ihre Weiterverwendung bzw. Weitergabe im öffentlichen GitHub-Tool eindeutig zulässig ist; Drittanbieter-Reihen werden nicht ungeprüft übernommen.

#### PDF und Datenexport

- Clientseitige PDF-Erzeugung, auch für iPhone/iPad.
- Wahlweise Zusammenfassung oder einzelne Zahlungsströme.
- Historische Diagramme optional im PDF.
- Vollständiger JSON-Import/-Export des Rechnerzustands.
- Aktuelles JSON-Schema: **v5**; ältere unterstützte Schema-Versionen bleiben importierbar.

## Bedienkonzept der Depotrendite

Ab v0.6.0 ist die Depotrendite nach dem Prinzip der progressiven Offenlegung aufgebaut:

1. **Datenquelle wählen:** CSV, manuelle Erfassung oder vorhandene JSON-Datei.
2. **Import kompakt zusammenfassen:** Anzahl CSV-Dateien, Buchungen, Fonds und Zeitraum erscheinen dezent; Detailinformationen sind ausklappbar.
3. **Bewertung:** Depotstart wird kompakt angezeigt, das Bewertungsdatum ist standardmäßig heute. Bei vollständigen ISIN-/Mengenangaben aller Käufe und Verkäufe wird der historische Depotwert automatisch ermittelt.
4. **Weitere Eingaben nach Bedarf:** Depotstart, Zahlungsströme, Kosten & Steuern sowie Benchmarks liegen in getrennten ausklappbaren Themenbereichen.
5. **Ergebnisse in Registern:** `Übersicht`, `Entwicklung`, `Vergleich` und `Details` trennen Kennzahlen, historische Diagramme, Benchmarks und technische Berechnungsinformationen.

Die Farblogik unterstützt die Trennung der Themen: Petrol/Blau steht für das eigene Depot, Gold/Orange für Benchmarks, Violett/Grau für einzelne Wertpapiere, Gelb für Hinweise und Rot für Fehler. Ein zusätzlicher Basic-/Advanced-Modus ist bewusst nicht vorgesehen; die Seite zeigt relevante Funktionen automatisch im jeweiligen Arbeitsschritt.

## Daten- und Cache-Architektur

### Historische Wertpapierkurse

Für Union-Investment-Fonds verwendet die automatische Preisabfrage den Cloudflare-Worker-Endpunkt:

`/union-prices?isin=<ISIN>&start=YYYY-MM-DD&end=YYYY-MM-DD`

Datenweg:

```text
Union Investment API                 lokale Kursdatei
        ↓                                  ↓
Cloudflare Worker                      Browser
        ↓                                  ↓
Cloudflare KV je ISIN ─────────────→ IndexedDB je ISIN
                                           ↓
                               Depotberechnung und Diagramme
```

- Der Union-API-Key liegt ausschließlich als Cloudflare-Secret `UNION_API_KEY` im Worker.
- Das KV-Binding heißt `UNION_PRICE_KV`.
- Historische Kursreihen werden serverseitig zwischengespeichert.
- Im Browser werden bereits geladene Kursbereiche zusätzlich in IndexedDB gespeichert.
- Die Seite fordert für Union-Fonds nur lokal fehlende Haltezeiträume beim Worker an.
- Für andere Wertpapiere werden importierte Kursdateien lokal je ISIN gespeichert und bei Bedarf um weitere Zeiträume ergänzt.
- Auch bereits verkaufte Positionen bleiben für ihre historischen Haltezeiträume bewertbar.

### Weitere Worker-Endpunkte

- `/bundesschatz`
- `/savings-rates?start=YYYY-MM&end=YYYY-MM`
- `/euribor-3m?start=YYYY-MM&end=YYYY-MM`
- `/euribor-6m?start=YYYY-MM&end=YYYY-MM`
- `/euribor-12m?start=YYYY-MM&end=YYYY-MM`
- `/union-prices?isin=ISIN&start=YYYY-MM-DD&end=YYYY-MM-DD`

## Datenschutz

Berechnungsdaten und Depotbezeichnungen werden lokal im Browser verarbeitet. Beim Abruf historischer Union-Preise werden nur ISIN und benötigter Haltezeitraum an den Worker übertragen; Beträge, Mengen, Titel und Depotbezeichnungen werden nicht an Union übertragen. Manuell importierte Kursdateien werden ausschließlich lokal verarbeitet und nicht hochgeladen.

JSON-Import und -Export erfolgen lokal. Historische Kursdaten werden lokal in IndexedDB zwischengespeichert; der Worker kann dieselben öffentlichen Preisreihen zusätzlich in Cloudflare KV cachen.

## Repository-Struktur

```text
toolbox/
├─ .github/
│  └─ workflows/
├─ data/
│  ├─ tools.json
│  └─ ergo_union_funds.json
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

`data/tools.json` ist die kanonische Tool-Liste. `data/ergo_union_funds.json` ist die kanonische ERGO-/Union-Fondspalette. Die entsprechenden Dateien unter `docs/data/` sind ausschließlich öffentliche Spiegel und werden zentral mit `tools/sync_public_data.py` erzeugt.

Der GitHub-Pages-Workflow synchronisiert die öffentlichen Daten, validiert die Projektstruktur, führt die Tests aus und veröffentlicht anschließend `docs/`. Der manuelle Workflow **Update ERGO fund palette** verwendet dieselbe Synchronisierung und prüft anschließend mit `--check`, dass kanonische Datei und Pages-Spiegel byte-identisch sind.

## Versionierung

Für die Toolbox gilt:

1. `VERSION` enthält die kanonische Projektversion.
2. `SITE_VERSION` in `docs/js/site-map.js` muss exakt identisch sein.
3. Der Cloudflare-Worker besitzt eine eigene, unabhängige Versionsnummer.
4. Versionsinformationen werden nicht zusätzlich in einzelnen HTML-Seiten gepflegt.
5. Der Änderungsverlauf steht ausschließlich im folgenden Changelog.

## Changelog

### 0.6.10

- Verkauf/Kauf-Klassifizierung korrigiert, CSV-Buchungsnummern in die Duplikatlogik aufgenommen und für spätere Wiederimporte im JSON erhalten, historische Sparplan-Erkennung erweitert und Zahlungsstromtabelle neu gewichtet.

### 0.6.4

- ES-Module der Depotrendite-Seite werden mit einer Versionskennung geladen, damit Browser- bzw. GitHub-Pages-Caches nicht unterschiedliche Dateistände mischen.
- `fund-return.js` lädt `fund-return-utils.js` und `site-map.js` explizit mit `?v=0.6.4`; auch das Einstiegsmodul in `fund_return.html` ist versioniert.
- Der CSV-Datumsparser selbst wurde nicht geändert: Das Depot-Umsatz-Demodatum `12.08.2026` wurde mit dem v0.6.2-Parser erneut erfolgreich getestet.

### 0.6.3

- CSV-Import zeigt bereits während des Einlesens einen sichtbaren Status im Einstiegsbereich.
- Importfehler werden dort ebenfalls sichtbar angezeigt; Fehler vor dem Öffnen des Arbeitsbereichs wirken dadurch nicht mehr wie ein funktionsloser Import.
- Das hochgeladene Windows-1252-Demoformat mit `Stichtag`, `Mengeneinheit`, `Ausführungskurs` und `Geschäftsart` wurde direkt gegen den Parser getestet.

### 0.6.2

- Zweites Depot-Umsatz-CSV-Format ergänzt; `Stichtag` dient ohne `Abrechnungsdatum` als Transaktionsdatum.
- `Ausführungskurs`, Kurs-/Abrechnungswährung und `Mengeneinheit` werden übernommen.
- Die CSV-Spalte `Depot` wird aus Datenschutzgründen weder in Rechnerzustand noch JSON-Export übernommen.
- JSON-Schema auf v6 erweitert; ältere unterstützte Exporte bleiben importierbar.

### 0.6.1

- Historische Depotbewertung auf ein allgemeines Kursquellen-System je ISIN erweitert.
- Union Investment bleibt automatische Kursquelle; andere Wertpapiere können über lokale historische CSV-Kursdateien versorgt werden.
- Neuer ausklappbarer Bereich **Kursversorgung** zeigt je Wertpapier Titel, ISIN, benötigten Haltezeitraum und verwendete bzw. fehlende Kursquelle.
- Haltezeiträume werden aus sämtlichen Käufen und Verkäufen abgeleitet; vollständig verkaufte und später erneut gekaufte Positionen erzeugen getrennte benötigte Kurszeiträume.
- Fehlende Kursquellen oder Kurszeiträume verhindern bewusst eine unvollständige historische Depotkurve.
- Lokale Kursdateien werden je ISIN in IndexedDB gespeichert und können durch weitere Dateien ergänzt werden.
- Generischer Kursdatei-Import unterstützt mehrere gebräuchliche Datums-/Kurs-Spalten sowie optional ISIN und Währung.
- Depotbewertung mit expliziten Nicht-EUR-Kursreihen wird bis zur späteren Währungsumrechnung blockiert statt nominal zusammengerechnet.
- Toolbox-Version auf 0.6.1 angehoben; Cloudflare-Datenworker bleibt unverändert auf 0.5.6.

### 0.6.0

- Depotrendite-Oberfläche grundlegend auf progressive Darstellung umgestellt: Einstieg zunächst nur über CSV, manuelle Erfassung oder JSON-Import.
- Importzusammenfassung kompakt und ausklappbar gestaltet; nach Wahl einer Datenquelle verschwindet die große Einstiegsbox.
- Bewertung als primärer Arbeitsbereich hervorgehoben; Depotstart wird kompakt angezeigt und kann gezielt aufgeklappt werden.
- Automatische historische Depotbewertung nach CSV-Import nur dann, wenn **alle** erkannten Kauf- und Verkaufsbewegungen vollständige ISIN- und Mengenangaben besitzen; Teilbewertungen werden verhindert.
- Zahlungsströme, Kosten & Steuern sowie Benchmarks in getrennte ausklappbare Themenbereiche verschoben.
- Benchmark-Auswahl, historische Diagrammlinien sowie PDF-Darstellungsoptionen werden gerätebezogen in `localStorage` gespeichert und durch „Zurücksetzen“ nicht gelöscht.
- Ergebnisse in die Register **Übersicht**, **Entwicklung**, **Vergleich** und **Details** gegliedert.
- Farbige Themenlogik geschärft: Depot in Petrol/Blau, Benchmarks in Gold/Orange, Einzeltitel in Violett/Grau sowie neutrale Eingabebereiche.
- Aktienmarkt-Benchmarkgruppe für Europa, USA, Asien/Pazifik und Global strukturell vorbereitet; noch keine Datenquelle aktiviert, solange die öffentliche Weiterverwendung nicht eindeutig geklärt ist.
- Toolbox-Version auf 0.6.0 angehoben; Cloudflare-Datenworker bleibt unverändert auf 0.5.6.

### 0.5.11

- PDF-Berechnungsdetails für Depots mit 0-Euro-Start logisch neu gegliedert.
- Statt ausschließlich startbezogener Nullwerte zeigt der Bericht nun Depotstart, Zuzahlungen/Käufe gesamt, erkannte Daueraufträge/Sparraten, übrige bzw. Einmalkäufe, Ausschüttungen/Entnahmen, Gebühren/Steuern, Netto-Anlegeraufwand vor Endwert und End-/Verkaufswert.
- Startbezogene Nettoanlage und Kaufspesen werden nur noch ausgewiesen, wenn tatsächlich eine Start-/Einmalanlage über das Startfeld vorhanden ist.

### 0.5.10

- Hotfix für historische Benchmark-Diagramme: die bereits geladenen Benchmark-API-Daten werden im gerenderten Benchmark-Ergebnis weitergereicht, sodass `observations` für die historische Wert- und Renditelinie verfügbar bleiben.
- Fehler `Cannot read properties of undefined (reading 'observations')` behoben.

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
