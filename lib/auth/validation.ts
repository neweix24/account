/**
 * Shared password policy for signup, recovery, and authenticated password changes.
 * Keep the limit aligned across every Account password entry point.
 */
export const ACCOUNT_PASSWORD_MIN_LENGTH = 12;
export const ACCOUNT_PASSWORD_MAX_LENGTH = 128;

export function isValidAccountPassword(password: string): boolean {
  return password.length >= ACCOUNT_PASSWORD_MIN_LENGTH &&
    password.length <= ACCOUNT_PASSWORD_MAX_LENGTH;
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}
