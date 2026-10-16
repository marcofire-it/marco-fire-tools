/**
 * BTP Valore + BTP Valore Insieme, collocamento 19-23 ottobre 2026.
 * Port 1:1 del foglio `btp_valore_ottobre_2026.xlsx` (marco-fire-simulatori):
 * stessi motori, stessi numeri del video del 16/10/2026 a parità di input.
 *
 * Convenzioni (come l'Excel):
 *  - flussi trimestrali per 100 di nominale, 20 trimestri;
 *  - rendimento effettivo annuo = (1 + IRR trimestrale)^4 - 1;
 *  - Valore Insieme: (1 + cedola unica)^(1/5) - 1;
 *  - netto = imposta 12,5% su ogni cedola, bollo escluso;
 *  - nessun premio fedeltà (il comunicato MEF n. 110 non ne prevede).
 */

export const VALORE_OTT26 = {
	comunicato: 'MEF, comunicato stampa n. 110 del 16/10/2026',
	isinValore: 'IT0005735201',
	isinInsieme: 'IT0005735227',
	collocamento: '19-23 ottobre 2026 (fino alle 13:00 del 23/10)',
	godimento: '2026-10-27',
	scadenza: '2031-10-27',
	/** tassi annui minimi garantiti, anni 1..5 */
	tassi: [0.037, 0.037, 0.041, 0.041, 0.047],
	/** cedola unica del Valore Insieme, % del capitale (lorda) */
	cedolaInsieme: 0.2225,
	/** BTP 3,95% feb-2032 (IT0005733636), Borsa Italiana 16/10/2026, prezzo 99,90 */
	btpRiferimento: 0.0401,
	tassazione: 0.125,
	bollo: 0.002,
	capitale: 10000,
	/** reinvestimento cedole: circa il netto del Valore */
	reinvestimento: 0.0358,
	/** tasso reale BTP Italia Sì giu-2031 per l'inflazione di pareggio */
	tassoRealeSi: 0.016
} as const;

export type Verdetto = 'ROSSO' | 'GIALLO' | 'VERDE';

/** Flussi trimestrali per 100 di nominale; [0] = -100. */
export function flussiValore(tassi: readonly number[], tax = 0): number[] {
	const f = [-100];
	for (let q = 1; q <= 20; q++) {
		const anno = Math.ceil(q / 4);
		f.push((100 * tassi[anno - 1]) / 4 * (1 - tax) + (q === 20 ? 100 : 0));
	}
	return f;
}

/** IRR per periodo (bisezione, come Excel IRR su flussi regolari). */
export function irr(flussi: number[]): number {
	let lo = -0.9, hi = 1;
	const npv = (r: number) => flussi.reduce((a, c, t) => a + c / Math.pow(1 + r, t), 0);
	for (let k = 0; k < 200; k++) {
		const m = (lo + hi) / 2;
		if (npv(m) > 0) lo = m; else hi = m;
	}
	return (lo + hi) / 2;
}

export const effettivoValore = (tassi: readonly number[], tax = 0) =>
	Math.pow(1 + irr(flussiValore(tassi, tax)), 4) - 1;

export const effettivoInsieme = (cedola: number, tax = 0) =>
	Math.pow(1 + cedola * (1 - tax), 1 / 5) - 1;

/** Regola pubblicata il 25/09/2026: scarto in punti percentuali sul BTP ordinario. */
export function verdetto(scartoPunti: number): Verdetto {
	if (scartoPunti < -0.05) return 'ROSSO';
	if (scartoPunti <= 0.1) return 'GIALLO';
	return 'VERDE';
}

/** Date di stacco trimestrali dal godimento (27/10/2026). */
export function dateCedole(): string[] {
	const out: string[] = [];
	for (let q = 1; q <= 20; q++) {
		const d = new Date(Date.UTC(2026, 9 + 3 * q, 27));
		out.push(d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }));
	}
	return out;
}

/** Capitale + cedole nette reinvestite fino alla scadenza (foglio 3, B19). */
export function montanteValore(capitale: number, tassi: readonly number[], tax: number, reinv: number): number {
	let m = capitale;
	for (let q = 1; q <= 20; q++) {
		const c = (capitale * tassi[Math.ceil(q / 4) - 1]) / 4 * (1 - tax);
		m += c * Math.pow(1 + reinv, (20 - q) / 4);
	}
	return m;
}

/** Bollo in 5 anni: Valore sul nominale, Insieme sul valore che cresce (foglio 3). */
export function bollo5(capitale: number, bollo: number, effInsiemeLordo: number) {
	let insieme = 0;
	for (let y = 1; y <= 5; y++) insieme += capitale * Math.pow(1 + effInsiemeLordo, y) * bollo;
	return { valore: capitale * bollo * 5, insieme };
}

/** Prezzo del Valore (corso secco, dopo la cedola) dopo k anni con tassi spostati di d punti (foglio 4). */
export function prezzoValore(tassi: readonly number[], effLordo: number, k: number, dPunti: number): number {
	const y = effLordo + dPunti / 100;
	const f = flussiValore(tassi);
	let p = 0;
	for (let q = 4 * k + 1; q <= 20; q++) p += f[q] / Math.pow(1 + y, (q - 4 * k) / 4);
	return p;
}

/** Valore Insieme con interessi maturati dopo k anni (foglio 4). */
export function prezzoInsieme(cedola: number, effLordo: number, k: number, dPunti: number): number {
	return (100 * (1 + cedola)) / Math.pow(1 + effLordo + dPunti / 100, 5 - k);
}

export function fmtPct(v: number, d = 2): string {
	return (v * 100).toFixed(d).replace('.', ',') + '%';
}
export function fmtEur(v: number, d = 0): string {
	// raggruppa anche le migliaia a 4 cifre (it-IT di default scrive «1776»)
	const [int, dec] = Math.abs(v).toFixed(d).split('.');
	const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	return (v < 0 ? '−' : '') + g + (dec ? ',' + dec : '') + ' €';
}
