/**
 * Cottonfall FX — Atmospheric Fog
 *
 * Uses the free FXMaster particle effects API.
 */

const FOG_ID = "cottonfall_fog";

const FOG_OPTIONS = {
  belowTokens: false,
  belowTiles: false,
  belowForeground: false,

  tint: {
    apply: false,
    value: "#FFFFFF"
  },

  soundFxEnabled: false,
  direction: 180,
  synchronizedDirection: false,

  scale: 0.27,
  speed: 0.27,
  lifetime: 0.27,
  density: 0.20,
  alpha: 0.4,

  darknessActivationEnabled: false,
  darknessActivationRange: {
    min: 0,
    max: 1
  }
};

export class CottonfallFog {

  static async start() {
    if (!game.user?.isGM) return;

    const fx = globalThis.FXMASTER?.api?.effects;

    if (!fx) {
      ui.notifications.warn("Cottonfall FX: FXMaster is unavailable.");
      return;
    }

    try {
      const result = await fx.play({
        particles: [{
          id: FOG_ID,
          type: "fog",
          options: foundry.utils.deepClone(FOG_OPTIONS)
        }]
      });

      console.log("Cottonfall FX | Fog started", result);
    } catch (err) {
      console.error("Cottonfall FX | Fog start failed", err);
    }
  }

  static async stop() {
    if (!game.user?.isGM) return;

    const fx = globalThis.FXMASTER?.api?.effects;

    if (!fx) return;

    try {
      await fx.stop({
        particles: [FOG_ID]
      });

      console.log("Cottonfall FX | Fog stopped");
    } catch (err) {
      console.error("Cottonfall FX | Fog stop failed", err);
    }
  }
}
