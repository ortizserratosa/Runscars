import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
} from "../../src/lib/auth/validation";

describe("auth validation", () => {
  it("requires twelve characters for new passwords", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(
      signUpSchema.safeParse({
        displayName: "Ada",
        email: "ada@example.com",
        password: "short-pass",
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        displayName: "Ada",
        email: "ada@example.com",
        password: "long-enough-pass",
      }).success,
    ).toBe(true);
  });

  it("does not block existing accounts from signing in", () => {
    expect(
      signInSchema.safeParse({
        email: "ada@example.com",
        password: "legacy8",
      }).success,
    ).toBe(true);
  });
});
