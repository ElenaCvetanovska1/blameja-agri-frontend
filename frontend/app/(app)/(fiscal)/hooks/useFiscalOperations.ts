'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiscalBridgeError, fiscalCash, fiscalErrorMessage, fiscalReports } from 'app/lib/fiscal-bridge';

/**
 * Печатењето на извештај трае — ако одговорот истече (TIMEOUT_READING), извештајот
 * најверојатно СЕ печати. Тоа го прикажуваме како предупредување, не како грешка.
 */
function reportErrorToast(prefix: string, err: unknown) {
	if (err instanceof FiscalBridgeError && err.errorStatus === 'TIMEOUT_READING') {
		toast.warning(`${prefix}: уредот не одговори во предвиденото време, но извештајот најверојатно се печати — провери ја касата.`);
		return;
	}
	toast.error(`${prefix}: ${fiscalErrorMessage(err)}`);
}

export const useFiscalOperations = () => {
	const readDailySums = useMutation({
		mutationFn: fiscalReports.getDailySums,
		onError: (err) => reportErrorToast('Состојба (тековен промет)', err),
	});

	const printX = useMutation({
		mutationFn: fiscalReports.printX,
		onSuccess: () => toast.success('X извештај (контролен) испечатен.'),
		onError: (err) => reportErrorToast('X извештај', err),
	});

	const printZ = useMutation({
		mutationFn: fiscalReports.printZ,
		onSuccess: () => toast.success('Z извештај испечатен — денот е затворен.'),
		onError: (err) => reportErrorToast('Z извештај', err),
	});

	const printFmDate = useMutation({
		mutationFn: fiscalReports.printFmDate,
		onSuccess: (_res, input) =>
			toast.success(`${input.detailed ? 'Детален' : 'Краток'} ФМ извештај (${input.from} — ${input.to}) испечатен.`),
		onError: (err) => reportErrorToast('ФМ извештај', err),
	});

	const cashIn = useMutation({
		mutationFn: (amount: number) => fiscalCash.cashIn(amount),
		onSuccess: (_res, amount) => toast.success(`Готово влезно: ${amount.toFixed(2)} ден. регистрирано.`),
		onError: (err) => reportErrorToast('Готово влезно', err),
	});

	const cashOut = useMutation({
		mutationFn: (amount: number) => fiscalCash.cashOut(amount),
		onSuccess: (_res, amount) => toast.success(`Готово излезно: ${amount.toFixed(2)} ден. регистрирано.`),
		onError: (err) => reportErrorToast('Готово излезно', err),
	});

	return { readDailySums, printX, printZ, printFmDate, cashIn, cashOut };
};
