<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	let { children } = $props();
</script>

<svelte:head>
	<title>Marco FIRE Tools</title>
</svelte:head>

<div class="min-h-screen flex flex-col">
	<header class="bg-mfire-surface border-b border-slate-700">
		<nav class="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-4">
			<a href="{base}/" class="text-xl font-bold text-mfire-accent">🔥 Marco FIRE Tools</a>
			<div class="flex gap-6 text-sm">
				<a href="{base}/" class="hover:text-mfire-accent">Tutti i tool</a>
				<a href="{base}/btp-si-compare" class="hover:text-mfire-accent">BTP Italia Sì</a>
				<a href="{base}/about" class="hover:text-mfire-accent">About</a>
			</div>
		</nav>
	</header>

	<main class="container mx-auto px-4 py-8 flex-1">
		{@render children()}
	</main>

	<footer class="bg-mfire-surface border-t border-slate-700 mt-12">
		<div class="container mx-auto px-4 py-6 text-sm text-slate-400 text-center">
			Marco FIRE Tools — calcolatori gratuiti per finanza personale italiana.
			<br />
			<span class="text-xs">⚠️ Strumenti informativi, NON consulenza finanziaria. Verifica sempre con un professionista.</span>
		</div>
	</footer>
</div>
