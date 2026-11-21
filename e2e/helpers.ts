import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

export type MockApi = {
  motionOf(id: string): string;
  received(id: string): string[];
  setLifted(id: string, v: boolean): void;
  drop(id: string): void;
  nextPick(mode: 'auto' | 'cancel' | 'bluetooth-off' | 'permission-denied'): void;
  firmware(id: string): { liftStop: boolean; obstacleCm: number };
  clap(id: string, n: 1 | 2 | 3): boolean;
  calibrate(id: string): void;
  say(text: string, targets: string[]): unknown;
};

export const CAR1 = 'mock-zogat';
export const CAR2 = 'mock-pevit';

export async function fresh(page: Page, opts: { keyboardHint?: boolean } = {}) {
  // Seed storage before the app boots: mock mode on, keyboard hint dismissed unless asked for.
  await page.addInitScript((hint) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem(
      'stembot.settings.v1',
      JSON.stringify({
        state: { devOptions: true, mockMode: true, keyboardHintSeen: !hint },
        version: 1,
      }),
    );
  }, opts.keyboardHint ?? false);
  await page.goto('/?mock=1#/');
  await expect(page.getByRole('heading', { name: 'No cars yet' })).toBeVisible();
}

export function mock(page: Page) {
  return {
    motion: (id: string) =>
      page.evaluate(
        (i) => (window as unknown as { __stembotMock: MockApi }).__stembotMock.motionOf(i),
        id,
      ),
    received: (id: string) =>
      page.evaluate(
        (i) => (window as unknown as { __stembotMock: MockApi }).__stembotMock.received(i),
        id,
      ),
    lift: (id: string, v: boolean) =>
      page.evaluate(
        ([i, val]) =>
          (window as unknown as { __stembotMock: MockApi }).__stembotMock.setLifted(
            i as string,
            val as boolean,
          ),
        [id, v] as const,
      ),
    drop: (id: string) =>
      page.evaluate(
        (i) => (window as unknown as { __stembotMock: MockApi }).__stembotMock.drop(i),
        id,
      ),
    clap: (id: string, n: 1 | 2 | 3) =>
      page.evaluate(
        ([i, c]) =>
          (window as unknown as { __stembotMock: MockApi }).__stembotMock.clap(
            i as string,
            c as 1 | 2 | 3,
          ),
        [id, n] as const,
      ),
    say: (text: string, targets: string[]) =>
      page.evaluate(
        ([t, ids]) =>
          (window as unknown as { __stembotMock: MockApi }).__stembotMock.say(
            t as string,
            ids as string[],
          ),
        [text, targets] as const,
      ),
    nextPick: (m: Parameters<MockApi['nextPick']>[0]) =>
      page.evaluate(
        (mode) => (window as unknown as { __stembotMock: MockApi }).__stembotMock.nextPick(mode),
        m,
      ),
  };
}

/** Garage empty -> add -> name -> (start driving | save). */
export async function addCar(page: Page, name: string, then: 'drive' | 'garage') {
  await page.goto('/?mock=1#/add');
  await page.getByRole('button', { name: 'Find my car' }).click();
  await expect(page.getByRole('heading', { name: 'Name it' })).toBeVisible();
  await page.getByLabel('Car name').fill(name);
  await page
    .getByRole('button', { name: then === 'drive' ? 'Start driving' : 'Save to garage' })
    .click();
}

export async function lastLine(page: Page, id: string) {
  const r = await mock(page).received(id);
  return r.at(-1);
}

export async function shot(page: Page, info: TestInfo, name: string) {
  mkdirSync('docs/screenshots', { recursive: true });
  await page.waitForTimeout(250); // let screen-in animation finish
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-${name}.png`,
    fullPage: false,
  });
}

const axeResults: Record<string, unknown> = {};

export async function axe(page: Page, info: TestInfo, name: string) {
  const res = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  axeResults[`${info.project.name}/${name}`] = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    `test-results/axe-summary-${info.project.name}.json`,
    JSON.stringify(axeResults, null, 2),
  );
  expect(
    serious,
    JSON.stringify(
      serious.map((v) => [v.id, v.nodes.map((n) => n.target)]),
      null,
      1,
    ),
  ).toEqual([]);
}
