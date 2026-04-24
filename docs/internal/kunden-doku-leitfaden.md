# Leitfaden für Kundendokumentation

Ziel: Inhalte so schreiben, dass intelligente, nicht‑technische Leser sie sicher anwenden können – ohne belehrt zu werden.

## Zielgruppe und Fokus

- Zielgruppe sind Redakteure und Entscheider ohne Technik‑Hintergrund.
- Fokus ist sichere Anwendung und Verständnis, nicht technische Vollständigkeit.

## Ton und Haltung

- Respektvoll und auf Augenhöhe schreiben.
- Keine vereinfachenden Labels (z. B. „einfach erklärt“, „kinderleicht“).
- Ruhig, sachlich, klar. Keine Marketing‑Floskeln.

## Was wir vermeiden

- Technische Implementationsdetails (Scripts, interne Pfade, Build‑Prozesse).
- ARIA‑Details, JS‑Hinweise oder Framework‑Begriffe, außer sie sind zwingend nötig.
- Tabellen (Dokumentation muss in Roh‑Markdown und PDF gut lesbar sein).
- Abschnittsüberschriften wie „Umsetzung“, „Verhalten“ oder „Verantwortung“, wenn sie nur Technik beschreiben.
- Interne Ordnerpfade, wenn der Nutzer nur den sichtbaren Ordnernamen braucht.

## Struktur pro Modul (empfohlen)

1) **Zweck**  
   Ein bis zwei Sätze: Was bringt das Modul dem Leser?

2) **Wann einsetzen**  
   Ein kurzer Satz: „Nutzen, wenn …“.

3) **Inhalte vorbereiten**  
   Falls Frontmatter nötig ist: kurz erklären, dass es der Block zwischen `---` ist, und die Felder nennen.

4) **Verwendung (Minimal‑Beispiel)**  
   Kürzestes Beispiel, das direkt kopiert werden kann.

5) **Optionen (nur relevante)**  
   Optionen als Liste, ohne Tabellen.  
   Je Option: Name – wofür, wann nutzen, was passiert ohne Angabe.

6) **Beispiele (realistisch)**  
   Ein Beispiel pro Kernfunktion. Keine Platzhalter wie „Lorem“.

7) **Stolperstellen**  
   Kurze Hinweise zu typischen Fehlern und deren Lösung.

## Begriffe sauber definieren

- Feldnamen exakt so schreiben, wie sie in der Datei stehen (`summary`, `author`).
- Wenn ein Begriff ein Frontmatter‑Feld meint, das ausdrücklich sagen.
- Begriffe wie „Filter“, „Featured“, „Template“ in einem Satz erklären.
- Syntaxzeichen (`:::`, `---`, `#`) immer einmal kurz erklären und im Beispiel zeigen.
- Wenn ein Zeichen allein in einer Zeile stehen muss (z. B. `---`), das ausdrücklich erwähnen.

## Beispiele

- Beispiele klein, vollständig und direkt übernehmbar.
- Konkrete, reale Begriffe verwenden.
- Zeigen, wie der Leser es in seine Datei schreibt.

## Fehler und Grenzen

- Nur nutzerrelevante Fehler nennen.
- Fehler so formulieren, dass der Leser sie selbst beheben kann.
- Strukturregeln (z. B. notwendige Überschriften oder Trenner) als Stolperstellen klar benennen.
- Bei `:::`-Modulen immer erwähnen: Nach Listen (`-`, `1.`) und Zitaten (`>`) braucht es vor dem nächsten Modul eine Leerzeile.

## Format

- Keine Tabellen.
- Kurze Absätze, klare Überschriften.
- Listen nutzen, wenn es mehrere Punkte gibt.
- Code‑Beispiele in eigenen Blöcken.
