# Marco FIRE Tools

Raccolta di calcolatori web gratuiti per la finanza personale italiana, compagni dei video YouTube del canale [Marco FIRE](https://www.youtube.com/@marcofire-it).

🌐 **Live**: https://marcofire-it.github.io/marco-fire-tools/

## Tool disponibili

| Tool | Path | Stato | Video correlato |
|---|---|---|---|
| BTP Italia Sì Compare | [`/btp-si-compare/`](https://marcofire-it.github.io/marco-fire-tools/btp-si-compare/) | ✅ live | Emissione 15-19 giu 2026 |
| FIRE Calculator | `/fire-calc/` | 🔄 in arrivo | — |
| PIC vs PAC | `/pic-vs-pac/` | 🔄 in arrivo | — |

## Caratteristiche

- 🔒 **Client-side**: i tuoi dati restano nel browser, zero backend, zero tracking
- 📱 **Mobile-first**: funziona perfettamente da smartphone
- 🆓 **Gratis e open source**: codice MIT su questo repo
- 🔄 **Sempre aggiornato**: parametri sincronizzati col canale tramite pipeline automatica (single source of truth)

## Stack

- [SvelteKit](https://kit.svelte.dev/) 2.x + TypeScript + runes mode
- [Tailwind CSS](https://tailwindcss.com/) v4
- [`@sveltejs/adapter-static`](https://kit.svelte.dev/docs/adapter-static) + GitHub Pages
- Niente backend, niente analytics, niente cookie

## Sviluppo locale

```bash
npm install
npm run dev -- --open
```

Build produzione (uguale a quella che gira su GitHub Pages):

```bash
npm run build
npm run preview
```

## Deploy

Push su `main` → GitHub Actions builds + deploya in ~2 min. Vedi `.github/workflows/deploy.yml`.

## Disclaimer

I tool hanno finalità informative e divulgative. Non sono consulenza finanziaria.
I valori di default vanno verificati con le fonti primarie (MEF, ISTAT, Banca d'Italia) prima di prendere decisioni di investimento.

## Licenza

MIT.
