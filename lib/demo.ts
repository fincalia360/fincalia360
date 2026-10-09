/**
 * Herramientas de demostración (crear leads ficticios, restablecer datos demo).
 * Solo en desarrollo local: nunca en producción ni cuando SEED_DEMO_DATA=false (web publicada).
 */
export function demoToolsEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA !== "false";
}
