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
	return (1 + rendimentoNettoNominale) / (1 + i.inflazione) - 1;
}

/**
 * BTP nominale — rendimento REALE netto annuo in scenario inflazione.
 */
export function btpNominaleRealeNetto(i: BtpNominaleInputs, inflazione: number): number {
	const netto = i.rendimentoLordo * (1 - i.tassazione);
	return (1 + netto) / (1 + inflazione) - 1;
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
// last_synced: 2026-06-10T18:02:52+00:00  stato: placeholder
export const DEFAULT_PARAMS = {
	_meta: {
		stato: 'placeholder',
		dataAnnuncioMef: '2026-06-12',
		dataEmissioneInizio: '2026-06-15',
		dataEmissioneFine: '2026-06-19',
		isinSi: 'TBD',
		ultimoAggiornamento: '2026-06-10'
	} satisfies BtpMeta,
	si: {
		tassoFissoReale: 0.018,
		premioFedelta: 0.006,
		durata: 5,
		tassazione: 0.125,
		capitale: 10000,
		inflazione: 0.02
	} satisfies BtpSiInputs,
	classico: {
		mag28: {
			tassoReale: 0.02,
			prezzoMot: 101.97,
			anniResidui: 1.8
		} satisfies BtpClassicoInputs,
		giu30: {
			tassoReale: 0.016,
			prezzoMot: 101.92,
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
		inflazione: 0.02
	} satisfies BtpValoreInputs,
	nominali: {
		'2y': 0.022,
		'3y': 0.024,
		'5y': 0.029,
		'7y': 0.0315,
		'10y': 0.0345
	},
	scenariInflazione: [0.01, 0.02, 0.03, 0.045]
};
// <<< AUTO-GENERATED
