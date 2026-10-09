import { describe, expect, it } from "vitest";
import { rankAgencies, type AgencyLike } from "@/services/agencyService";
import { calculateEconomics } from "@/services/economicsService";
import { valuationSchema } from "@/lib/validation";

const agencies: AgencyLike[] = [
  { id: "a", name: "Roses FR", zones: "ROSES,CADAQUES", languages: "es,fr", propertyTypes: "APARTMENT,VILLA", status: "ACTIVE", leadCount: 5 },
  { id: "b", name: "Canal DE", zones: "EMPURIABRAVA,ROSES", languages: "es,de,nl", propertyTypes: "HOUSE,VILLA", status: "ACTIVE", leadCount: 1 },
  { id: "c", name: "Pausada", zones: "ROSES", languages: "de", propertyTypes: "VILLA", status: "PAUSED", leadCount: 0 },
];

describe("assignLeadToAgency → rankAgencies", () => {
  it("prioriza zona + tipo + idioma y excluye agencias pausadas", () => {
    const ranked = rankAgencies({ location: "ROSES", propertyType: "VILLA", language: "de" }, agencies);
    expect(ranked.map((r) => r.agency.id)).toEqual(["b", "a"]);
    expect(ranked[0].reasons.length).toBe(3);
  });

  it("desempata por menor número de leads", () => {
    const ranked = rankAgencies({ location: "ROSES", propertyType: "VILLA", language: "es" }, agencies);
    expect(ranked[0].agency.id).toBe("b");
  });
});

describe("calculadora económica", () => {
  it("reproduce el ejemplo del proyecto: 1000 € / 20 € ≈ 50 leads → 7-8 citas", () => {
    const r = calculateEconomics({
      adBudget: 1000,
      toolsCost: 300,
      cpl: 20,
      leadToAppointment: 0.15,
      appointmentToOpportunity: 0.4,
      pricePerAppointment: 150,
      agencies: 0,
      monthlyFee: 0,
    });
    expect(r.leads).toBe(50);
    expect(r.appointments).toBeCloseTo(7.5);
    expect(r.totalCost).toBe(1300);
    expect(r.revenue).toBeCloseTo(1125);
    expect(r.margin).toBeCloseTo(-175);
    expect(r.breakEvenAppointments).toBeCloseTo(1300 / 150);
  });
});

describe("validación del formulario", () => {
  const valid = {
    location: "ROSES",
    type: "APARTMENT",
    timeline: "NOW",
    situation: "PRIMARY",
    name: "Ana Demo",
    email: "ana@example.com",
    language: "es",
    consentContact: true,
    consentMarketing: false,
  };

  it("acepta un lead con consentimiento", () => {
    expect(valuationSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza un lead sin consentimiento de contacto", () => {
    expect(valuationSchema.safeParse({ ...valid, consentContact: false }).success).toBe(false);
  });
});
