# iPlan icon

Concept: a lowercase "i" drawn as a route. The ring is the starting station, the line turns toward the destination dot: plan → go.

Primary: dark (`icon.svg`). Alternatives in `variants/`.

| File                                     | Use                                          |
| ---------------------------------------- | -------------------------------------------- |
| icon.svg                                 | Source, full-bleed square                    |
| favicon.svg, favicon.ico, favicon-32.png | Browser tab                                  |
| apple-touch-icon.png (180)               | iPhone home screen                           |
| icon-192.png, icon-512.png               | PWA manifest                                 |
| icon-maskable-512.png                    | PWA maskable (glyph is inside the safe zone) |
| icon-1024.png                            | App store / marketing                        |

Next.js: put `favicon.ico`, `icon.svg`, `apple-touch-icon.png` in `apps/web/src/app/` (file-based metadata), the rest in `apps/web/public/icons/`.

Colors: background #12161C, accent #22C46A, line #FFFFFF.
