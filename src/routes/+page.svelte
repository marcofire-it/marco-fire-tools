<script lang="ts">
	import { base } from '$app/paths';

	const tools = [
		{
			slug: 'btp-si-compare',
			emoji: '🟢',
			title: 'BTP Italia Sì Compare',
			desc: "Confronta il nuovo BTP Italia Sì (emissione 15-19 giu 2026) con BTP Italia classico, BTP Valore, BTP Futura e BTP nominali. Calcola YTM secondario dal prezzo MOT corrente.",
			tag: '🔥 Nuovo',
			ready: true
		},
		{
			slug: 'fire-calc',
			emoji: '📈',
			title: 'FIRE Calculator',
			desc: 'Numero FIRE personale + anni a FIRE per classi di età, glide path equity/bond, allocazione consigliata.',
			tag: 'In arrivo',
			ready: false
		},
		{
			slug: 'pic-vs-pac',
			emoji: '⚖️',
			title: 'PIC vs PAC',
			desc: 'Confronto investimento Lump Sum vs Piano di Accumulo Capitale con simulazioni reali.',
			tag: 'In arrivo',
			ready: false
		}
	];
</script>

<svelte:head>
	<title>Marco FIRE Tools — calcolatori web per finanza personale</title>
</svelte:head>

<section class="mb-12 text-center">
	<h1 class="text-4xl md:text-5xl font-bold mb-4">
		<span class="text-mfire-accent">Calcolatori web</span><br />
		per la finanza personale italiana
	</h1>
	<p class="text-lg text-slate-300 max-w-2xl mx-auto">
		Strumenti gratuiti, open source, mobile-first per pianificare il tuo FIRE, confrontare BTP, simulare PAC e altro. Tutti i calcoli avvengono nel tuo browser — niente dati inviati a server.
	</p>
</section>

<section class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
	{#each tools as tool}
		<a
			href={tool.ready ? `${base}/${tool.slug}` : '#'}
			class="card hover:border-mfire-accent transition-colors {tool.ready ? '' : 'opacity-50 cursor-not-allowed'}"
			class:pointer-events-none={!tool.ready}
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-3xl">{tool.emoji}</span>
				<span class="text-xs px-2 py-1 rounded {tool.ready ? 'bg-mfire-accent/20 text-mfire-accent' : 'bg-slate-700 text-slate-400'}">
					{tool.tag}
				</span>
			</div>
			<h2 class="text-xl font-semibold mb-2">{tool.title}</h2>
			<p class="text-sm text-slate-400">{tool.desc}</p>
		</a>
	{/each}
</section>

<section class="mt-16 card">
	<h2 class="text-2xl font-bold mb-4">Perché Marco FIRE Tools?</h2>
	<ul class="space-y-2 text-slate-300">
		<li>✅ <strong>Gratis e open source</strong> — codice su GitHub, ispezionabile da chiunque</li>
		<li>✅ <strong>Privacy assoluta</strong> — tutto in browser, niente backend, niente tracking</li>
		<li>✅ <strong>Mobile-first</strong> — usabile dal telefono in metro</li>
		<li>✅ <strong>Sempre aggiornato</strong> — tassi MEF, ISTAT, indici aggiornati al rilascio</li>
		<li>✅ <strong>Italia-centric</strong> — BTP, FP, IRPEF, ISEE già integrati</li>
	</ul>
</section>
