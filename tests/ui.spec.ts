import { expect, test } from "@playwright/test";

test("registrace, sada, procvičení, statistiky, sdílení a mobilní menu", async ({ page, browser }) => {
  const email = `student-${Date.now()}@example.com`;
  await page.goto("/registrace");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo", { exact: true }).fill("hesloheslo");
  await page.getByLabel("Heslo znovu").fill("hesloheslo");
  await page.getByRole("button", { name: "Vytvořit účet" }).click();
  await expect(page.getByRole("heading", { name: "Vítejte ve Studovně" })).toBeVisible();
  await expect(page.locator("main input")).toHaveCount(0);
  await page.getByRole("link", { name: "Pokračovat do studovny" }).click();
  await expect(page.getByRole("heading", { name: "Studovna" })).toBeVisible();

  await page.getByLabel("Nová složka").fill("Fyzika");
  await page.getByRole("button", { name: "Vytvořit složku" }).click();
  await expect(page.getByRole("heading", { name: "Fyzika" })).toBeVisible();

  await page.getByLabel("Nový materiál").fill("Vzorce");
  await page.getByRole("button", { name: "Vytvořit materiál" }).click();
  await expect(page.getByRole("heading", { name: "Vzorce" })).toBeVisible();

  await page.getByRole("textbox", { name: "Líc", exact: true }).fill("síla");
  await page.getByRole("textbox", { name: "Rub", exact: true }).fill("newton");
  await page.getByRole("button", { name: "Uložit kartičku" }).click();
  await expect(page.getByText("síla")).toBeVisible();

  await page.getByRole("button", { name: "Procvičovat" }).click();
  await page.getByRole("button", { name: "Ukázat rub" }).click();
  await expect(page.getByText("newton")).toBeVisible();
  await page.getByRole("button", { name: /^Vím/ }).click();
  await expect(page.getByRole("heading", { name: "Souhrn bloku" })).toBeVisible();
  await expect(page.getByText("Vím: 1")).toBeVisible();

  await page.goto("/statistiky");
  await expect(page.getByText("Sady: 1")).toBeVisible();
  await expect(page.getByText("Kartičky: 1")).toBeVisible();
  await expect(page.getByText("Úspěšnost: 100 %")).toBeVisible();

  await page.goto("/studovna");
  await page.getByRole("link", { name: "Fyzika" }).first().click();
  await page.getByRole("link", { name: "Sada: Vzorce" }).click();
  await page.getByRole("button", { name: "Sdílet odkazem" }).click();
  const share = page.getByRole("link", { name: /\/sdileni\// });
  const href = await share.getAttribute("href");
  expect(href).toBeTruthy();
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(href ?? "");
  await expect(guestPage.getByText("síla")).toBeVisible();
  await expect(guestPage.getByText("newton")).toBeVisible();
  await guest.close();

  await page.getByRole("button", { name: "Vypnout sdílení" }).click();
  await guestPageWait(browser, href ?? "");

  await page.goto("/studovna");
  await page.getByRole("link", { name: "Fyzika" }).first().click();
  await page.getByLabel("Nový materiál").fill("Malý test");
  await page.getByRole("radio", { name: "Kvíz" }).check();
  await page.getByRole("button", { name: "Vytvořit materiál" }).click();
  await page.getByRole("radio", { name: "Pravda/nepravda" }).check();
  await page.getByRole("textbox", { name: "Zadání", exact: true }).fill("Praha je hlavní město.");
  await page.getByRole("button", { name: "Uložit otázku" }).click();
  await expect(page.locator("summary", { hasText: "Praha je hlavní město." })).toBeVisible();
  await page.getByRole("button", { name: "Spustit kvíz" }).click();
  await expect(page.getByRole("heading", { name: "Otázka" })).toBeVisible();
  await page.getByRole("radio", { name: "Pravda", exact: true }).check();
  await page.getByRole("button", { name: "Vyhodnotit" }).click();
  await expect(page.getByText("Správně", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Statistiky" })).toBeVisible();
});

async function guestPageWait(browser: import("@playwright/test").Browser, href: string) {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  const response = await guestPage.goto(href);
  expect(response?.status()).toBe(404);
  await guest.close();
}
