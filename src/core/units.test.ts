import { describe, expect, it } from "vitest";
import { convertText, inToLen, lenToIn, smallToThou, thouToSmall } from "./units";

describe("units", () => {
  it("round-trips lengths and displacements", () => {
    expect(lenToIn(inToLen(12.5, "met"), "met")).toBeCloseTo(12.5);
    expect(smallToThou(thouToSmall(3.3, "met"), "met")).toBeCloseTo(3.3);
    expect(inToLen(1, "met")).toBe(25.4);
    expect(thouToSmall(1, "met")).toBeCloseTo(0.0254);
    expect(inToLen(7, "imp")).toBe(7);
  });

  it("convertText rescales numbers and leaves junk alone", () => {
    expect(convertText("6", 25.4, 2)).toBe("152.4");
    expect(convertText("55.8", 0.0254, 3)).toBe("1.417");
    expect(convertText("", 25.4, 2)).toBe("");
    expect(convertText("-", 25.4, 2)).toBe("-");
  });
});
