// A short burst for joinings. Respects reduced motion (hidden in globals.css).
const colours = ["#24453a", "#c9d6a0", "#e3eaef", "#f3e6de", "#f2ecdd", "#d6b57a", "#2f6b4f"];

export function celebrate(count = 90) {
  if (typeof document === "undefined") return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    s.style.left = `${Math.random() * 100}vw`;
    s.style.background = colours[i % colours.length];
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * 240}px`);
    s.style.setProperty("--rot", `${(Math.random() - 0.5) * 1080}deg`);
    s.style.setProperty("--dur", `${1.4 + Math.random() * 1.2}s`);
    s.style.animationDelay = `${Math.random() * 0.25}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3000);
  }
}
