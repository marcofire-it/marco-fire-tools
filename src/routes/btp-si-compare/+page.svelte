<script lang="ts">
	import {
		DEFAULT_PARAMS,
		btpSiCedolaAnnuaLorda,
		btpSiTotNetto,
		btpSiIrrRealeNetto,
		btpClassicoYtmReale,
		btpClassicoIrrRealeNetto,
		btpValoreRealeNetto,
		btpNominaleRealeNetto,
		breakEvenInflazione,
		fmtPct,
		fmtEur
	} from '$lib/finance/btp';

	// Tassazione titoli di stato — single source da DEFAULT_PARAMS (sync via JSON master)
	const TAX = DEFAULT_PARAMS.si.tassazione;
	const META = DEFAULT_PARAMS._meta;

	// Helper: formatta ISO date "2026-06-15" → "15 giugno 2026"
	const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
		'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
	function fmtDateIt(iso: string): string {
		if (!iso || iso.length < 10) return iso;
		const [y, m, d] = iso.split('-');
		return `${parseInt(d)} ${MESI_IT[parseInt(m) - 1]} ${y}`;
	}
	// Formatta finestra collocamento "15-19 giugno 2026" (assume stesso mese/anno)
	function fmtFinestra(isoStart: string, isoEnd: string): string {
		if (!isoStart || !isoEnd) return '';
		const [ys, ms, ds] = isoStart.split('-');
		const [, , de] = isoEnd.split('-');
		return `${parseInt(ds)}-${parseInt(de)} ${MESI_IT[parseInt(ms) - 1]} ${ys}`;
	}
	const finestraCollocamento = fmtFinestra(META.dataEmissioneInizio, META.dataEmissioneFine);
	const dataAnnuncioMefIt = fmtDateIt(META.dataAnnuncioMef);

	// State reattivo. Tasso fisso digitato in % (es. 1.2 per 1,2%) per UX,
	// internamente convertito a decimale (0.012).
	let tassoFissoPct = $state(DEFAULT_PARAMS.si.tassoFissoReale * 100);
	const tassoFisso = $derived(tassoFissoPct / 100);
	let capitale = $state(DEFAULT_PARAMS.si.capitale);
	let scenarioInfl = $state(DEFAULT_PARAMS.si.inflazione);
	let prezzoMag28 = $state(DEFAULT_PARAMS.classico.mag28.prezzoMot);
	let prezzoGiu30 = $state(DEFAULT_PARAMS.classico.giu30.prezzoMot);

	// Derived: parametri Sì correnti
	const siParams = $derived({
		...DEFAULT_PARAMS.si,
		tassoFissoReale: tassoFisso,
		capitale,
		inflazione: scenarioInfl
	});

	// Calcoli BTP Italia Sì
	const cedolaLordaAnnua = $derived(btpSiCedolaAnnuaLorda(siParams));
	const cedolaNettaAnnua = $derived(cedolaLordaAnnua * (1 - TAX));
	const totNetto5y = $derived(btpSiTotNetto(siParams));
	const irrSiRealeNetto = $derived(btpSiIrrRealeNetto(siParams));

	// Calcoli BTP Italia classico
	const ytmMag28 = $derived(btpClassicoYtmReale({ ...DEFAULT_PARAMS.classico.mag28, prezzoMot: prezzoMag28 }));
	const ytmGiu30 = $derived(btpClassicoYtmReale({ ...DEFAULT_PARAMS.classico.giu30, prezzoMot: prezzoGiu30 }));
	const ytmMedio = $derived((ytmMag28 + ytmGiu30) / 2);
	const irrClassicoNetto = $derived(ytmMedio * (1 - TAX));

	// Matrice 5 strumenti × 4 scenari
	const scenari = DEFAULT_PARAMS.scenariInflazione;

	function getMatrixRow(strumento: string): number[] {
		return scenari.map((infl) => {
			if (strumento === 'si') {
				// fiscal drag: il reale netto dipende dallo scenario FOI
				return btpSiIrrRealeNetto({ ...siParams, inflazione: infl });
			}
			if (strumento === 'classico') {
				// stesso drag del Sì: anche la rivalutazione FOI del classico è tassata
				return irrClassicoNetto - TAX * infl;
			}
			if (strumento === 'valore') {
				return btpValoreRealeNetto({ ...DEFAULT_PARAMS.valore, inflazione: infl });
			}
			if (strumento === 'nom5y') {
				return btpNominaleRealeNetto(
					{ rendimentoLordo: DEFAULT_PARAMS.nominali['5y'], tassazione: TAX },
					infl
				);
			}
			if (strumento === 'nom10y') {
				return btpNominaleRealeNetto(
					{ rendimentoLordo: DEFAULT_PARAMS.nominali['10y'], tassazione: TAX },
					infl
				);
			}
			return 0;
		});
	}

	const matrice = $derived({
		si: getMatrixRow('si'),
		classico: getMatrixRow('classico'),
		valore: getMatrixRow('valore'),
		nom5y: getMatrixRow('nom5y'),
		nom10y: getMatrixRow('nom10y')
	});

	// Break-even per nominali — soglia su rendimenti LORDI (le tasse si elidono)
	const breakEvenNom2y = $derived(breakEvenInflazione(siParams, DEFAULT_PARAMS.nominali['2y']));
	const breakEvenNom5y = $derived(breakEvenInflazione(siParams, DEFAULT_PARAMS.nominali['5y']));
	const breakEvenNom10y = $derived(breakEvenInflazione(siParams, DEFAULT_PARAMS.nominali['10y']));

	// Heatmap helper: colore in base al valore (verde alto, rosso basso)
	function heatColor(value: number, allValues: number[]): string {
		const min = Math.min(...allValues);
		const max = Math.max(...allValues);
		if (max === min) return 'bg-slate-700';
		const norm = (value - min) / (max - min);
		if (norm > 0.75) return 'bg-emerald-700/40 text-emerald-300';
		if (norm > 0.5) return 'bg-emerald-700/20 text-emerald-200';
		if (norm > 0.25) return 'bg-amber-700/20 text-amber-200';
		return 'bg-rose-700/30 text-rose-300';
	}
</script>

<svelte:head>
	<title>BTP Italia Sì Compare — Marco FIRE Tools</title>
	<meta name="description" content="Confronta il BTP Italia Sì (emissione 15-19 giu 2026) con BTP classico, Valore, Futura e nominali. Calcola YTM secondario dal prezzo MOT corrente." />
</svelte:head>

<header class="mb-8">
	<h1 class="text-3xl md:text-4xl font-bold mb-2">🟢 BTP Italia Sì Compare</h1>
	<p class="text-slate-400">Simulatore di confronto per l'emissione del {finestraCollocamento}.</p>
	<div class="mt-4 p-4 bg-mfire-warn/20 border border-mfire-warn rounded-lg text-sm">
		⚠️ <strong>Disclaimer</strong> — Strumento informativo, NON consulenza finanziaria.
		{#if META.stato === 'confermato'}
			Valori aggiornati al {dataAnnuncioMefIt}, giorno dell'annuncio MEF del tasso fisso reale del Sì ({fmtPct(DEFAULT_PARAMS.si.tassoFissoReale, 1)}). Collocamento {finestraCollocamento}.
		{:else}
			Tasso fisso reale del Sì ({fmtPct(DEFAULT_PARAMS.si.tassoFissoReale, 1)}) è <strong>IPOTETICO</strong> finché il MEF non lo annuncia il {dataAnnuncioMefIt}. Collocamento {finestraCollocamento}.
		{/if}
	</div>
</header>

<!-- INPUT PARAMETRI -->
<section class="card mb-8">
	<h2 class="text-xl font-bold mb-4">📥 Parametri</h2>
	<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
		<div>
			<label class="label">
				Tasso fisso reale Sì (annunciato MEF 12/06)
				<input id="tasso-fisso" data-testid="tasso-fisso" type="number" step="0.1" min="0" max="5" bind:value={tassoFissoPct} class="input mt-1" />
				<span class="text-xs text-slate-500">Es. {(DEFAULT_PARAMS.si.tassoFissoReale * 100).toLocaleString('it-IT')} per {fmtPct(DEFAULT_PARAMS.si.tassoFissoReale, 1)} — minimo garantito MEF 12 giu, definitivo a fine collocamento</span>
			</label>
		</div>
		<div>
			<label class="label">
				Capitale investito (€)
				<input id="capitale" data-testid="capitale" type="number" step="1000" min="1000" bind:value={capitale} class="input mt-1" />
			</label>
		</div>
		<div>
			<label class="label">
				Scenario inflazione FOI media
				<select id="scenario-infl" data-testid="scenario-infl" bind:value={scenarioInfl} class="input mt-1">
					<option value={0.01}>1,0% (disinflazione)</option>
					<option value={0.02}>2,0% (base BCE)</option>
					<option value={0.03}>3,0% (persistente)</option>
					<option value={0.045}>4,5% (stress geopolitico)</option>
				</select>
			</label>
		</div>
		<div>
			<label class="label">
				Prezzo MOT BTP Italia mar 2028
				<input id="prezzo-mag28" data-testid="prezzo-mag28" type="number" step="0.1" min="80" max="120" bind:value={prezzoMag28} class="input mt-1" />
				<span class="text-xs text-slate-500">100 = par; oggi ~{DEFAULT_PARAMS.classico.mag28.prezzoMot.toLocaleString('it-IT')}</span>
			</label>
		</div>
		<div>
			<label class="label">
				Prezzo MOT BTP Italia giu 2030
				<input id="prezzo-giu30" data-testid="prezzo-giu30" type="number" step="0.1" min="80" max="120" bind:value={prezzoGiu30} class="input mt-1" />
				<span class="text-xs text-slate-500">Oggi ~{DEFAULT_PARAMS.classico.giu30.prezzoMot.toLocaleString('it-IT')}</span>
			</label>
		</div>
	</div>
</section>

<!-- OUTPUT BTP Italia Sì -->
<section id="output-si" data-testid="output-si" class="card mb-8">
	<h2 class="text-xl font-bold mb-4">🟢 BTP Italia Sì — i tuoi numeri</h2>
	<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Cedola lorda annua</div>
			<div class="text-2xl font-bold text-mfire-accent mt-1">{fmtEur(cedolaLordaAnnua)}</div>
			<div class="text-xs text-slate-500 mt-1">({fmtPct(tassoFisso + scenarioInfl)})</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Cedola netta annua</div>
			<div class="text-2xl font-bold mt-1">{fmtEur(cedolaNettaAnnua)}</div>
			<div class="text-xs text-slate-500 mt-1">netta {fmtPct(TAX, 1)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Tot netto {DEFAULT_PARAMS.si.durata} anni</div>
			<div class="text-2xl font-bold text-mfire-accent mt-1">{fmtEur(totNetto5y)}</div>
			<div class="text-xs text-slate-500 mt-1">cedole + premio {fmtPct(DEFAULT_PARAMS.si.premioFedelta, 1)}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">IRR REALE netto annuo</div>
			<div class="text-2xl font-bold mt-1">{fmtPct(irrSiRealeNetto)}</div>
			<div class="text-xs text-slate-500 mt-1">scenario FOI {fmtPct(scenarioInfl, 1)}</div>
		</div>
	</div>
</section>

<!-- BTP Italia classico - YTM secondario -->
<section class="card mb-8">
	<h2 class="text-xl font-bold mb-4">🔵 BTP Italia classico — YTM secondario MOT</h2>
	<p class="text-sm text-slate-400 mb-4">
		Se compri sul mercato secondario sopra par, il rendimento REALE effettivo è erose dalla perdita capitale a scadenza.
	</p>
	<div class="grid md:grid-cols-3 gap-4">
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Mar 2028 — YTM reale</div>
			<div class="text-2xl font-bold mt-1">{fmtPct(ytmMag28)}</div>
			<div class="text-xs text-slate-500 mt-1">cedola {fmtPct(DEFAULT_PARAMS.classico.mag28.tassoReale, 1)} → prezzo {prezzoMag28}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">Giu 2030 — YTM reale</div>
			<div class="text-2xl font-bold mt-1">{fmtPct(ytmGiu30)}</div>
			<div class="text-xs text-slate-500 mt-1">cedola {fmtPct(DEFAULT_PARAMS.classico.giu30.tassoReale, 1)} → prezzo {prezzoGiu30}</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4 border-2 border-mfire-accent">
			<div class="text-xs text-slate-400 uppercase">Medio (matrice)</div>
			<div class="text-2xl font-bold text-mfire-accent mt-1">{fmtPct(ytmMedio)}</div>
			<div class="text-xs text-slate-500 mt-1">netto: {fmtPct(irrClassicoNetto)}</div>
		</div>
	</div>
</section>

<!-- MATRICE COMPARATIVA -->
<section id="output-matrix" data-testid="output-matrix" class="card mb-8">
	<h2 class="text-xl font-bold mb-2">📊 Matrice rendimento REALE netto annuo</h2>
	<p class="text-sm text-slate-400 mb-4">Per i 5 strumenti × 4 scenari inflazione. Heatmap: verde = miglior rendimento per scenario, rosso = peggiore.</p>
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-slate-600">
					<th class="text-left py-2 px-3">Strumento</th>
					{#each scenari as s}
						<th class="text-right py-2 px-3">Infl. {fmtPct(s, 1)}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr class="border-b border-slate-700">
					<td class="py-2 px-3 font-semibold">🟢 BTP Italia Sì</td>
					{#each matrice.si as v, i}
						<td class="text-right py-2 px-3 {heatColor(v, [matrice.si[i], matrice.classico[i], matrice.valore[i], matrice.nom5y[i], matrice.nom10y[i]])}">{fmtPct(v)}</td>
					{/each}
				</tr>
				<tr class="border-b border-slate-700">
					<td class="py-2 px-3 font-semibold">🔵 BTP Italia classico (YTM MOT)</td>
					{#each matrice.classico as v, i}
						<td class="text-right py-2 px-3 {heatColor(v, [matrice.si[i], matrice.classico[i], matrice.valore[i], matrice.nom5y[i], matrice.nom10y[i]])}">{fmtPct(v)}</td>
					{/each}
				</tr>
				<tr class="border-b border-slate-700">
					<td class="py-2 px-3 font-semibold">🟡 BTP Valore</td>
					{#each matrice.valore as v, i}
						<td class="text-right py-2 px-3 {heatColor(v, [matrice.si[i], matrice.classico[i], matrice.valore[i], matrice.nom5y[i], matrice.nom10y[i]])}">{fmtPct(v)}</td>
					{/each}
				</tr>
				<tr class="border-b border-slate-700">
					<td class="py-2 px-3 font-semibold">🔴 BTP nominale 5y</td>
					{#each matrice.nom5y as v, i}
						<td class="text-right py-2 px-3 {heatColor(v, [matrice.si[i], matrice.classico[i], matrice.valore[i], matrice.nom5y[i], matrice.nom10y[i]])}">{fmtPct(v)}</td>
					{/each}
				</tr>
				<tr>
					<td class="py-2 px-3 font-semibold">🟣 BTP nominale 10y</td>
					{#each matrice.nom10y as v, i}
						<td class="text-right py-2 px-3 {heatColor(v, [matrice.si[i], matrice.classico[i], matrice.valore[i], matrice.nom5y[i], matrice.nom10y[i]])}">{fmtPct(v)}</td>
					{/each}
				</tr>
			</tbody>
		</table>
	</div>
</section>

<!-- BREAK-EVEN -->
<section class="card mb-8">
	<h2 class="text-xl font-bold mb-4">⚖️ Break-even inflazione FOI</h2>
	<p class="text-sm text-slate-400 mb-4">
		A quale inflazione media FOI il Sì raggiunge il rendimento del nominale a cedola fissa.
	</p>
	<div class="grid md:grid-cols-3 gap-4">
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">vs BTP nominale 2y ({fmtPct(DEFAULT_PARAMS.nominali['2y'], 2)})</div>
			<div class="text-2xl font-bold mt-1 {breakEvenNom2y <= 0 ? 'text-emerald-400' : ''}">
				{breakEvenNom2y <= 0 ? '✓ vince sempre' : `> ${fmtPct(breakEvenNom2y, 1)}`}
			</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">vs BTP nominale 5y ({fmtPct(DEFAULT_PARAMS.nominali['5y'], 2)})</div>
			<div class="text-2xl font-bold mt-1">
				{breakEvenNom5y <= 0 ? '✓ vince sempre' : `> ${fmtPct(breakEvenNom5y, 1)}`}
			</div>
		</div>
		<div class="bg-slate-800 rounded-lg p-4">
			<div class="text-xs text-slate-400 uppercase">vs BTP nominale 10y ({fmtPct(DEFAULT_PARAMS.nominali['10y'], 2)})</div>
			<div class="text-2xl font-bold mt-1">
				{breakEvenNom10y <= 0 ? '✓ vince sempre' : `> ${fmtPct(breakEvenNom10y, 1)}`}
			</div>
		</div>
	</div>
</section>

<!-- FONTI -->
<section class="card">
	<h2 class="text-xl font-bold mb-4">📚 Fonti</h2>
	<ul class="text-sm text-slate-300 space-y-1 list-disc list-inside">
		<li>MEF Dipartimento del Tesoro — Annuncio BTP Italia Sì {finestraCollocamento}</li>
		<li>MEF — Esempi calcolo BTP Italia Sì (formula C = (tasso/2) × cap + cap × (CI-1))</li>
		<li>MEF — BTP Italia mar 2028 e giu 2030: prospetto tasso reale {fmtPct(DEFAULT_PARAMS.classico.mag28.tassoReale, 1)} e {fmtPct(DEFAULT_PARAMS.classico.giu30.tassoReale, 1)}</li>
		<li>MEF — BTP Valore marzo 2026: step-up {fmtPct(DEFAULT_PARAMS.valore.cedola1, 2)}/{fmtPct(DEFAULT_PARAMS.valore.cedola2, 2)}/{fmtPct(DEFAULT_PARAMS.valore.cedola3, 2)}, premio {fmtPct(DEFAULT_PARAMS.valore.premio, 1)}</li>
		<li>Banca d'Italia — risultati aste BTP nominali maggio 2026 (curva 2y-10y)</li>
		<li>Borsa Italiana MOT — prezzi correnti BTP retail (verifica reale prima di investire)</li>
	</ul>
</section>
