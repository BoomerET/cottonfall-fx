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
  static FLAG = "activeFogId";

  static getActiveId() {
    const scene = canvas?.scene;
    if (!scene) return null;

    const id = scene.getFlag("cottonfall-fx", this.FLAG);
    if (!id) return null;

    const effects = scene.getFlag("fxmaster", "effects") ?? {};

    return Object.hasOwn(effects, id) ? id : null;
  }

  static async start() {
    if (!game.user?.isGM) return;

    const scene = canvas?.scene;
    const fx = globalThis.FXMASTER?.api?.effects;

    if (!scene || !fx) {
      ui.notifications.warn("Cottonfall FX: Scene or FXMaster unavailable.");
      return;
    }

    if (this.getActiveId()) {
      console.log("Cottonfall FX | Fog already active");
      return;
    }

    try {
      const result = await fx.play({
        particles: [{
          type: "fog",
          options: foundry.utils.deepClone(FOG_OPTIONS)
        }]
      });

      const id = result?.particles?.[0];

      if (!id) {
        throw new Error("FXMaster did not return a particle ID");
      }

      await scene.setFlag("cottonfall-fx", this.FLAG, id);

      console.log("Cottonfall FX | Fog started:", id);
    } catch (err) {
      console.error("Cottonfall FX | Fog start failed", err);
      ui.notifications.error("Cottonfall FX: Could not start fog.");
    }
  }

  static async stop() {
    if (!game.user?.isGM) return;

    const scene = canvas?.scene;
    const fx = globalThis.FXMASTER?.api?.effects;

    if (!scene || !fx) return;

    const id = this.getActiveId();

    if (!id) {
      console.log("Cottonfall FX | No active Cottonfall fog");
      return;
    }

    try {
      await fx.stop({ particles: [id] });
      await scene.unsetFlag("cottonfall-fx", this.FLAG);

      console.log("Cottonfall FX | Fog stopped:", id);
    } catch (err) {
      console.error("Cottonfall FX | Fog stop failed", err);
      ui.notifications.error("Cottonfall FX: Could not clear fog.");
    }
  }
}
