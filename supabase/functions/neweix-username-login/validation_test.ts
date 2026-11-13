import { isEmailIdentifier } from "./validation.ts";

Deno.test("recognizes valid email identifiers", () => {
  for (const email of ["user@example.com", "first.last+tag@example.co.uk", "a_s@sub.example.org"]) {
    if (!isEmailIdentifier(email)) throw new Error(`Expected valid email: ${email}`);
  }
});

Deno.test("does not classify usernames or malformed emails as email", () => {
  for (const value of ["neweix_user", "first last@example.com", "user@", "@example.com", "user@example"]) {
    if (isEmailIdentifier(value)) throw new Error(`Expected non-email identifier: ${value}`);
  }
});
