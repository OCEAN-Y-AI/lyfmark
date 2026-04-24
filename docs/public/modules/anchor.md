# Modul `anchor`

## Zweck

Erzeugt ein zusaetzliches Sprungziel auf der Seite, das Sie direkt verlinken koennen.

## Wann einsetzen

Nutzen, wenn Sie einen stabilen Anchor-Link brauchen, der auch bei spaeteren Textaenderungen bestehen bleiben soll.

## Verwendung (Minimal-Beispiel)

```md
:::anchor name="uebersicht"
```

## Optionen

- `name` – Pflicht. Freitext fuer das Sprungziel. Daraus wird automatisch eine gueltige Anchor-ID erzeugt.

## Wichtiger Hinweis zu Ueberschriften

Ueberschriften sind bereits automatisch anspringbar.

Beispiel:

```md
## Leistungen
```

Link darauf:

```md
[Zu Leistungen](/angebot#leistungen)
```

Bei sehr langen oder komplex formatierten Ueberschriften (z. B. mit `<br>` oder viel Sonderzeichen) kann die automatisch erzeugte Anchor-ID schwer vorherzusagen sein.  
In solchen Faellen ist `:::anchor` die robustere Wahl.

## Beispiel mit stabilem Sprungziel

```md
:::anchor name="preise-und-leistungen"

## Preise & Leistungen

[Direkt zu Preisen](/angebot#preise-und-leistungen)
```

## Stolperstellen

- Das Modul steht alleine in der Zeile und benoetigt kein schliessendes `:::`.
- Der gleiche `name` darf auf derselben Seite nur einmal vorkommen. Doppelte Anchor-IDs brechen den Build mit klarer Meldung ab.
