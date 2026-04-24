# Browser Rendering Check

## Zweck

Schnelle visuelle Kontrolle des echten Chromium-Renderings nach Implementierungsänderungen.

## Voraussetzungen

-	`npm i` wurde ausgeführt.
-	Einmalig Browser installieren:
	`PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright npx playwright install chromium`
-	Bei Linux ggf. System-Abhängigkeiten mitinstallieren:
	`PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright npx playwright install --with-deps chromium`

## Standard-Aufrufe

-	Ein Screenshot der Startseite (Desktop-Preset):
	`npm run render:shot`
-	Vergleich Desktop + Surface-Preset:
	`npm run render:compare`
-	Wave-Matrix fuer mehrere Device-Szenarien (inkl. Ultra-Wide):
	`npm run render:wave-matrix -- --route / --selector ".background-wave-module"`
-	Bestimmte Route:
	`npm run render:shot -- --route /`
-	Relevanten Ausschnitt + Umfeld rendern (präziser bei UI-Fixes):
	`npm run render:shot -- --route / --selector ".highlight-card-module" --selector-pad 80`
-	Ohne erneuten Build:
	`npm run render:shot -- --no-build`
-	Mit aktivem Splash-Screen (nur für Splash-Tests):
	`npm run render:shot -- --show-splash`

## Splash-Handling

-	Standardmäßig unterdrückt das Tool Splash-Overlays automatisiert (DOM + `localStorage`), damit Seitenlayout getestet wird statt Intro-Overlay.
-	Für gezielte Splash-Prüfung `--show-splash` nutzen.

## Ausgabe

-	Screenshots liegen unter `tmp/browser-shots/`.
-	Die Kommandos geben absolute Dateipfade der erzeugten PNGs aus.
-	Mit `--selector` wird automatisch nur der Zielbereich plus `--selector-pad`-Umfeld gespeichert (token-effizienter als Full-Page-Shots).
