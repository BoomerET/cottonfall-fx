export class CottonfallEmergencyBroadcast {
  static overlayId = "cottonfall-emergency-broadcast";
  static styleId = "cottonfall-emergency-style";
  static timer = null;

  static show({
    title = "SHELTER IN PLACE",
    message = "All residents are instructed to remain indoors.",
    duration = 15
  } = {}) {
    this.dismiss();

    const overlay = document.createElement("div");
    overlay.id = this.overlayId;

    const terminal = document.createElement("div");
    terminal.className = "cf-terminal";

    // Use textContent for GM-supplied text.
    // This prevents messages from injecting HTML.
    const heading = document.createElement("h1");
    heading.textContent = title;

    const content = document.createElement("p");
    content.className = "cf-message";
    content.textContent = message;

    terminal.innerHTML = `
      <header>
        <span>COTTONFALL EMERGENCY MANAGEMENT</span>
        <span class="cf-status">● SYSTEM ACTIVE</span>
      </header>

      <div class="cf-alert">
        <span>CIVIL EMERGENCY MESSAGE</span>
        <span>CF-0317</span>
      </div>

      <main></main>

      <footer>
        <span>SOURCE: COTTONFALL EOC</span>
        <span class="cf-warning">SIGNAL UNVERIFIED</span>
      </footer>
    `;

    const main = terminal.querySelector("main");
    main.append(heading, content);
    overlay.appendChild(terminal);
    document.body.appendChild(overlay);

    // Allow CSS to animate the appearance.
    requestAnimationFrame(() => {
      overlay.classList.add("cf-visible");
    });

    const seconds = Number(duration);

    if (Number.isFinite(seconds) && seconds > 0) {
      this.timer = setTimeout(() => {
        this.dismiss();
      }, seconds * 1000);
    }
  }

  static dismiss() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    document.getElementById(this.overlayId)?.remove();
  }
}
