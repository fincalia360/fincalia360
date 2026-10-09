// Calculadora económica (función pura). Se usa en /admin/economics y en los tests.

export interface EconomicsInput {
  adBudget: number;
  toolsCost: number;
  cpl: number;
  leadToAppointment: number; // 0-1
  appointmentToOpportunity: number; // 0-1
  pricePerAppointment: number;
  agencies: number;
  monthlyFee: number;
}

export interface EconomicsResult {
  leads: number;
  appointments: number;
  opportunities: number;
  totalCost: number;
  revenueAppointments: number;
  revenueFees: number;
  revenue: number;
  margin: number;
  marginPct: number | null;
  costPerAppointment: number | null;
  /** Citas necesarias al precio actual para cubrir costes (descontando cuotas). */
  breakEvenAppointments: number | null;
  /** Precio por cita necesario con el volumen actual. */
  breakEvenPricePerAppointment: number | null;
  /** CPL máximo que se puede pagar sin perder dinero. */
  breakEvenCpl: number | null;
}

export function calculateEconomics(input: EconomicsInput): EconomicsResult {
  const leads = input.cpl > 0 ? input.adBudget / input.cpl : 0;
  const appointments = leads * input.leadToAppointment;
  const opportunities = appointments * input.appointmentToOpportunity;
  const totalCost = input.adBudget + input.toolsCost;
  const revenueAppointments = appointments * input.pricePerAppointment;
  const revenueFees = input.agencies * input.monthlyFee;
  const revenue = revenueAppointments + revenueFees;
  const margin = revenue - totalCost;
  const toCover = Math.max(0, totalCost - revenueFees);

  return {
    leads,
    appointments,
    opportunities,
    totalCost,
    revenueAppointments,
    revenueFees,
    revenue,
    margin,
    marginPct: revenue > 0 ? margin / revenue : null,
    costPerAppointment: appointments > 0 ? totalCost / appointments : null,
    breakEvenAppointments: input.pricePerAppointment > 0 ? toCover / input.pricePerAppointment : toCover === 0 ? 0 : null,
    breakEvenPricePerAppointment: appointments > 0 ? toCover / appointments : null,
    breakEvenCpl:
      totalCost - revenueFees > 0 ? (input.adBudget * input.leadToAppointment * input.pricePerAppointment) / (totalCost - revenueFees) : null,
  };
}
