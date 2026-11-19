export const THEME_KEY = "LBS_THEME";
export const TEXT_SIZE_KEY = "LBS_TEXT_SIZE";
export type ThemePreference = "light" | "dark" | "system";

/** Runs before first paint so there is no flash; reads the key the live site already writes. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"light";var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#161012":"#FFFBFC");var s=localStorage.getItem("${TEXT_SIZE_KEY}");var z={small:0.9375,large:1.125}[s];if(z)r.style.setProperty("--font-scale",String(z))}catch(e){}})();`;
