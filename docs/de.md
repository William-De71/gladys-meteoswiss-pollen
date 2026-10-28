# MeteoSwiss Pollen

## Überblick

Diese Integration bringt die **stündlich von MeteoSchweiz gemessenen Pollen** nach Gladys. MeteoSchweiz ist das Bundesamt für Meteorologie und Klimatologie, und die Integration folgt ein bis drei Stationen seines nationalen Pollenmessnetzes. Für **Hasel**, **Erle**, **Esche**, **Birke**, **Buche**, **Eiche** und **Gräser** erhalten Sie die Pollenzahl der letzten Stunde (Pollen pro m³ Luft) und eine Belastungsstufe von keine bis sehr stark. Jede Station wird zu einem Gerät für das Dashboard und für Szenen.

Die 15 Stationen mit Echtzeitwerten: Basel, Bern, Buchs SG, Davos, Genève, La Chaux-de-Fonds, Lausanne, Locarno, Lugano, Luzern, Münsterlingen, Neuchâtel, Payerne, Sion und Zürich. Es sind **Messwerte, keine Prognose**. Ambrosia, Beifuss und Wegerich veröffentlicht MeteoSchweiz nicht in Echtzeit; sie sind daher nicht verfügbar.

Die Daten sind **offene Behördendaten** von MeteoSchweiz: Weder Konto noch Schlüssel sind nötig. Quelle: MeteoSchweiz. Diese Community-Integration ist nicht mit MeteoSchweiz verbunden.

Es ist eine **Cloud**-Integration: Sie liest die Dateien jeder Station alle 20 Minuten von `data.geo.admin.ch`. Sie stellt bedingte Anfragen, sodass eine unveränderte Datei fast nichts kostet. Die letzten 48 Stunden bleiben in `/data` gespeichert, sodass bei einem Neustart nichts verloren geht.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang von Gladys aus.

## Konfiguration

| Feld                 | Was wählen                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- |
| Station 1            | Die Pollenstation, die Ihrem Zuhause am nächsten liegt, unter den 15. Pflichtfeld. |
| Station 2, Station 3 | Weitere Stationen (Zweitwohnsitz, Arbeitsort). Optional.                           |
| Sprache der Texte    | Gerätenamen, Hauptpollen und Szenentexte. Automatisch: Ihr Dashboard.              |

Speichern Sie: Der Status oben auf der Seite zeigt jede Station, ihre aktuelle Belastung und die Uhrzeit der nächsten Abfrage. **Jetzt lesen** liest sofort neu (bei frischen Daten nicht innerhalb von zwei Minuten erneut). **Diagnose** schreibt den Zustand der Integration in den Tab Protokolle.

## Verwendung

### Geräte

Erstellen Sie im Tab **Entdecken** das Gerät „Pollen …“ jeder Station. Es hat 16 Funktionen:

- die aktuelle **Pollenbelastung** von 0 bis 4: die höchste der sieben Pollenarten;
- für jede Pollenart die **Zahl der letzten Stunde**, in Pollen pro m³;
- für jede Pollenart ihre **Belastung**, berechnet aus dem Mittel der letzten 24 Stunden;
- den **Hauptpollen** als Text, zum Beispiel „Birke: stark (120/m³)“.

Die Stufen folgen den Belastungsklassen von MeteoSchweiz: 0 keine, 1 schwach, 2 mäßig, 3 stark, 4 sehr stark. MeteoSchweiz definiert sie für das Tagesmittel. Die Integration wendet sie auf das Mittel der letzten 24 Stunden an (mindestens 18 gemessene Stunden), sodass die Stufe den Messungen im Tagesverlauf folgt.

| Pollen (Pollen/m³) | Schwach | Mäßig  | Stark   | Sehr stark |
| ------------------ | ------- | ------ | ------- | ---------- |
| Hasel, Erle        | 1–10    | 11–69  | 70–249  | ≥ 250      |
| Esche              | 1–10    | 11–99  | 100–349 | ≥ 350      |
| Birke              | 1–10    | 11–69  | 70–299  | ≥ 300      |
| Buche, Eiche       | 1–49    | 50–129 | 130–399 | ≥ 400      |
| Gräser             | 1–19    | 20–49  | 50–149  | ≥ 150      |

Gladys hat keine Einheit für Pollen: Zahlen und Stufen werden ohne Einheit angezeigt. Die Zeiten von MeteoSchweiz sind in UTC und markieren das Ende der gemessenen Stunde.

### Dashboard-Widgets

![Das Widget Pollenstation mit den sieben Pollenarten einer Station und das Diagramm Pollen, letzte 48 h (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-meteoswiss-pollen/main/docs/assets/widgets.de.png)

- **Pollenstation**: die sieben Pollenarten, jede mit ihrer Belastung als Abzeichen und ihrer Zahl über die letzte Stunde und 24 Stunden. Darunter stehen die Gesamtbelastung, der Hauptpollen, die Messzeit und die Quelle.
- **Pollen, letzte 48 h**: ein Diagramm der stündlichen Zahlen der letzten 48 Stunden für die vier Pollenarten mit dem höchsten Spitzenwert. Ausserhalb der Saison sagt ein Text, dass keine Pollen gemessen wurden.

Wählen Sie die Station in den Einstellungen des Widgets (leer: die erste).

### Szenen

Der Auslöser **MeteoSchweiz: Pollenwarnung** löst aus, wenn eine Pollenart an einer Station „Mäßig“ oder mehr erreicht oder am selben Tag weiter steigt. Er löst höchstens einmal pro Stufe, Station, Pollenart und Tag aus. Die erste Abfrage einer Station dient als Referenz und löst nichts aus. Sie können nach Station, Pollenart und Stufe filtern („Stark“ und „Sehr stark“ für die meisten Allergiker). Er liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte: Pollenart, Stufe, 24-Stunden-Mittel, letzte Stunde und Messzeit.

Die Aktion **MeteoSchweiz: Pollen lesen** liefert die Belastung, den Hauptpollen, eine Zusammenfassung sowie Zahl und Stufe jeder Pollenart einer Station. Sie können sie in eine Nachricht einsetzen oder in einer Bedingung prüfen.

Beispiele:

- Wenn die Birke in Bern stark ist → `{{triggerEvent.data.summary}}` senden und die Lüftung der Schlafzimmer ausschalten.
- Jeden Morgen um 7 Uhr → die Pollen lesen und die Zusammenfassung mit dem Wetter senden.
- Wenn die Gräser sehr stark sind → daran erinnern, vor dem Gehen die Fenster zu schliessen.

### Transport

Nur Cloud: Die Daten kommen von `data.geo.admin.ch`, der Plattform für offene Daten des Bundes. Nur die Anfragen nach den Stationsdateien verlassen Ihr Netzwerk. Über Ihr Zuhause wird nichts gesendet.

## Fehlerbehebung

- **„ohne neue Messung“**: Die Station hat seit sechs Stunden nichts veröffentlicht (Wartung, Gerätestörung). Ihre Werte werden erst wieder aktualisiert, wenn sie zurück ist.
- **Die Messzeit liegt ein bis zwei Stunden zurück**: Der Server des Bundes kann die Dateien bis zu zwei Stunden zwischenspeichern. Das ist normal.
- **Alle Stufen bleiben bei 0**: Ausserhalb der Pollensaison (etwa Oktober bis Januar) ist das normal.
- **„MeteoSchweiz ist nicht erreichbar“** oder **„lehnt die Anfragen ab“**: Die Integration versucht es nach 5, 10, 20 und 40 Minuten erneut und kehrt dann zu ihrem üblichen Takt zurück.
- **Ein Problem melden**: Drücken Sie **Diagnose** und kopieren Sie die Zeilen, die mit „Pollen diagnostic“ beginnen, aus dem Tab Protokolle. Fügen Sie sie in ein GitHub-Issue oder eine Antwort im Forum ein, mit den Versionen von Gladys und der Integration.
