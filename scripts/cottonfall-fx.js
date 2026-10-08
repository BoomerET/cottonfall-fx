const MODULE_ID = "cottonfall-fx";

const REALITY_COLOR_ID = "cottonfall_reality_color";
const REALITY_SHAKE_ID = "cottonfall_reality_shake";

let realityGlitchTimer = null;


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
      width: 400,
      height: "auto"
    },
    actions: {
      realityGlitch: CottonfallFXPanel.#realityGlitch,
      threeSeventeen: CottonfallFXPanel.#threeSeventeen
    }
  };

  static PARTS = {
    main: {
      template: "modules/cottonfall-fx/templates/control-panel.hbs"
    }
  };

  static async #realityGlitch() {
    await globalThis.CottonfallFX.realityGlitch();
  }
  static async #threeSeventeen() {
    await globalThis.CottonfallFX.threeSeventeen();
  }
}


/*
 * Register our control after FXMaster has established
 * the Effects control group.
 */
Hooks.once("init", () => {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tools = controls.effects?.tools;

    if (!tools) {
      console.warn(
        "Cottonfall FX | FXMaster controls are unavailable."
      );
      return;
    }

    tools["cottonfall"] = {
      name: "cottonfall",
      title: "Cottonfall FX",
      icon: "fas fa-bolt",
      order: 60,
      button: true,
      visible: game.user?.isGM,

      onChange: () => {
        globalThis.CottonfallFX?.openPanel();
      }
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
        ui.notifications.warn(
          "Cottonfall FX controls are only available to a GM."
        );
        return;
      }

      if (!this.panel) {
        this.panel = new CottonfallFXPanel();
      }

      this.panel.render(true);
    },


    /*
     * Briefly distort reality using only base FXMaster filters.
     */
    async realityGlitch(duration = 750) {
      if (!game.user.isGM) {
        ui.notifications.warn(
          "Cottonfall FX effects can only be triggered by a GM."
        );
        return;
      }

      const scene = canvas.scene;

      if (!scene) {
        ui.notifications.warn(
          "Cottonfall FX: No active scene."
        );
        return;
      }

      const filters = foundry.utils.deepClone(
        scene.getFlag("fxmaster", "filters") ?? {}
      );


      /*
       * Reality distortion: color shift.
       */
      filters[REALITY_COLOR_ID] = {
        type: "color",
        options: {
          belowTokens: false,
          belowTiles: false,
          belowForeground: false,

          color: {
            apply: true,
            value: "#b8c8ff"
          },

          soundFxEnabled: false,
          blendMode: "color",
          saturation: 0.70,
          contrast: 1.20,
          brightness: 1.15,
          gamma: 1.05,

          darknessActivationEnabled: false,
          darknessActivationRange: {
            min: 0,
            max: 1
          }
        }
      };


      /*
       * Reality distortion: physical screen instability.
       */
      filters[REALITY_SHAKE_ID] = {
        type: "screenShake",
        options: {
          belowTokens: false,
          belowTiles: false,
          belowForeground: false,
          soundFxEnabled: false,

          timed: false,
          strength: 0.18,
          blur: 0.03,
          duration: 1.5,
          speed: 0.85,
          smoothness: 0.25,
          decay: 0.8,
          axis: "both",
          edgeProtection: 0.6,

          audioAware: false,
          audioChannels: [
            "environment"
          ],
          audioBassThreshold: 0.75,

          darknessActivationEnabled: false,
          darknessActivationRange: {
            min: 0,
            max: 1
          }
        }
      };


      /*
       * Apply both Cottonfall filters while preserving any existing
       * FXMaster filters on the scene.
       */
      await scene.setFlag(
        "fxmaster",
        "filters",
        filters
      );


      /*
       * Retriggering Reality Glitch extends the current event rather
       * than allowing an earlier timer to remove the new effect.
       */
      if (realityGlitchTimer) {
        clearTimeout(realityGlitchTimer);
      }


      /*
       * Remove only our Cottonfall filters after the requested duration.
       */
      realityGlitchTimer = setTimeout(async () => {
        realityGlitchTimer = null;

        try {
          await scene.update({
            [`flags.fxmaster.filters.-=${REALITY_COLOR_ID}`]: null,
            [`flags.fxmaster.filters.-=${REALITY_SHAKE_ID}`]: null
          });
        } catch (err) {
          console.error(
            "Cottonfall FX | Failed to remove Reality Glitch",
            err
          );
        }
      }, duration);
    },
    /*
 * The 3:17 Event.
 *
 * Reality begins to lose synchronization in a series of
 * irregular disturbances.
 */
async threeSeventeen() {
  if (!game.user.isGM) {
    ui.notifications.warn(
      "Cottonfall FX effects can only be triggered by a GM."
    );
    return;
  }

  const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  /*
   * Don't make the sequence rhythmically predictable.
   */
  const pause = async (min, max) => {
    const duration =
      Math.floor(Math.random() * (max - min + 1)) + min;

    await sleep(duration);
  };

  /*
   * First disturbance.
   * Just long enough for someone to notice.
   */
  await this.realityGlitch(300);

  await pause(700, 1300);

  /*
   * Second disturbance.
   */
  await this.realityGlitch(500);

  await pause(350, 900);

  /*
   * A quick double-hit.
   */
  await this.realityGlitch(180);

  await pause(150, 350);

  await this.realityGlitch(350);

  await pause(900, 1600);

  /*
   * Final, unmistakable break.
   */
  await this.realityGlitch(900);
}
  };
});

