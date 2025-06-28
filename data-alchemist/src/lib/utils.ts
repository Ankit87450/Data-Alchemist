import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isFieldMissing<T>(obj: T, field: keyof T): boolean {
  return obj[field] === undefined || obj[field] === null;
}
