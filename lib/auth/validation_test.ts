import { assertEquals } from "jsr:@std/assert@1";
import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  isValidAccountPassword,
  passwordsMatch,
} from "./validation.ts";

Deno.test("accepts passwords at the minimum and maximum limits", () => {
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MIN_LENGTH)), true);
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MAX_LENGTH)), true);
});

Deno.test("rejects passwords shorter than the minimum or longer than the maximum", () => {
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MIN_LENGTH - 1)), false);
  assertEquals(isValidAccountPassword("a".repeat(ACCOUNT_PASSWORD_MAX_LENGTH + 1)), false);
  assertEquals(isValidAccountPassword(""), false);
});

Deno.test("password confirmation uses exact matching", () => {
  assertEquals(passwordsMatch("CorrectHorseBattery!", "CorrectHorseBattery!"), true);
  assertEquals(passwordsMatch("CorrectHorseBattery!", "correcthorsebattery!"), false);
  assertEquals(passwordsMatch(" password ", "password"), false);
});
