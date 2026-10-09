import { describe, expect, it } from "vitest";
import { calculateScore, intentFromTimeline, tierFor } from "@/services/scoringService";
import { estimateValue } from "@/services/valuationService";

describe("scoringService", () => {
  it("aplica los puntos del enunciado y explica cada partida", () => {
    const result = calculateScore({
      timeline: "NOW",
      estimatedValue: 650_000,
      propertyType: "VILLA",
      situation: "TOURIST",
      hasPhone: true,
      hasEmail: true,
    });
    // 40 (ahora) + 20 (≥500k) + 10 (villa) + 10 (turística) + 5 (tel) + 3 (email)
    expect(result.score).toBe(88);
    expect(result.tier).toBe("HOT");
    expect(result.breakdown.map((b) => b.points)).toEqual([40, 20, 10, 10, 5, 3]);
  });

  it("lead frío: solo información, valor bajo, sin teléfono", () => {
    const result = calculateScore({
      timeline: "INFO_ONLY",
      estimatedValue: 120_000,
      propertyType: "APARTMENT",
      situation: "PRIMARY",
      hasPhone: false,
      hasEmail: true,
    });
    expect(result.score).toBe(0 + 5 + 5 + 0 + 3);
    expect(result.tier).toBe("LOW");
  });

  it("bandas de valor", () => {
    const base = { timeline: "LATER" as const, propertyType: "OTHER" as const, situation: "PRIMARY" as const, hasPhone: false, hasEmail: false };
    expect(calculateScore({ ...base, estimatedValue: 500_000 }).score).toBe(5 + 20);
    expect(calculateScore({ ...base, estimatedValue: 300_000 }).score).toBe(5 + 15);
    expect(calculateScore({ ...base, estimatedValue: 150_000 }).score).toBe(5 + 10);
    expect(calculateScore({ ...base, estimatedValue: 149_999 }).score).toBe(5 + 5);
  });

  it("interés en cita suma +5", () => {
    const base = { timeline: "M3_6" as const, estimatedValue: 200_000, propertyType: "HOUSE" as const, situation: "INHERITED" as const, hasPhone: true, hasEmail: true };
    expect(calculateScore({ ...base, appointmentInterest: true }).score - calculateScore(base).score).toBe(5);
  });

  it("umbrales de clasificación", () => {
    expect(tierFor(0)).toBe("LOW");
    expect(tierFor(29)).toBe("LOW");
    expect(tierFor(30)).toBe("MEDIUM");
    expect(tierFor(59)).toBe("MEDIUM");
    expect(tierFor(60)).toBe("HIGH");
    expect(tierFor(79)).toBe("HIGH");
    expect(tierFor(80)).toBe("HOT");
  });

  it("intención derivada del plazo", () => {
    expect(intentFromTimeline("NOW")).toBe("HIGH");
    expect(intentFromTimeline("M1_3")).toBe("HIGH");
    expect(intentFromTimeline("M6_12")).toBe("MEDIUM");
    expect(intentFromTimeline("INFO_ONLY")).toBe("LOW");
  });
});

describe("valuationService (demo)", () => {
  it("devuelve una horquilla coherente", () => {
    const v = estimateValue({ location: "EMPURIABRAVA", type: "APARTMENT", sqm: 80, pool: true });
    expect(v.min).toBeLessThan(v.max);
    expect(v.mid).toBeGreaterThan(v.min);
    expect(v.mid).toBeLessThan(v.max);
    expect(v.min % 5000).toBe(0);
  });

  it("una villa en Cadaqués vale más que un apartamento en Figueres", () => {
    const villa = estimateValue({ location: "CADAQUES", type: "VILLA", sqm: 200 });
    const flat = estimateValue({ location: "FIGUERES", type: "APARTMENT", sqm: 200 });
    expect(villa.mid).toBeGreaterThan(flat.mid * 2);
  });
});
