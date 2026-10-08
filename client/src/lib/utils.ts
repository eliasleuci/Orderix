import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind classes safely using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Número de orden visible: el mismo que sale impreso en el ticket (3 dígitos mínimo). */
export function formatTicketNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '---';
  return String(n).padStart(3, '0');
}
