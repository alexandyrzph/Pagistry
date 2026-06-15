import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "/tmp/pb-shots";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

try {
  // 1. Dashboard
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Pagecraft");
  await page.screenshot({ path: OUT + "/1-dashboard.png", fullPage: true });
  log("dashboard loaded:", await page.title());

  // 2. New page -> template modal -> Blank -> editor
  await page.click("text=New page");
  await page.waitForSelector("text=Choose a starting point");
  await page.screenshot({ path: OUT + "/2-template-modal.png" });
  log("template modal shown");

  await page.click("button:has-text('Blank')");
  await page.waitForURL(/\/editor\//, { timeout: 15000 });
  await page.waitForSelector("text=Components");
  await page.waitForTimeout(800);
  log("landed in editor:", page.url());

  // 3. Editor chrome present
  const hasPalette = await page.locator("text=Components").first().isVisible();
  const hasLayers = await page.locator("text=Layers").first().isVisible();
  const hasInspectorHint = await page
    .locator("text=Select a block on the canvas")
    .isVisible();
  log("palette:", hasPalette, "layers:", hasLayers, "inspector empty-state:", hasInspectorHint);
  await page.screenshot({ path: OUT + "/3-editor-empty.png" });

  // 4. Drag a Heading from the palette onto the empty canvas
  const headingChip = page.locator("button:has-text('Heading')").first();
  const dropZone = page.locator("text=Drag blocks here").first();
  const from = await headingChip.boundingBox();
  const to = await dropZone.boundingBox();
  if (!from || !to) throw new Error("could not locate drag source/target");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // move in steps to satisfy dnd-kit activation + collision
  const tx = to.x + to.width / 2;
  const ty = to.y + to.height / 2;
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      from.x + (tx - from.x) * (i / 12),
      from.y + (ty - from.y) * (i / 12)
    );
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(600);

  const headingAdded = await page
    .locator(".b-\\* , h2:has-text('Your heading here')")
    .count()
    .catch(() => 0);
  const headingText = await page
    .locator("h2:has-text('Your heading here')")
    .count();
  log("heading block present after drop:", headingText > 0, "(matches:", headingText, ")");
  await page.screenshot({ path: OUT + "/4-after-drop.png" });

  // 5. Select the block -> inspector shows its settings
  if (headingText > 0) {
    await page.locator("h2:has-text('Your heading here')").first().click();
    await page.waitForTimeout(400);
  }
  const inspectorLabel = await page
    .locator("aside:has-text('Heading')")
    .first()
    .isVisible()
    .catch(() => false);
  const hasTagField = await page.locator("text=Tag").first().isVisible().catch(() => false);
  const hasStyleTab = await page.locator("button:has-text('Style')").first().isVisible();
  log("inspector shows block (Heading):", inspectorLabel, "Tag field:", hasTagField, "Style tab:", hasStyleTab);
  await page.screenshot({ path: OUT + "/5-selected-inspector.png" });

  // Also exercise the Style tab + a viewport switch for a richer screenshot
  if (hasStyleTab) {
    await page.locator("button:has-text('Style')").first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + "/6-style-tab.png" });
  }

  console.log("\nRESULT", JSON.stringify({
    dashboard: true,
    editor: hasPalette && hasInspectorHint,
    dndAddedBlock: headingText > 0,
    inspectorShowsBlock: inspectorLabel && hasTagField,
    consoleErrors: errors,
  }, null, 2));
} catch (e) {
  console.error("SCRIPT ERROR:", e);
  await page.screenshot({ path: OUT + "/error.png" }).catch(() => {});
  console.log("\nRESULT", JSON.stringify({ failed: String(e), consoleErrors: errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
