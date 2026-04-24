# Menü-Pflege (manuell)

Ziel: Das Menü wird zentral über eine feste Markdown-Vorlage gepflegt, damit große Seitenmengen kontrollierbar bleiben.

## Dateien
-	Standard: `navigation/menu.md`
-	Englisch: `navigation/en/menu.md`

## Sprachlogik
-	Beginnt der Seitenpfad (nach Abzug des Basepfads) mit `/en/`, wird zuerst `navigation/en/menu.md` geladen.
-	Falls diese Datei fehlt, wird `navigation/menu.md` als Fallback genutzt.
-	Fehlen beide Dateien, bricht der Build mit einer klaren Fehlermeldung ab.

## Strukturregeln
-	`#` ist Pflicht und bildet die oberste Navigation.
-	`##` und `###` sind erlaubt.
-	`####` oder tiefer ist nicht erlaubt.
-	Ein visueller Trenner zwischen Top-Level-Menüpunkten wird mit einer eigenen Zeile `---` gesetzt.
-	`---` innerhalb freier Inhalte (z. B. in `:::split`) bleibt normaler Inhaltsbestandteil und ist kein Menü-Trenner.
-	Trenner dürfen nicht am Anfang/Ende stehen und nicht direkt hintereinander.
-	Hinweis: Eine zweite Unterebene (`###`) kann schnell unübersichtlich werden. Nur einsetzen, wenn es fachlich zwingend nötig ist.

## Sonderabschnitt `advertise`
-	Pro Top-Level-Menüpunkt ist optional genau ein Sonderabschnitt `## advertise` erlaubt.
-	`advertise` ist nur direkt unter einem `#`-Menüpunkt erlaubt, nicht in tieferen Ebenen.
-	Die `advertise`-Überschrift darf kein Link sein.
-	`advertise` ist ein zusätzlicher Inhaltsbereich, z. B. für Hinweise oder Kampagnen.
-	Freier Markdown-/Modulinhalt ist auch in normalen Unterabschnitten möglich, wenn dort keine Linkliste verwendet wird.

## Listen und Links
-	Nach einer Überschrift kann eine ungeordnete Liste (`- ...`) folgen.
-	Jeder Listeneintrag muss ein Markdown-Link sein: `- [Text](/ziel)`.
-	Nach einer Liste ist optional genau ein Abschlussbutton als Modul erlaubt: `:::link to="/ziel" text="Alle anzeigen"`.
-	Mehr als ein Zusatzbutton pro Abschnitt ist nicht erlaubt.
-	Der Abschlussbutton muss als eigene, nicht eingerückte Zeile auf derselben Ebene wie die Liste stehen.

## Freie Inhalte statt Linkliste
-	Wenn ein Abschnitt keine Linkliste braucht, können stattdessen freie Inhalte genutzt werden (z. B. `:::highlight-card`).
-	Freie Inhalte und Linkliste dürfen nicht im selben Abschnitt gemischt werden.
-	`:::link` innerhalb solcher freien Inhalte bleibt erlaubt und wird dort normal als Inhalt behandelt.
-	Schließende Modulzeilen `:::` stehen immer allein in einer eigenen Zeile (Einrückung ist erlaubt).

## Wichtige Stolperstelle: Einrückung bei Listen
-	Markdown hat kein eigenes Listen-Ende. Eine Liste läuft weiter, sobald die nächste Zeile noch als Listenkontext lesbar ist.
-	Eingerückte Zeilen nach einer Liste werden deshalb oft weiterhin als Teil der Liste interpretiert.
-	Wenn ein Abschlussbutton nach einer Liste folgen soll, setzen Sie immer eine Leerzeile davor.
-	Falls Ihr Editor automatisch einrückt, prüfen Sie den Abschnitt nach dem Speichern kurz im Vorschaufenster.

## Überschriften als Link oder ohne Link
-	Hat eine Überschrift Unterpunkte (Liste oder Unterüberschriften), darf die Überschrift **kein** Link sein.
-	Hat eine Überschrift **keine** Unterpunkte, muss die Überschrift selbst ein Link sein: `# [Kontakt](/kontakt)`.

## Gewichtung einzelner Menüpunkte
-	Normale Schreibweise: `# Kompetenzen` oder `# [Kontakt](/kontakt)`.
-	Stärker hervorheben: Markdown **Fett** (`# **Kompetenzen**` oder `# [**Kontakt**](/kontakt)`).
-	Weniger prominent: Markdown *kursiv* (`# [*Über uns*](/ueberuns)`).
-	Die Darstellung wird rein per CSS gesteuert; die Markdown-Notation liefert nur den semantischen Hinweis.

## Aktuelle Seite
-	Die aktuelle Seite wird ausschließlich über die Breadcrumbs gekennzeichnet.
-	Im Hauptmenü gibt es keine automatische "Aktuelle Seite"-Markierung.
-	Die blaue Hinterlegung (Pill) wird nur für aktiv geöffnete Dropdown-Trigger verwendet.

## Link-Prüfung
-	Interne Links (beginnend mit `/`) werden beim Build auf Existenz geprüft.
-	Falsche interne Links führen sofort zu einem Build-Fehler.
-	Externe Links mit `https://`, `mailto:`, `tel:` sind erlaubt.
-	Relative Links wie `./kontakt` oder `../kontakt` sind im Menü nicht erlaubt.

## Mobile-Verhalten
-	Unterhalb des Desktop-Breakpoints wird das Menü als Burger-Menü dargestellt.
-	Top-Level-Einträge mit Untermenü öffnen auf Mobile nicht als Accordion.
-	Stattdessen wechselt die Ansicht in ein einzelnes Untermenü (iOS-ähnlich) mit Arrow-Back-Button und Titel des aktuell geöffneten Menüs.
-	Im Untermenü können Top-Level-Sektionen (z. B. `## Branchen`) erneut als eigene Ebene geöffnet werden; dabei ist nur die aktive Ebene sichtbar.
-	In Untermenü-Ansichten bleibt der Header beim Scrollen stabil am oberen Rand; Titel und Highlight-Strich bleiben dadurch konstant sichtbar.
-	Der Rücksprung nutzt das globale Utility `ui-arrow-button` (wiederverwendbar für weitere Module).
-	In Mobile ist pro Ansicht nur ein vertikaler Scroll-Container aktiv (kein doppelter Scrollbereich im selben Menüzustand).

## Desktop-Verhalten
-	Beim Öffnen eines Top-Level-Dropdowns wird ein eventuell zuvor geöffnetes Dropdown geschlossen.
-	Dropdown-Inhalte sind vertikal scrollbar, wenn der verfügbare Platz nicht ausreicht.
-	Der Inhaltsbereich basiert auf Flex-Wrap: Menüblöcke und optionales `advertise` teilen sich denselben Parent und umbrechen bei Platzmangel sauber.
-	Bis zum Mobile-Breakpoint darf kein horizontaler Scrollbalken im Menüpanel entstehen.

## Einbindung
-	`src/components/ManualMenu.astro` rendert das Menü.
-	Das Layout `src/layouts/primary.astro` bindet die Komponente global ein.
-	Branding (Text oder Bildlogo) wird zentral in `site.config.yml` unter `menu.brand` gepflegt.
