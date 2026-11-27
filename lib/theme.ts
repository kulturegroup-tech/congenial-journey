// The person's look: "system" follows the computer's light/dark setting. Saved per browser.
// No React here, so the root layout can inline THEME_SCRIPT and pick the look before the first paint.

export type ThemePref = "system" | "light" | "dark";
export const THEME_KEY = "covaro.theme";

export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`;
