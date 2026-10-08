import { CottonfallGlitch } from "./glitch-filter.js";

const MODULE_ID = "cottonfall-fx";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/*
 * Visual-glitch strength presets (applied to the shader filter).
 */
const GLITCH_PRESETS = {
  subtle: { intensity: 0.20, speed: 0.5, rgbSplit: 0.25, blockiness: 0.40, scanlines: 0.15 },
  vhs:    { intensity: 0.45, speed: 1.0, rgbSplit: 0.50, blockiness: 0.40, scanlines: 0.50 },
  hard:   { intensity: 0.90, speed: 3.0, rgbSplit: 0.80, blockiness: 0.90, scanlines: 0.30 },
};


/*
 * Cottonfall FX Control Panel
 */
class CottonfallFXPanel extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "cottonfall-fx-panel",
    classes: ["cottonfall-fx"],
    tag: "form",
    window: {
      title: "Cottonfall FX",
      icon: "fas fa-bolt"
    },
    position: {
      width: 420,
      height: "auto"
    },
    actions: {
      toggleGlitch: CottonfallFXPanel.#toggleGlitch,
      glitchSubtle: CottonfallFXPanel.#glitchSubtle,
      glitchVHS: CottonfallFXPanel.#glitchVHS,
      glitchHard: CottonfallFXPanel.#glitchHard,
      realityLurch: CottonfallFXPanel.#realityLurch,
      fullBreak: CottonfallFXPanel.#fullBreak,
      threeSeventeen: CottonfallFXPanel.#threeSeventeen
    }
  };

  static PARTS = {
    main: {
      template: "modules/cottonfall-fx/templates/control-panel.hbs"
    }
  };

  /*
   * Supply the current on/off state of the visual glitch to the template.
   */
  async _prepareContext() {
    return {
      glitchActive: !!CottonfallGlitch.active
    };
  }

  static #toggleGlitch() { globalThis.CottonfallFX.glitchToggle(); }
  static #glitchSubtle() { globalThis.CottonfallFX.glitchPreset("subtle"); }
  static #glitchVHS() { globalThis.CottonfallFX.glitchPreset("vhs"); }
  static #glitchHard() { globalThis.CottonfallFX.glitchPreset("hard"); }
  static async #realityLurch() { await globalThis.CottonfallFX.realityLurch(); }
  static async #fullBreak() { await globalThis.CottonfallFX.fullBreak(); }
  static async #threeSeventeen() { await globalThis.CottonfallFX.threeSeventeen(); }
}


/*
 * Register our control after FXMaster has established the Effects group.
 */
Hooks.once("init", () => {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tools = controls.effects?.tools;

    if (!tools) {
      console.warn("Cottonfall FX | FXMaster controls are unavailable.");
      return;
    }

    tools["cottonfall"] = {
      name: "cottonfall",
      title: "Cottonfall FX",
      icon: "fas fa-bolt",
      order: 60,
      button: true,
      visible: game.user?.isGM,
      onChange: () => globalThis.CottonfallFX?.openPanel()
    };
  });
});


/*
 * Public Cottonfall FX API
 */
Hooks.once("ready", () => {
  globalThis.CottonfallFX = {

    panel: null,

    /*
     * Open the Cottonfall FX control panel.
     */
    openPanel() {
      if (!game.user.isGM) {
        ui.notifications.warn("Cottonfall FX controls are only available to a GM.");
        return;
      }
      if (!this.panel) this.panel = new CottonfallFXPanel();
      this.panel.render(true);
    },

    _refresh() {
      if (this.panel?.rendered) this.panel.render(false);
    },

    /* ---------------- Visual glitch (shader) ---------------- */

    glitchToggle(opts = {}) {
      CottonfallGlitch.toggle(opts);
      this._refresh();
    },

    glitchOn(opts = {}) {
      CottonfallGlitch.enable(opts);
      this._refresh();
    },

    glitchOff() {
      CottonfallGlitch.disable();
      this._refresh();
    },

    /*
     * Apply a strength preset and ensure the glitch is on.
     */
    glitchPreset(name) {
      const preset = GLITCH_PRESETS[name] ?? GLITCH_PRESETS.vhs;
      CottonfallGlitch.enable(preset);
      this._refresh();
    },

    setGlitch(opts = {}) {
      CottonfallGlitch.setOptions(opts);
    },

    /* ---------------- Reality lurch (FXMaster built-ins) ---------------- */

    /*
     * A physical "reality lurches" beat: a cold color shift plus a brief
     * screen shake, composed from FXMaster's built-in filters via the V8
     * Effects API (robust across scene reloads; no direct flag writes).
     */
    async realityLurch(duration = 1500) {
      if (!game.user?.isGM) {
        ui.notifications?.warn("Cottonfall FX effects can only be triggered by a GM.");
        return;
      }

      const fx = globalThis.FXMASTER?.api?.effects;
      if (!fx) {
        ui.notifications?.warn("Cottonfall FX: FXMaster API unavailable (is FXMaster enabled?).");
        return;
      }

      let res;
      try {
        res = await fx.play({
          filters: [
            {
              type: "color",
              options: {
                color: { apply: true, value: "#b8c8ff" },
                saturation: 0.70,
                contrast: 1.20,
                brightness: 1.12,
                gamma: 1.05
              }
            },
            {
              type: "screenShake",
              options: {
                timed: false,        // hold until we remove it
                strength: 0.18,
                blur: 0.03,
                speed: 0.85,
                smoothness: 0.25,
                axis: "both",
                edgeProtection: 0.6
              }
            }
          ],
          skipFading: true
        });
      } catch (err) {
        console.error("Cottonfall FX | reality lurch play failed", err);
        return;
      }

      const ids = Array.isArray(res?.filters) ? res.filters : [];
      await sleep(duration);

      try {
        await fx.stop({ filters: ids, skipFading: true });
      } catch (err) {
        console.error("Cottonfall FX | reality lurch stop failed", err);
      }
    },

    /* ---------------- Full break (both at once) ---------------- */

    /*
     * Fire the visual glitch (hard) and the reality lurch together for a
     * moment, then restore whatever glitch state was running before.
     */
    async fullBreak(duration = 1000) {
      if (!game.user?.isGM) {
        ui.notifications?.warn("Cottonfall FX effects can only be triggered by a GM.");
        return;
      }

      const wasActive = CottonfallGlitch.active;
      const prev = { ...CottonfallGlitch.opts };

      CottonfallGlitch.enable({ intensity: 0.85, speed: 3.0, rgbSplit: 0.7, blockiness: 0.85, scanlines: 0.3 });
      const lurch = this.realityLurch(duration);
      await sleep(duration);
      await lurch;

      if (wasActive) CottonfallGlitch.enable(prev);
      else CottonfallGlitch.disable();
      this._refresh();
    },

    /* ---------------- The 3:17 Event ---------------- */

    /*
     * Reality loses synchronization in a series of irregular disturbances,
     * layering the visual glitch and the physical lurch.
     */
    async threeSeventeen() {
      if (!game.user?.isGM) {
        ui.notifications?.warn("Cottonfall FX effects can only be triggered by a GM.");
        return;
      }

      const pause = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1)) + min);

      await this.fullBreak(300);
      await pause(700, 1300);

      await this.fullBreak(500);
      await pause(350, 900);

      // quick double-hit
      await this.fullBreak(180);
      await pause(150, 350);
      await this.fullBreak(350);
      await pause(900, 1600);

      // final, unmistakable break
      await this.fullBreak(900);
    }
  };

  console.log(`${MODULE_ID} | ready. GM API: CottonfallFX.*  |  Glitch API: CottonfallGlitch.*`);
});
