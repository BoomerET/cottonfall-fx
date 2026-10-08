
/**
 * Cottonfall FX — Power Flicker
 *
 * An unsettling electrical disturbance:
 * cold flickers, reality distortion, brownout,
 * and a final glitch.
 */

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

export class CottonfallPowerFlicker {
  static running = false;

  static async play() {
    if (!game.user?.isGM) {
      ui.notifications.warn("Only the GM can trigger Power Flicker.");
      return;
    }

    if (this.running) {
      ui.notifications.info("Power Flicker is already running.");
      return;
    }

    const fx = globalThis.FXMASTER?.api?.effects;
    const cf = globalThis.CottonfallFX;

    if (!fx || !cf) {
      ui.notifications.warn("Power Flicker requires FXMaster and Cottonfall FX.");
      return;
    }

    this.running = true;
    let activeIds = [];

    const clearColor = async () => {
      if (!activeIds.length) return;

      const ids = activeIds;
      activeIds = [];

      await fx.stop({
        filters: ids,
        skipFading: true
      });
    };

    const colorPulse = async (brightness, duration) => {
      await clearColor();

      const result = await fx.play({
        filters: [{
          type: "color",
          options: {
            color: {
              apply: true,
              value: "#9ab8e8"
            },
            saturation: 0.45,
            brightness,
            contrast: 1.15,
            gamma: 1.0
          }
        }],
        skipFading: true
      });

      activeIds = result.filters ?? [];

      await sleep(duration);
      await clearColor();
    };

    try {
      console.log("Cottonfall FX | Power Flicker starting");

      // First warning
      await sleep(600);
      await colorPulse(0.75, 350);

      // Apparent normality
      await sleep(1100);

      // Reality begins slipping
      await Promise.all([
        colorPulse(0.60, 450),
        cf.fullBreak(450)
      ]);

      // Uneasy silence
      await sleep(850);

      // Power nearly fails
      await colorPulse(0.18, 900);

      // Final disturbance
      await sleep(300);
      await cf.fullBreak(250);

      console.log("Cottonfall FX | Power Flicker complete");

    } catch (err) {
      console.error("Cottonfall FX | Power Flicker failed", err);
      ui.notifications.error("Power Flicker encountered an error.");

    } finally {
      try {
        await clearColor();
      } catch (err) {
        console.error("Cottonfall FX | Power Flicker cleanup failed", err);
      }

      this.running = false;
    }
  }
}
