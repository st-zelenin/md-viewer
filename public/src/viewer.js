import MarkdownIt from "markdown-it";
import { convertFileSrc } from "@tauri-apps/api/core";
import hljs from "highlight.js/lib/common";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);

const HLJS_THEMES = {
  light: "./vendor/highlight.js/styles/github.min.css",
  dark: "./vendor/highlight.js/styles/github-dark.min.css",
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang }).value;
    }
    return hljs.highlightAuto(str).value;
  },
});

const slugCounts = new Map();

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueHeadingId(text) {
  const base = slugify(text) || "section";
  const count = slugCounts.get(base) ?? 0;
  slugCounts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

const defaultHeadingOpen =
  md.renderer.rules.heading_open ||
  ((tokens, idx, options, env, self) =>
    self.renderToken(tokens, idx, options));

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const inline = tokens[idx + 1];
  if (inline?.type === "inline") {
    token.attrSet("id", uniqueHeadingId(inline.content));
  }
  return defaultHeadingOpen(tokens, idx, options, env, self);
};

function resolvePath(basePath, relativeSrc) {
  const normalized = relativeSrc.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return normalized;

  const baseDir = basePath.replace(/\\/g, "/").replace(/\/[^/]*$/, "");
  const segments = baseDir ? baseDir.split("/").filter(Boolean) : [];

  for (const part of normalized.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }

  return `/${segments.join("/")}`;
}

function resolveImageSrc(src, mdPath) {
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (!mdPath || !window.__TAURI__) return src;

  const absolute = resolvePath(mdPath, src);
  return convertFileSrc(absolute);
}

function fixImages(container, mdPath) {
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;
    img.src = resolveImageSrc(src, mdPath);
    img.loading = "lazy";
  });
}

function setupInPageNavigation(container) {
  container.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !container.contains(link)) return;

    const hash = link.getAttribute("href").slice(1);
    if (!hash) return;

    const target = container.querySelector(
      `#${CSS.escape(decodeURIComponent(hash))}`
    );
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${hash}`);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.getElementById("hljs-theme").href = HLJS_THEMES[theme];
  document.getElementById("theme-toggle").textContent =
    theme === "dark" ? "Light" : "Dark";
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function initTheme() {
  const stored = localStorage.getItem("theme");
  const theme =
    stored === "light" || stored === "dark" ? stored : getSystemTheme();
  applyTheme(theme);

  if (!stored) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (!localStorage.getItem("theme")) {
          applyTheme(e.matches ? "dark" : "light");
        }
      });
  }
}

function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  applyTheme(next);
}

function renderMarkdown(path, text) {
  const name = path.split("/").pop() || path;
  const content = document.getElementById("content");

  slugCounts.clear();
  document.getElementById("title").textContent = name;
  content.innerHTML = md.render(text);
  fixImages(content, path);
}

function showError(message) {
  document.getElementById("content").innerHTML =
    `<p class="placeholder">${message}</p>`;
}

function showFiles(files) {
  if (!files?.length) return;
  const file = files[files.length - 1];
  if (!file?.path || file.content == null) {
    showError("Invalid file payload from app.");
    return;
  }
  renderMarkdown(file.path, file.content);
}

window.__mdViewerShowFiles = showFiles;
window.mdViewerRender = showFiles;

initTheme();
document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
setupInPageNavigation(document.getElementById("content"));

document.addEventListener("mdviewer:files", (e) => {
  showFiles(e.detail);
});

if (window.__mdViewerPendingFiles) {
  showFiles(window.__mdViewerPendingFiles);
}
