/** Spawn a short-lived ripple at the click position. */
export function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height) * 1.2;
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

/** Briefly add a [data-sent] attribute to trigger the sent-flash animation. */
export function flashSent(btn: HTMLButtonElement) {
  btn.setAttribute("data-sent", "");
  window.setTimeout(() => btn.removeAttribute("data-sent"), 600);
}