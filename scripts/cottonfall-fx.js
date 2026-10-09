import { CottonfallGlitch } from "./glitch-filter.js";
import { CottonfallFog } from "./fog.js";
import { CottonfallPowerFlicker } from "./power-flicker.js";
import { CottonfallShadow } from "./shadow-apparition.js";
import { CottonfallEmergencyBroadcast } from "./emergency-broadcast.js";

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
 * Socket channel so the (local, per-client) visual glitch mirrors to every
 * player's screen, not just the GM's. The GM broadcasts a glitch action and
 * every connected client — including the GM — applies it to its own canvas.
 */
const SOCKET = "module.cottonfall-fx";

/*
 * Apply a glitch action to THIS client's canvas. Never emits (no echo loop).
 */
function applyGlitchLocal(data) {
  if (!data || typeof data !== "object") return;
  switch (data.action) {
    case "enable":
      CottonfallGlitch.enable(data.opts || {});
      break;

    case "disable":
      CottonfallGlitch.disable();
      break;

    case "setOptions":
      CottonfallGlitch.setOptions(data.opts || {});
      break;

    case "shadow":
      if (data.sceneId !== canvas.scene?.id) return;
      void CottonfallShadow.play(data).catch(err =>
        console.error("Cottonfall FX | Shadow failed", err)
      );
      return;

    case "emergencyBroadcast":
      CottonfallEmergencyBroadcast.show(data.options ?? {});
      break;

    case "emergencyDismiss":
      CottonfallEmergencyBroadcast.dismiss();
    break;

    default:
      return;
  }
  globalThis.CottonfallFX?._refresh?.();
}

/*
 * Apply here AND tell every other client to do the same.
 * (Foundry's socket.emit does not echo back to the sender.)
 */
function broadcastGlitch(data) {
  applyGlitchLocal(data);
  try {
    game.socket?.emit(SOCKET, data);
  } catch (err) {
    console.error("Cottonfall FX | socket emit failed", err);
  }
}


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
      threeSeventeen: CottonfallFXPanel.#threeSeventeen,
      fogOn: CottonfallFXPanel.#fogOn,
      fogOff: CottonfallFXPanel.#fogOff,
      powerFlicker: CottonfallFXPanel.#powerFlicker,
      shadowPlace: CottonfallFXPanel.#shadowPlace,
      emergencyBroadcast: CottonfallFXPanel.#emergencyBroadcast,
      emergencyDismiss: CottonfallFXPanel.#emergencyDismiss,
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
      glitchActive: !!CottonfallGlitch.active,

      shadowFadeIn: game.settings.get(MODULE_ID, "shadowFadeIn"),
      shadowHold: game.settings.get(MODULE_ID, "shadowHold"),
      shadowFadeOut: game.settings.get(MODULE_ID, "shadowFadeOut")
    };
  }

  static #toggleGlitch() { globalThis.CottonfallFX.glitchToggle(); }
  static #glitchSubtle() { globalThis.CottonfallFX.glitchPreset("subtle"); }
  static #glitchVHS() { globalThis.CottonfallFX.glitchPreset("vhs"); }
  static #glitchHard() { globalThis.CottonfallFX.glitchPreset("hard"); }
  static async #realityLurch() { await globalThis.CottonfallFX.realityLurch(); }
  static async #fullBreak() { await globalThis.CottonfallFX.fullBreak(); }
  static async #threeSeventeen() { await globalThis.CottonfallFX.threeSeventeen(); }
  static #fogOn() { return globalThis.CottonfallFX?.fogOn(); }
  static #fogOff() { return globalThis.CottonfallFX?.fogOff(); }
  static #powerFlicker() { return globalThis.CottonfallFX?.powerFlicker(); }
  static async #shadowPlace(event, button) {
    const panel = button.closest(".cottonfall-fx-panel");

    const readSeconds = (name, fallback) => {
      const input = panel?.querySelector(`[name="${name}"]`);
      const value = Number(input?.value);

      if (!input || !Number.isFinite(value)) return fallback;

      // Restrict values to 1–30 whole seconds.
      return Math.round(Math.max(1, Math.min(30, value)));
    };

    const fadeIn = readSeconds("shadowFadeIn", 4);
    const hold = readSeconds("shadowHold", 6);
    const fadeOut = readSeconds("shadowFadeOut", 5);

    // Save the GM's preferred timings in seconds.
    await Promise.all([
      game.settings.set(MODULE_ID, "shadowFadeIn", fadeIn),
      game.settings.set(MODULE_ID, "shadowHold", hold),
      game.settings.set(MODULE_ID, "shadowFadeOut", fadeOut)
    ]);

    // The apparition animation expects milliseconds.
    return globalThis.CottonfallFX?.placeShadow({
      fadeIn: fadeIn * 1000,
      hold: hold * 1000,
      fadeOut: fadeOut * 1000
    });
  }
  static #emergencyBroadcast(event, button) {
    const panel = button.closest(".cottonfall-fx");

    if (!panel) {
      console.error("Cottonfall FX | Emergency panel not found.");
      return;
    }

    const title = panel.querySelector(
      '[name="emergencyTitle"]'
    )?.value.trim() || "SHELTER IN PLACE";

    const message = panel.querySelector(
      '[name="emergencyMessage"]'
    )?.value || "";

    const rawDuration = Number(
      panel.querySelector('[name="emergencyDuration"]')?.value
    );

    const duration = Number.isFinite(rawDuration)
      ? Math.max(0, Math.min(300, Math.round(rawDuration)))
      : 15;

    return globalThis.CottonfallFX?.broadcastEmergency({
      title,
      message,
      duration
    });
  }

  static #emergencyDismiss() {
    return globalThis.CottonfallFX?.dismissEmergency();
  }
}

/*
 * Register our control after FXMaster has established the Effects group.
 */
Hooks.once("init", () => {
    // Something in the Fog — GM timing preferences
    const shadowSettings = {
      shadowFadeIn: 4,
      shadowHold: 6,
      shadowFadeOut: 5
    };

    for (const [key, defaultValue] of Object.entries(shadowSettings)) {
      game.settings.register(MODULE_ID, key, {
        name: key,
        scope: "client",
        config: false,
        type: Number,
        default: defaultValue
      });
    }
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
  // Every client (GM and players) listens for glitch broadcasts.
  game.socket.on(SOCKET, applyGlitchLocal);

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

    glitchToggle() {
      // Decide the resulting state here, then broadcast an explicit enable/disable
      // so every client converges to the same thing (rather than each toggling).
      const willEnable = !CottonfallGlitch.active;
      broadcastGlitch(willEnable ? { action: "enable", opts: {} } : { action: "disable" });
      this._refresh();
    },

    glitchOn(opts = {}) {
      broadcastGlitch({ action: "enable", opts });
    },

    glitchOff() {
      broadcastGlitch({ action: "disable" });
    },

    /*
     * Apply a strength preset and ensure the glitch is on — on every screen.
     */
    glitchPreset(name) {
      const preset = GLITCH_PRESETS[name] ?? GLITCH_PRESETS.vhs;
      broadcastGlitch({ action: "enable", opts: preset });
    },

    setGlitch(opts = {}) {
      broadcastGlitch({ action: "setOptions", opts });
    },

    async fogOn() {
      await CottonfallFog.start();
    },

    async fogOff() {
      await CottonfallFog.stop();
    },

    /* ---------------- Power Flicker ---------------- */

    async powerFlicker() {
      await CottonfallPowerFlicker.play();
    },

    /* ---------------- Something in the Fog ---------------- */
    async shadowAt(x, y, options = {}) {
      if (!game.user?.isGM) {
        ui.notifications.warn(
          "Cottonfall FX | Only a GM can trigger an apparition."
        );
        return;
      }
    
      if (!canvas?.ready || !canvas.scene) return;
    
      const data = {
        action: "shadow",
        sceneId: canvas.scene.id,
        x,
        y,
        ...options
      };
    
      // Foundry sockets don't echo to the sender.
      // Play locally on the GM screen.
      void CottonfallShadow.play(data).catch(err =>
        console.error("Cottonfall FX | Local shadow failed", err)
      );
    
      // Broadcast to connected players.
      game.socket.emit(SOCKET, data);
    },

    /* ---------------- Shadow placement ---------------- */
    placeShadow(options = {}) {
      if (!game.user?.isGM) {
        ui.notifications.warn("Only a GM can place an apparition.");
        return;
      }
    
      if (!canvas?.ready) {
        ui.notifications.warn("The canvas isn't ready.");
        return;
      }
    
      // Cancel any previous placement attempt.
      this.cancelShadowPlacement?.();
    
      const stage = canvas.stage;
      const previousEventMode = stage.eventMode;
    
      const onPointerDown = (event) => {
        // Ignore right-clicks.
        if (event.button !== 0) return;
      
        const point = event.getLocalPosition(stage);
      
        this.cancelShadowPlacement();
      
        void this.shadowAt(point.x, point.y, options);
      };
    
      this.cancelShadowPlacement = () => {
        stage.off("pointerdown", onPointerDown);
        stage.eventMode = previousEventMode;
        this.cancelShadowPlacement = null;
      };
    
      stage.eventMode = "static";
      stage.on("pointerdown", onPointerDown);
    
      ui.notifications.info(
        "Something in the Fog: Click the map to place the apparition."
      );
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

      this.glitchOn({ intensity: 0.85, speed: 3.0, rgbSplit: 0.7, blockiness: 0.85, scanlines: 0.3 });
      const lurch = this.realityLurch(duration);
      await sleep(duration);
      await lurch;

      if (wasActive) this.glitchOn(prev);
      else this.glitchOff();
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
    },

    /* ---------------- Emergency Broadcast ---------------- */
    broadcastEmergency(options = {}) {
      if (!game.user.isGM) return;

      // Display immediately on the GM's screen.
      CottonfallEmergencyBroadcast.show(options);

      // Send the same announcement to connected players.
      game.socket.emit(SOCKET, {
        action: "emergencyBroadcast",
        options
      });
    },

    dismissEmergency() {
      if (!game.user.isGM) return;

      CottonfallEmergencyBroadcast.dismiss();

      game.socket.emit(SOCKET, {
        action: "emergencyDismiss"
      });
    },

  };

  // Temporary Emergency Broadcast test API
  globalThis.CottonfallEmergency = CottonfallEmergencyBroadcast;
  console.log(`${MODULE_ID} | ready. GM API: CottonfallFX.*  |  Glitch API: CottonfallGlitch.*`);
});
