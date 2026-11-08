#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];
const info = [];

const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const warn = (message) => warnings.push(message);
const fail = (message) => errors.push(message);

function decodeEntities(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "is"));
  return match ? decodeEntities(match[2]) : "";
}

function checkHtml(relative, { requireSeo = true, published = true } = {}) {
  if (!exists(relative)) {
    fail(`${relative}: file does not exist`);
    return;
  }
  const html = read(relative);
  const title = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
  if (!title) fail(`${relative}: missing or empty <title>`);

  if (requireSeo) {
    const description = html.match(/<meta\s+[^>]*name=["']description["'][^>]*>/i)?.[0];
    const canonical = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
    const ogTitle = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*>/i)?.[0];
    const ogDescription = html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*>/i)?.[0];
    if (!description || !attr(description, "content").trim()) fail(`${relative}: missing meta description`);
    if (!canonical || !/^https:\/\//.test(attr(canonical, "href"))) fail(`${relative}: missing absolute HTTPS canonical URL`);
    if (!ogTitle || !attr(ogTitle, "content").trim()) fail(`${relative}: missing Open Graph title`);
    if (!ogDescription || !attr(ogDescription, "content").trim()) fail(`${relative}: missing Open Graph description`);
  }

  const ids = new Set();
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
    const id = decodeEntities(match[1]);
    if (ids.has(id)) fail(`${relative}: duplicate id "${id}"`);
    ids.add(id);
  }

  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(match[0], "href").trim();
    if (!href || href.startsWith("#") || /^(?:[a-z]+:|\/\/)/i.test(href)) continue;
    const [pathname, hash] = href.split("#", 2);
    const cleanPath = pathname.split("?", 1)[0];
    const targetPath = cleanPath
      ? path.resolve(root, path.dirname(relative), decodeURIComponent(cleanPath))
      : path.resolve(root, relative);
    if (!targetPath.startsWith(root + path.sep) && targetPath !== root) {
      fail(`${relative}: link escapes project directory: ${href}`);
      continue;
    }
    const target = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
      ? path.join(targetPath, "index.html")
      : targetPath;
    if (!fs.existsSync(target)) {
      fail(`${relative}: broken local link "${href}"`);
      continue;
    }
    if (hash) {
      const targetHtml = target.endsWith(".html") ? fs.readFileSync(target, "utf8") : "";
      const targetIds = new Set([...targetHtml.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1])));
      if (targetHtml && !targetIds.has(decodeURIComponent(hash))) warn(`${relative}: link target "${href}" has no matching id`);
    }
  }

  if (published) {
    const placeholderPatterns = [
      /عنوان المحور الأول|عنوان المحور الثاني|عنوان المحور الثالث/,
      /جملة تلخّص محتوى الدرس/,
      /<b>الفيلسوف<\/b>|<span class=["']label["']>الفيلسوف:/,
      /تحقق من موضع الصيغة|للتحقق/,
    ];
    if (placeholderPatterns.some((pattern) => pattern.test(html))) {
      warn(`${relative}: contains a visible template placeholder or editorial marker`);
    }
  }
}

// Read and evaluate the static configuration in an isolated context (no browser APIs).
let site;
try {
  const context = { window: {} };
  vm.runInNewContext(read("assets/config.js"), context, { timeout: 1000 });
  site = context.window.SITE;
  if (!site || !Array.isArray(site.units)) throw new Error("window.SITE.units is missing");
} catch (error) {
  fail(`assets/config.js: could not load a valid site config (${error.message})`);
}

if (site) {
  const seenFiles = new Set();
  for (const unit of site.units) {
    if (!Array.isArray(unit.subunits)) {
      fail(`Unit ${unit.id}: subunits must be an array`);
      continue;
    }
    for (const lesson of unit.subunits) {
      if (!lesson || typeof lesson.file !== "string" || !/^content\/[A-Za-z0-9._/-]+\.html$/.test(lesson.file) || lesson.file.includes("..")) {
        fail(`Unit ${unit.id}: invalid lesson path`);
        continue;
      }
      if (seenFiles.has(lesson.file)) fail(`Duplicate lesson configured: ${lesson.file}`);
      seenFiles.add(lesson.file);
      checkHtml(lesson.file);

      const page = read(lesson.file);
      const heading = page.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
      const configuredTitle = String(lesson.title ?? "").trim();
      const normalizedHeading = decodeEntities(heading ?? "").replace(/^مفهوم\s+/, "").trim();
      if (normalizedHeading && configuredTitle && normalizedHeading !== configuredTitle) {
        fail(`${lesson.file}: homepage label "${configuredTitle}" does not match H1 "${decodeEntities(heading)}"`);
      }
      const browserTitle = page.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
      if (configuredTitle && !decodeEntities(browserTitle).includes(configuredTitle)) {
        fail(`${lesson.file}: browser title does not include homepage label "${configuredTitle}"`);
      }
    }
  }
}

// Verify previous/next navigation against the order of configured lesson pages.
if (site) {
  const getPager = (html) => html.match(/<(?:nav|div)\b[^>]*class=["'][^"']*\bpager\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|div)>/i)?.[1] ?? "";
  const getPagerLinks = (pager) => [...pager.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: attr(match[0].match(/<a\b[^>]*>/i)?.[0] ?? "", "href"),
    label: decodeEntities(match[1].replace(/<[^>]+>/g, "")).trim(),
  }));
  const navigable = site.units.flatMap((unit) => unit.subunits ?? []).filter((lesson) => {
    if (!lesson?.file || !exists(lesson.file)) return false;
    return getPagerLinks(getPager(read(lesson.file))).length > 0;
  });
  navigable.forEach((lesson, index) => {
    const links = getPagerLinks(getPager(read(lesson.file)));
    const expected = [];
    if (index > 0) expected.push({ direction: "السابق", lesson: navigable[index - 1] });
    if (index < navigable.length - 1) expected.push({ direction: "التالي", lesson: navigable[index + 1] });
    if (links.length !== expected.length) {
      fail(`${lesson.file}: pager should contain ${expected.length} link(s), found ${links.length}`);
      return;
    }
    expected.forEach((item, linkIndex) => {
      const actual = links[linkIndex];
      const wantedFile = path.basename(item.lesson.file);
      const wantedLabel = `${item.direction}: ${item.lesson.title}`;
      if (path.basename(actual.href) !== wantedFile || actual.label !== wantedLabel) {
        fail(`${lesson.file}: expected pager link "${wantedLabel}" to ${wantedFile}`);
      }
    });
  });
}

checkHtml("index.html");
for (const entry of fs.readdirSync(path.join(root, "content"), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html") && !entry.name.startsWith("_template-")) {
    const relative = `content/${entry.name}`;
    // Pages referenced by config were already checked; check any unlisted published pages too.
    if (!site || !site.units?.some((unit) => unit.subunits?.some((lesson) => lesson.file === relative))) checkHtml(relative);
  }
}

for (const template of ["content/_template-first-subunit.html", "content/_template-subunit.html"]) {
  if (exists(template)) {
    const html = read(template);
    if (!/name=["']robots["']\s+content=["']noindex,follow["']/.test(html)) warn(`${template}: template should be marked noindex,follow`);
  }
}

// A built-in syntax check for scripts that ship to browsers.
try {
  new vm.Script(read("assets/app.js"), { filename: "assets/app.js" });
  new vm.Script(read("assets/config.js"), { filename: "assets/config.js" });
  new vm.Script(read("assets/ui.js"), { filename: "assets/ui.js" });
} catch (error) {
  fail(`JavaScript syntax error: ${error.message}`);
}

console.log("Philosophy site pre-deployment check");
console.log(`Project: ${root}`);
console.log(`Configured lessons: ${site?.units?.reduce((count, unit) => count + (unit.subunits?.length ?? 0), 0) ?? 0}`);
for (const message of errors) console.error(`ERROR: ${message}`);
for (const message of warnings) console.warn(`WARNING: ${message}`);
if (!errors.length) info.push("No broken local links, duplicate IDs, config/H1 mismatches, or missing SEO fields detected.");
for (const message of info) console.log(`PASS: ${message}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
if (errors.length || (strict && warnings.length)) process.exitCode = 1;
