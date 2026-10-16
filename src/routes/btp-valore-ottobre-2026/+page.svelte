<script lang="ts">
	import {
		VALORE_OTT26 as P,
		effettivoValore,
		effettivoInsieme,
		verdetto,
		dateCedole,
		montanteValore,
		bollo5,
		prezzoValore,
		prezzoInsieme,
		fmtPct,
		fmtEur,
		type Verdetto
	} from '$lib/finance/btpValore';

	// Input in % per la UX (3.7 = 3,70%), convertiti a decimale.
	const pct = (v: number) => Number((v * 100).toFixed(2));
	let capitale = $state(P.capitale);
	let t12 = $state(pct(P.tassi[0]));
	let t34 = $state(pct(P.tassi[2]));
	let t5 = $state(pct(P.tassi[4]));
	let cedolaInsiemePct = $state(pct(P.cedolaInsieme));
	let btpRifPct = $state(pct(P.btpRiferimento));
	let reinvPct = $state(pct(P.reinvestimento));
	let bolloPct = $state(pct(P.bollo));
	let inflPct = $state(2);
	const TAX = P.tassazione;

	const tassi = $derived([t12, t12, t34, t34, t5].map((v) => v / 100));
	const cedolaInsieme = $derived(cedolaInsiemePct / 100);

	const vLordo = $derived(effettivoValore(tassi));
	const vNetto = $derived(effettivoValore(tassi, TAX));
	const iLordo = $derived(effettivoInsieme(cedolaInsieme));
	const iNetto = $derived(effettivoInsieme(cedolaInsieme, TAX));
	const scartoV = $derived((vLordo - btpRifPct / 100) * 100);
	const scartoI = $derived((iLordo - btpRifPct / 100) * 100);
	const verV = $derived(verdetto(scartoV));
	const verI = $derived(verdetto(scartoI));
	const mediaSemplice = $derived(tassi.reduce((a, b) => a + b, 0) / 5);

	const date = dateCedole();
	const cedole = $derived(
		date.map((d, i) => {
			const lorda = (capitale * tassi[Math.floor(i / 4)]) / 4;
			return { n: i + 1, data: d, lorda, netta: lorda * (1 - TAX) };
		})
	);
	const totLordoV = $derived(cedole.reduce((a, c) => a + c.lorda, 0));
	const totNettoV = $derived(totLordoV * (1 - TAX));
	const insiemeLorda = $derived(capitale * cedolaInsieme);
	const insiemeNetta = $derived(insiemeLorda * (1 - TAX));

	const montV = $derived(montanteValore(capitale, tassi, TAX, reinvPct / 100));
	const montI = $derived(capitale + insiemeNetta);
	const bollo = $derived(bollo5(capitale, bolloPct / 100, iLordo));

	const infl = $derived(inflPct / 100);
	const realeV = $derived((1 + vNetto) / (1 + infl) - 1);
	const realeI = $derived((1 + iNetto) / (1 + infl) - 1);
	const pareggioSi = $derived((1 + vLordo) / (1 + P.tassoRealeSi) - 1);

	// Se il mercato si muove prima della chiusura: scarto rispetto al BTP di riferimento
	const mosse = [-20, -10, 0, 10, 20, 30];
	const anni = [1, 2, 3, 4];
	const shift = [-1, -0.5, 0, 0.5, 1];

	const COLORE: Record<Verdetto, string> = {
		VERDE: 'bg-emerald-700/40 text-emerald-300 border-emerald-500',
		GIALLO: 'bg-amber-700/30 text-amber-200 border-amber-500',
		ROSSO: 'bg-rose-700/30 text-rose-300 border-rose-500'
	};
	const fmtPb = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v * 10000).toFixed(0) + ' pb';
	const fmtN = (v: number) => v.toFixed(2).replace('.', ',');
</script>

<svelte:head>
	<title>BTP Valore e Valore Insieme ottobre 2026 — Marco FIRE Tools</title>
	<meta name="description" content="Calcola rendimento effettivo, cedole nette, bollo e verdetto del BTP Valore e del BTP Valore Insieme (collocamento 19-23 ottobre 2026) sui tassi minimi del MEF." />
</svelte:head>

<header class="mb-8">
	<h1 class="text-3xl md:text-4xl font-bold mb-2">🟡 BTP Valore e Valore Insieme — ottobre 2026</h1>
	<p class="text-slate-400">
		Due titoli a 5 anni, stessa scadenza ({new Date(P.scadenza).toLocaleDateString('it-IT')}): il Valore paga una cedola ogni 3 mesi,
		il Valore Insieme una sola cedola alla fine. Collocamento {P.collocamento}.
	</p>
	<div class="mt-4 p-4 bg-mfire-warn/20 border border-mfire-warn rounded-lg text-sm">
		⚠️ <strong>Disclaimer</strong> — Strumento informativo, NON consulenza finanziaria. Valori di partenza: tassi minimi garantiti del
		{P.comunicato} (ISIN Valore <strong>{P.isinValore}</strong>, Insieme <strong>{P.isinInsieme}</strong>). A fine collocamento i tassi
		possono essere solo confermati o alzati: se salgono, scrivili qui sotto.
	</div>
</header>

<!-- INPUT -->
<section class="card mb-8">
	<h2 class="text-xl font-bold mb-4">📥 Parametri</h2>
	<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
		<label class="label">Capitale (€)
			<input data-testid="capitale" type="number" step="1000" min="1000" bind:value={capitale} class="input mt-1" />
		</label>
		<label class="label">Valore, tasso anni 1-2 (%)
			<input data-testid="t12" type="number" step="0.05" min="0" max="10" bind:value={t12} class="input mt-1" />
		</label>
		<label class="label">Valore, tasso anni 3-4 (%)
			<input data-testid="t34" type="number" step="0.05" min="0" max="10" bind:value={t34} class="input mt-1" />
		</label>
		<label class="label">Valore, tasso anno 5 (%)
			<input data-testid="t5" type="number" step="0.05" min="0" max="10" bind:value={t5} class="input mt-1" />
		</label>
		<label class="label">Insieme, cedola unica (% del capitale)
			<input data-testid="cedola-insieme" type="number" step="0.05" min="0" max="50" bind:value={cedolaInsiemePct} class="input mt-1" />
		</label>
		<label class="label">BTP ordinario di confronto, rend. lordo (%)
			<input data-testid="btp-rif" type="number" step="0.01" min="0" max="10" bind:value={btpRifPct} class="input mt-1" />
			<span class="text-xs text-slate-500">BTP 3,95% feb-2032: 4,01% su Borsa Italiana il 16/10 (prezzo 99,90)</span>
		</label>
		<label class="label">Reinvestimento cedole del Valore (%)
			<input data-testid="reinv" type="number" step="0.1" min="0" max="10" bind:value={reinvPct} class="input mt-1" />
		</label>
		<label class="label">Bollo annuo (%)
			<input data-testid="bollo" type="number" step="0.05" min="0" max="1" bind:value={bolloPct} class="input mt-1" />
		</label>
	</div>
</section>

<!-- VERDETTO -->
<section data-testid="output-verdetto" class="card mb-8">
	<h2 class="text-xl font-bold mb-4">🚦 Rendimento effettivo e verdetto</h2>
	<div class="grid md:grid-cols-2 gap-4">
		{#each [{ nome: 'BTP Valore (trimestrale)', l: vLordo, n: vNetto, s: scartoV, v: verV }, { nome: 'BTP Valore Insieme (cedola unica)', l: iLordo, n: iNetto, s: scartoI, v: verI }] as t}
			<div class="rounded-lg p-4 border-2 {COLORE[t.v]}">
				<div class="text-sm uppercase opacity-80">{t.nome}</div>
				<div class="text-3xl font-bold mt-1">{fmtPct(t.l)} <span class="text-base font-normal">lordo</span></div>
				<div class="text-lg">{fmtPct(t.n)} netto (imposta 12,5%, prima del bollo)</div>
				<div class="mt-2 text-sm">Scarto sul BTP ordinario: <strong>{t.s >= 0 ? '+' : ''}{t.s.toFixed(2).replace('.', ',')} punti</strong> → <strong>{t.v}</strong></div>
			</div>
		{/each}
	</div>
	<p class="text-sm text-slate-400 mt-4">
		Regola pubblicata il 25/09/2026: <strong>rosso</strong> oltre 0,05 punti sotto il BTP ordinario (meglio quello già quotato);
		<strong>giallo</strong> da −0,05 a +0,10 (conviene per i vantaggi accessori: zero commissioni, prezzo 100, quantità garantita);
		<strong>verde</strong> oltre +0,10 (il Tesoro paga un premio). La media semplice delle cedole ({fmtPct(mediaSemplice)}) non è il rendimento:
		le cedole più alte arrivano alla fine.
	</p>
</section>

<!-- FLUSSI -->
<section data-testid="output-flussi" class="card mb-8">
	<h2 class="text-xl font-bold mb-2">📅 Quanto incassi e quando</h2>
	<div class="grid md:grid-cols-2 gap-4 mb-4">
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">BTP Valore — 20 cedole</div>
			<div class="text-2xl font-bold text-sky-300 mt-1">{fmtEur(totNettoV, 2)} netti</div>
			<div class="text-xs text-slate-500 mt-1">{fmtEur(totLordoV, 2)} lordi · imposta {fmtEur(totLordoV - totNettoV, 2)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Valore Insieme — 1 cedola il {new Date(P.scadenza).toLocaleDateString('it-IT')}</div>
			<div class="text-2xl font-bold text-mfire-accent mt-1">{fmtEur(insiemeNetta, 2)} netti</div>
			<div class="text-xs text-slate-500 mt-1">{fmtEur(insiemeLorda, 2)} lordi · imposta {fmtEur(insiemeLorda - insiemeNetta, 2)}</div>
		</div>
	</div>
	<details>
		<summary class="cursor-pointer text-sm text-slate-300">Mostra le 20 cedole del Valore</summary>
		<div class="overflow-x-auto mt-3">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-left text-slate-400 border-b border-slate-700">
						<th class="py-2 pr-3">N.</th><th class="py-2 pr-3">Data (indicativa)</th>
						<th class="py-2 pr-3 text-right">Lorda</th><th class="py-2 text-right">Netta</th>
					</tr>
				</thead>
				<tbody>
					{#each cedole as c}
						<tr class="border-b border-slate-800">
							<td class="py-1 pr-3">{c.n}/20</td><td class="py-1 pr-3">{c.data}</td>
							<td class="py-1 pr-3 text-right">{fmtEur(c.lorda, 2)}</td><td class="py-1 text-right">{fmtEur(c.netta, 2)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</section>

<!-- GEMELLI -->
<section data-testid="output-gemelli" class="card mb-8">
	<h2 class="text-xl font-bold mb-2">⚖️ Alla scadenza: quanto hai in tasca</h2>
	<p class="text-sm text-slate-400 mb-4">
		Il Valore Insieme paga di più in euro perché gli interessi restano dentro il titolo fino alla fine. Il confronto giusto:
		reinvesti le cedole del Valore al {fmtPct(reinvPct / 100, 1)} annuo. Netto di imposta, bollo a parte.
	</p>
	<div class="grid md:grid-cols-3 gap-4">
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Valore + cedole reinvestite</div>
			<div class="text-2xl font-bold mt-1">{fmtEur(montV)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Valore Insieme</div>
			<div class="text-2xl font-bold mt-1">{fmtEur(montI)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4 border-2 border-mfire-accent">
			<div class="text-xs text-slate-400 uppercase">Differenza</div>
			<div class="text-2xl font-bold text-mfire-accent mt-1">{fmtEur(Math.abs(montI - montV))}</div>
			<div class="text-xs text-slate-500 mt-1">a favore {montI >= montV ? "dell'Insieme" : 'del Valore'}</div>
		</div>
	</div>
	<p class="text-sm text-slate-400 mt-4">
		Bollo {fmtPct(bolloPct / 100, 2)} annuo in 5 anni: Valore ≈ <strong>{fmtEur(bollo.valore)}</strong>, Insieme fino a
		≈ <strong>{fmtEur(bollo.insieme)}</strong> (se l'intermediario lo calcola sul valore che cresce con gli interessi maturati).
	</p>
</section>

<!-- MERCATO -->
<section data-testid="output-mercato" class="card mb-8">
	<h2 class="text-xl font-bold mb-2">📉 Se i tassi di mercato si muovono prima del 23/10</h2>
	<p class="text-sm text-slate-400 mb-4">Il Valore ha tassi fissati; il BTP di confronto no. Scarto e colore se il BTP ordinario sale o scende.</p>
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="text-left text-slate-400 border-b border-slate-700">
					<th class="py-2 pr-3">BTP ordinario</th><th class="py-2 pr-3 text-right">Suo rendimento</th>
					<th class="py-2 pr-3 text-right">Scarto del Valore</th><th class="py-2 text-right">Colore</th>
				</tr>
			</thead>
			<tbody>
				{#each mosse as m}
					{@const s = vLordo - btpRifPct / 100 - m / 10000}
					<tr class="border-b border-slate-800 {m === 0 ? 'font-semibold' : ''}">
						<td class="py-1 pr-3">{m === 0 ? 'invariato' : (m > 0 ? '+' : '−') + Math.abs(m) + ' pb'}</td>
						<td class="py-1 pr-3 text-right">{fmtPct(btpRifPct / 100 + m / 10000)}</td>
						<td class="py-1 pr-3 text-right">{fmtPb(s)}</td>
						<td class="py-1 text-right"><span class="px-2 py-0.5 rounded border {COLORE[verdetto(s * 100)]}">{verdetto(s * 100)}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<!-- VENDERE PRIMA -->
<section data-testid="output-vendere" class="card mb-8">
	<h2 class="text-xl font-bold mb-2">🔁 Se vendi prima della scadenza</h2>
	<p class="text-sm text-slate-400 mb-4">
		Prezzo per 100 di nominale dopo 1-4 anni, se i tassi di mercato cambiano di ±0,5 e ±1 punto. Valore: corso secco dopo la cedola.
		Insieme: valore con gli interessi maturati (in Borsa la parte maturata può essere conteggiata a parte, come rateo).
	</p>
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="text-left text-slate-400 border-b border-slate-700">
					<th class="py-2 pr-3">Dopo</th>
					{#each shift as d}<th class="py-2 pr-3 text-right">{d > 0 ? '+' : d < 0 ? '−' : ''}{fmtN(Math.abs(d))} pt</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each anni as k}
					<tr class="border-b border-slate-800">
						<td class="py-1 pr-3">{k} {k === 1 ? 'anno' : 'anni'}</td>
						{#each shift as d}
							<td class="py-1 pr-3 text-right">
								<span class="text-sky-300">{fmtN(prezzoValore(tassi, vLordo, k, d))}</span>
								<span class="text-slate-500">·</span>
								<span class="text-amber-300">{fmtN(prezzoInsieme(cedolaInsieme, vLordo, k, d))}</span>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="text-xs text-slate-500 mt-2"><span class="text-sky-300">azzurro</span> = Valore · <span class="text-amber-300">arancio</span> = Insieme. A scadenza entrambi rimborsano 100.</p>
</section>

<!-- INFLAZIONE -->
<section data-testid="output-inflazione" class="card mb-8">
	<h2 class="text-xl font-bold mb-2">🌡️ E l'inflazione?</h2>
	<label class="label max-w-xs">Inflazione media annua nei 5 anni (%)
		<input data-testid="infl" type="number" step="0.1" min="0" max="10" bind:value={inflPct} class="input mt-1" />
	</label>
	<div class="grid md:grid-cols-3 gap-4 mt-4">
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Reale netto, Valore</div>
			<div class="text-2xl font-bold mt-1 {realeV < 0 ? 'text-rose-300' : ''}">{fmtPct(realeV)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Reale netto, Insieme</div>
			<div class="text-2xl font-bold mt-1 {realeI < 0 ? 'text-rose-300' : ''}">{fmtPct(realeI)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Pareggio con BTP Italia Sì</div>
			<div class="text-2xl font-bold mt-1">{fmtPct(pareggioSi)}</div>
			<div class="text-xs text-slate-500 mt-1">sopra questa inflazione media rende di più l'indicizzato (1,60% reale, lordo, semplificato)</div>
		</div>
	</div>
	<p class="text-sm text-slate-400 mt-4">
		A settembre 2026 l'inflazione su un anno era al 4,2% (ISTAT, spinta dall'energia +22,6%), quella di fondo all'1,6%:
		è il dato di un mese, non la media dei prossimi cinque anni.
	</p>
</section>

<!-- FONTI -->
<section class="card">
	<h2 class="text-xl font-bold mb-4">📚 Fonti e note</h2>
	<ul class="text-sm text-slate-300 space-y-1 list-disc list-inside">
		<li>{P.comunicato}: tassi minimi garantiti 3,70% / 4,10% / 4,70% e cedola unica 22,25%; nessun premio fedeltà</li>
		<li>Borsa Italiana, 16/10/2026: BTP 3,95% feb-2032 (IT0005733636) al 4,01% lordo, prezzo 99,90</li>
		<li>ISTAT, prezzi al consumo di settembre 2026 (dati definitivi del 16/10/2026)</li>
		<li>Calcoli miei: rendimento effettivo da flussi trimestrali, imposta 12,5%, bollo 0,20% annuo; date cedole indicative (trimestrali dal 27/10/2026)</li>
		<li>Stesso motore del foglio Excel gratuito
			<a class="text-mfire-accent underline" href="https://github.com/marcofire-it/marco-fire-simulatori/raw/main/simulatori/btp_valore_ottobre_2026.xlsx">btp_valore_ottobre_2026.xlsx</a></li>
	</ul>
</section>
