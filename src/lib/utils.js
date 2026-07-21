import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function validatePassword(password) {
  if (!password) return null;
  if (password.length < 6) return "Password minimal 6 karakter.";
  if (!/[a-z]/.test(password)) return "Password harus mengandung huruf kecil.";
  if (!/[A-Z]/.test(password)) return "Password harus mengandung huruf besar.";
  if (!/[0-9]/.test(password)) return "Password harus mengandung angka.";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password harus mengandung karakter spesial.";
  return null;
}