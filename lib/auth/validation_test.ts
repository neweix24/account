import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  isValidAccountPassword,
  passwordsMatch,
} from "./validation.ts";

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("accepts passwords at the minimum and maximum limits", () => {
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MIN_LENGTH)), true, "minimum length");
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MAX_LENGTH)), true, "maximum length");
});

Deno.test("rejects passwords shorter than the minimum or longer than the maximum", () => {
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MIN_LENGTH - 1)), false, "below minimum");
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MAX_LENGTH + 1)), false, "above maximum");
  assertEquals(isValidAccountPassword(""), false, "empty password");
});

Deno.test("password confirmation uses exact matching", () => {
  assertEquals(passwordsMatch("CorrectHorseBattery!", "CorrectHorseBattery!"), true, "matching passwords");
  assertEquals(passwordsMatch("CorrectHorseBattery!", "correcthorsebattery!"), false, "case mismatch");
  assertEquals(passwordsMatch(" password ", "password"), false, "whitespace mismatch");
});
