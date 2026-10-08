
export class CottonfallShadow {
  static IMAGE = "modules/cottonfall-fx/images/shadow.png";

  static DEFAULTS = {
    fadeIn: 4000,
    hold: 6000,
    fadeOut: 5000,
    opacity: 0.55,
    height: 2
  };

  static active = null;

  static async play(data = {}) {
    if (!canvas?.ready) return;

    if (data.sceneId && data.sceneId !== canvas.scene?.id) return;

    const opts = { ...this.DEFAULTS, ...data };

    // Remove an earlier apparition if one is still present.
    this.stop();

    const texture = await foundry.canvas.loadTexture(this.IMAGE);
    if (!texture) {
      console.error("Cottonfall FX | Shadow texture unavailable");
      return;
    }

    const shadow = new PIXI.Sprite(texture);
    shadow.anchor.set(0.5, 1);
    shadow.scale.set(
      (canvas.grid.size * opts.height) / texture.height
    );

    shadow.position.set(opts.x, opts.y);
    shadow.alpha = 0;

    canvas.stage.addChild(shadow);
    this.active = shadow;

    const fade = (from, to, duration) =>
      new Promise(resolve => {
        const start = performance.now();

        const frame = now => {
          if (shadow.destroyed || this.active !== shadow) {
            resolve();
            return;
          }

          const t = Math.min((now - start) / duration, 1);
          const eased = t * t * (3 - 2 * t);

          shadow.alpha = from + (to - from) * eased;

          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };

        requestAnimationFrame(frame);
      });

    try {
      await fade(0, opts.opacity, opts.fadeIn);

      await new Promise(resolve =>
        setTimeout(resolve, opts.hold)
      );

      if (this.active !== shadow) return;

      await fade(opts.opacity, 0, opts.fadeOut);
    } finally {
      if (this.active === shadow) {
        this.stop();
      }
    }
  }

  static stop() {
    if (this.active && !this.active.destroyed) {
      this.active.destroy();
    }

    this.active = null;
  }
}
