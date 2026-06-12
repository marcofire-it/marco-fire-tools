/**
 * Logica finanziaria BTP Italia Sì + concorrenti.
 * Port diretto dalle formule del foglio Excel `btp_si_compare_2026.xlsx`.
 */

export interface BtpSiInputs {
	/** Tasso fisso reale annuo BTP Italia Sì (minimo garantito annunciato MEF 12/06; definitivo, solo al rialzo, a fine collocamento) */
	tassoFissoReale: number;
	/** Premio fedeltà finale (0,6% confermato MEF) */
	premioFedelta: number;
	/** Durata anni (5 confermato MEF) */
	durata: number;
	/** Tassazione titoli stato (12,5%) */
	tassazione: number;
	/** Capitale investito EUR */
	capitale: number;
	/** Scenario inflazione FOI media annua (es. 0.02 = 2%) */
	inflazione: number;
}

export interface BtpClassicoInputs {
	/** Tasso cedolare reale annuo (prospetto: 2,0% mag28 / 1,6% giu30) */
	tassoReale: number;
	/** Prezzo secondario MOT (100 = par) */
	prezzoMot: number;
	/** Anni residui a scadenza */
	anniResidui: number;
}

export interface BtpNominaleInputs {
	/** Rendimento lordo annuo */
	rendimentoLordo: number;
	tassazione: number;
}

export interface BtpMeta {
	/** Stato: "placeholder" prima MEF day, "confermato" dopo annuncio */
	stato: 'placeholder' | 'confermato' | string;
	/** Data ufficiale annuncio MEF tasso fisso reale (ISO YYYY-MM-DD) */
	dataAnnuncioMef: string;
	/** Primo giorno collocamento BTP Italia Sì (ISO) */
	dataEmissioneInizio: string;
	/** Ultimo giorno collocamento BTP Italia Sì (ISO) */
	dataEmissioneFine: string;
	/** ISIN BTP Italia Sì (vuoto/TBD prima del collocamento) */
	isinSi: string;
	/** Ultima data sync JSON master (ISO) */
	ultimoAggiornamento: string;
}

/**
 * BTP Italia Sì — IRR REALE netto annuo per scenario inflazione (fiscal drag).
 * Il 12,5% tassa ANCHE la componente FOI della cedola, quindi il reale netto
 * NON è costante: reale = (tasso + premio/durata + FOI)*(1-tax) - FOI
 *                       = (tasso + premio/durata)*(1-tax) - tax*FOI.
 */
export function btpSiIrrRealeNetto(i: BtpSiInputs): number {
	const premioAnnualizzato = i.premioFedelta / i.durata;
	return (i.tassoFissoReale + premioAnnualizzato) * (1 - i.tassazione) - i.tassazione * i.inflazione;
}

/**
 * BTP Italia Sì — cedola lorda annua secondo scenario inflazione.
 * Formula MEF ufficiale: C = (tasso_fisso + inflazione_semestre) * capitale_nominale.
 * Approssimazione annuale: cedola = (tasso_fisso + inflazione_annua) * capitale.
 */
export function btpSiCedolaAnnuaLorda(i: BtpSiInputs): number {
	return (i.tassoFissoReale + i.inflazione) * i.capitale;
}

/**
 * BTP Italia Sì — totale netto 5 anni (cedole + premio fedeltà).
 */
export function btpSiTotNetto(i: BtpSiInputs): number {
	const cedolaLorda = btpSiCedolaAnnuaLorda(i);
	const cedolaNetta = cedolaLorda * (1 - i.tassazione);
	const totCedole = cedolaNetta * i.durata;
	const premioNetto = i.capitale * i.premioFedelta * (1 - i.tassazione);
	return totCedole + premioNetto;
}

/**
 * YTM reale effettivo del BTP Italia classico per chi compra al prezzo MOT corrente.
 * Bond Equivalent Yield: YTM = (cedola + (100 - prezzo)/N) / ((100 + prezzo)/2)
 */
export function btpClassicoYtmReale(i: BtpClassicoInputs): number {
	const cedola = i.tassoReale * 100;
	return (cedola + (100 - i.prezzoMot) / i.anniResidui) / ((100 + i.prezzoMot) / 2);
}

/**
 * BTP Italia classico — IRR REALE netto annuo per scenario inflazione.
 * Stesso fiscal drag del Sì (anche la rivalutazione FOI del classico è tassata):
 * reale netto = YTM*(1-tax) - tax*FOI.
 */
export function btpClassicoIrrRealeNetto(i: BtpClassicoInputs, tassazione: number, inflazione = 0): number {
	return btpClassicoYtmReale(i) * (1 - tassazione) - tassazione * inflazione;
}

// ---------------------------------------------------------------------------
// IRR ESATTO da cashflow datati (specchio di virtual_influencer/tools/
// compute_ytm_exact.py: stessa bisezione, ACT/365.25, prezzo tel-quel =
// corso secco + rateo). Garantisce che web, Excel e video mostrino GLI STESSI
// numeri a parità di prezzo.
// ---------------------------------------------------------------------------

const TITOLI_CONF = {
	mag28: { scadenza: '2028-03-14', emissione: '', stacchi: [[3, 14], [9, 14]] as Array<[number, number]>, freq: 2 },
	giu30: { scadenza: '2030-06-28', emissione: '', stacchi: [[6, 28], [12, 28]] as Array<[number, number]>, freq: 2 },
	valore: { scadenza: '2032-03-10', emissione: '2026-03-10', stacchi: [[3, 10], [6, 10], [9, 10], [12, 10]] as Array<[number, number]>, freq: 4 },
	futura: { scadenza: '2033-11-16', emissione: '2021-11-16', stacchi: [[5, 16], [11, 16]] as Array<[number, number]>, freq: 2 }
} as const;

function irrFromCashflows(cfs: Array<[number, number]>): number {
	let lo = -0.5, hi = 1.5;
	const npv = (r: number) => cfs.reduce((a, [t, c]) => a + c / Math.pow(1 + r, t), 0);
	for (let k = 0; k < 300; k++) {
		const mid = (lo + hi) / 2;
		if (npv(mid) > 0) lo = mid; else hi = mid;
	}
	return (lo + hi) / 2;
}

function ytmEsattoGenerico(
	titolo: keyof typeof TITOLI_CONF,
	prezzoSecco: number,
	cedolaAnnuaAt: (d: Date) => number, // punti percentuali (es. 2.0)
	asOfIso: string
): number {
	const conf = TITOLI_CONF[titolo];
	const asOf = new Date(asOfIso + 'T00:00:00Z');
	const scad = new Date(conf.scadenza + 'T00:00:00Z');
	const dates: Date[] = [];
	for (let y = asOf.getUTCFullYear() - 2; y <= scad.getUTCFullYear(); y++)
		for (const [mm, dd] of conf.stacchi) {
			const d = new Date(Date.UTC(y, mm - 1, dd));
			if (d <= scad) dates.push(d);
		}
	dates.sort((a, b) => +a - +b);
	const yrs = (d: Date) => (+d - +asOf) / 86400000 / 365.25;
	const future = dates.filter((d) => +d > +asOf);
	const past = dates.filter((d) => +d <= +asOf);
	const prev = past[past.length - 1];
	const next = future[0];
	const cfs: Array<[number, number]> = future.map((d) => [yrs(d), cedolaAnnuaAt(d) / conf.freq]);
	cfs.push([yrs(scad), 100]);
	let rateo = 0;
	if (prev) rateo = (cedolaAnnuaAt(next) / conf.freq) * ((+asOf - +prev) / (+next - +prev));
	return irrFromCashflows([[0, -(prezzoSecco + rateo)], ...cfs]);
}

/** YTM REALE lordo esatto del classico (mag28|giu30) dal prezzo MOT (reale). */
export function ytmEsattoClassico(titolo: 'mag28' | 'giu30', prezzo: number, tassoReale: number, asOfIso: string): number {
	return ytmEsattoGenerico(titolo, prezzo, () => tassoReale * 100, asOfIso);
}

/** YTM nominale lordo esatto del Valore mar32 dal prezzo MOT (no premio: secondario). */
export function ytmEsattoValore(prezzo: number, v: { cedola1: number; cedola2: number; cedola3: number }, asOfIso: string): number {
	const em = +new Date(TITOLI_CONF.valore.emissione + 'T00:00:00Z');
	return ytmEsattoGenerico('valore', prezzo, (d) => {
		const anni = (+d - em) / 86400000 / 365.25;
		return (anni <= 2.001 ? v.cedola1 : anni <= 4.001 ? v.cedola2 : v.cedola3) * 100;
	}, asOfIso);
}

/** YTM nominale lordo esatto del Futura nov33 dal prezzo MOT (no premio PIL: secondario). */
export function ytmEsattoFutura(prezzo: number, f: { cedola1: number; cedola2: number; cedola3: number }, asOfIso: string): number {
	const em = +new Date(TITOLI_CONF.futura.emissione + 'T00:00:00Z');
	return ytmEsattoGenerico('futura', prezzo, (d) => {
		const anni = (+d - em) / 86400000 / 365.25;
		return (anni <= 4.001 ? f.cedola1 : anni <= 8.001 ? f.cedola2 : f.cedola3) * 100;
	}, asOfIso);
}

/**
 * BTP Valore — rendimento medio cedole step-up 2+2+2 anni.
 * Step 1 (anni 1-2), Step 2 (anni 3-4), Step 3 (anni 5-6) + premio fedeltà.
 */
export interface BtpValoreInputs {
	cedola1: number;
	cedola2: number;
	cedola3: number;
	premio: number;
	durata: number;
	tassazione: number;
	inflazione: number;
	/** Prezzo secondario MOT (100 = par) — per YTM esatto di chi compra oggi */
	prezzoMot?: number;
}

export interface BtpFuturaParams {
	cedola1: number;
	cedola2: number;
	cedola3: number;
	prezzoMot: number;
}

export function btpValoreRendimentoLordoAvg(i: BtpValoreInputs): number {
	const avg = (2 * i.cedola1 + 2 * i.cedola2 + 2 * i.cedola3) / 6;
	const premioAnnualizzato = i.premio / i.durata;
	return avg + premioAnnualizzato;
}

/**
 * BTP Valore — rendimento REALE netto annuo in scenario inflazione.
 */
export function btpValoreRealeNetto(i: BtpValoreInputs): number {
	const rendimentoNettoNominale = btpValoreRendimentoLordoAvg(i) * (1 - i.tassazione);
	return rendimentoNettoNominale - i.inflazione;
}

/**
 * BTP nominale — rendimento REALE netto annuo in scenario inflazione.
 * Convenzione LINEARE (lordo - tasse - inflazione), coerente con Excel e video.
 */
export function btpNominaleRealeNetto(i: BtpNominaleInputs, inflazione: number): number {
	const netto = i.rendimentoLordo * (1 - i.tassazione);
	return netto - inflazione;
}

/**
 * Break-even inflazione: a quale inflazione FOI il BTP Italia Sì
 * raggiunge il rendimento netto del nominale (a cedola fissa).
 *
 * Le tasse si ELIDONO: ((tasso_si + FOI_BE) + premio/durata)*(1-tax) = nom_LORDO*(1-tax)
 * → FOI_BE = nom_LORDO - tasso_si - premio/durata (soglia su rendimenti LORDI).
 */
export function breakEvenInflazione(
	si: BtpSiInputs,
	avversarioLordo: number
): number {
	return avversarioLordo - si.tassoFissoReale - si.premioFedelta / si.durata;
}

/**
 * Format helper: formatta % con virgola italiana.
 */
export function fmtPct(v: number, decimals = 2): string {
	return (v * 100).toFixed(decimals).replace('.', ',') + '%';
}

/**
 * Format helper: formatta EUR con separatore migliaia.
 */
export function fmtEur(v: number, decimals = 0): string {
	return v.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €';
}

// >>> AUTO-GENERATED FROM virtual_influencer/shared/btp_params/btp_si_2026_06.json
// Do NOT edit by hand. Run `python virtual_influencer/tools/sync_btp_params.py` to update.
// last_synced: 2026-06-12T12:01:20+00:00  stato: confermato
export const DEFAULT_PARAMS = {
	_meta: {
		stato: 'confermato',
		dataAnnuncioMef: '2026-06-12',
		dataEmissioneInizio: '2026-06-15',
		dataEmissioneFine: '2026-06-19',
		isinSi: 'IT0005713539',
		ultimoAggiornamento: '2026-06-12'
	} satisfies BtpMeta,
	si: {
		tassoFissoReale: 0.016,
		premioFedelta: 0.006,
		durata: 5,
		tassazione: 0.125,
		capitale: 10000,
		inflazione: 0.02
	} satisfies BtpSiInputs,
	classico: {
		mag28: {
			tassoReale: 0.02,
			prezzoMot: 101.83,
			anniResidui: 1.8
		} satisfies BtpClassicoInputs,
		giu30: {
			tassoReale: 0.016,
			prezzoMot: 101.86,
			anniResidui: 4
		} satisfies BtpClassicoInputs
	},
	valore: {
		cedola1: 0.026,
		cedola2: 0.032,
		cedola3: 0.038,
		premio: 0.008,
		durata: 6,
		tassazione: 0.125,
		inflazione: 0.02,
		prezzoMot: 99.03
	} satisfies BtpValoreInputs,
	futura: {
		cedola1: 0.0075,
		cedola2: 0.0135,
		cedola3: 0.017,
		prezzoMot: 86.6
	} satisfies BtpFuturaParams,
	nominali: {
		'2y': 0.028,
		'3y': 0.029,
		'5y': 0.0313,
		'7y': 0.0344,
		'10y': 0.0374
	},
	scenariInflazione: [0.01, 0.02, 0.03, 0.045]
};
// <<< AUTO-GENERATED
