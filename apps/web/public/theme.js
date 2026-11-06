// Runs before first paint: Orbit Bot Cosmic Theme & Typography Engine
(() => {
  let savedTheme = "deep-space";
  let savedFont = "google-sans";
  try {
    savedTheme = localStorage.getItem("orbit-cosmic-theme") || "deep-space";
    savedFont = localStorage.getItem("orbit_font") || "google-sans";
  } catch {}
  document.documentElement.dataset.theme = savedTheme;
  document.documentElement.dataset.orbitTheme = savedTheme;
  document.documentElement.dataset.font = savedFont;
  if (savedTheme === "cosmic-light") {
    document.documentElement.style.colorScheme = "light";
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.classList.add("dark");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", savedTheme === "cosmic-light" ? "#ffffff" : "#050508");
  const nav = typeof navigator === "object" ? navigator : undefined;
  if (nav && /^Mac/.test(nav.platform || "") && !(nav.maxTouchPoints > 1)) {
    document.documentElement.dataset.os = "mac";
  }
})();
