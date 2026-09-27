import { describe, expect, it } from "vitest";
import { createLock, deriveKey, isSealed, passwordProblem, seal, unlock, unseal, KDF_ITERATIONS } from "./lock";

const FAST = 1000; // iterations for tests; the app uses KDF_ITERATIONS

describe("password lock", () => {
  it("uses a strong default work factor", () => {
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("right password unlocks, wrong one doesn't", async () => {
    const { meta, key } = await createLock("copper-lathe-rainy-orbit", FAST);
    expect(meta.iterations).toBe(FAST);
    const again = await unlock(meta, "copper-lathe-rainy-orbit");
    expect(again).not.toBeNull();
    // the re-derived key reads what the original key sealed
    expect(await unseal(again!, await seal(key, { a: 1 }))).toEqual({ a: 1 });
    expect(await unlock(meta, "copper-lathe-rainy-orbiT")).toBeNull();
    expect(await unlock(meta, "")).toBeNull();
  });

  it("each lock gets its own salt, so the same password gives a different key", async () => {
    const a = await createLock("same password here", FAST), b = await createLock("same password here", FAST);
    expect(a.meta.salt).not.toBe(b.meta.salt);
    await expect(unseal(b.key, await seal(a.key, "x"))).rejects.toThrow();
  });

  it("seal hides the content, uses a fresh IV, and detects tampering", async () => {
    const key = await deriveKey("pw-for-test-123", new Uint8Array(16), FAST);
    const s1 = await seal(key, { name: "Pump P-101A" }), s2 = await seal(key, { name: "Pump P-101A" });
    expect(isSealed(s1)).toBe(true);
    expect(JSON.stringify(s1)).not.toContain("P-101A");
    expect(s1.iv).not.toBe(s2.iv);
    expect(s1.ct).not.toBe(s2.ct);
    const bytes = Uint8Array.from(atob(s1.ct), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    await expect(unseal(key, { iv: s1.iv, ct: btoa(String.fromCharCode(...bytes)) })).rejects.toThrow();
  });

  it("password rules", () => {
    expect(passwordProblem("short", "short")).toMatch(/at least 10/);
    expect(passwordProblem("aaaaaaaaaaaa", "aaaaaaaaaaaa")).toMatch(/too easy/);
    expect(passwordProblem("copper-lathe-rainy", "copper-lathe-rainy!")).toMatch(/don't match/);
    expect(passwordProblem("copper-lathe-rainy", "copper-lathe-rainy")).toBeNull();
  });
});
