import { expect, test } from '@playwright/test';
import { addCar, axe, CAR1, CAR2, fresh, lastLine, mock, shot } from './helpers';

test.describe('first run and screens', () => {
  test('connect and drive from an empty garage, every main screen renders and passes axe', async ({
    page,
  }, info) => {
    await fresh(page);
    await shot(page, info, '01-garage-empty');
    await axe(page, info, 'garage-empty');

    await page.getByRole('button', { name: 'Add your first car' }).click();
    await expect(page.getByRole('heading', { name: 'Switch the car on' })).toBeVisible();
    await shot(page, info, '02-add-step1');
    await axe(page, info, 'add-step1');

    await page.getByRole('button', { name: 'Find my car' }).click();
    await expect(page.getByRole('heading', { name: 'Name it' })).toBeVisible();
    await shot(page, info, '03-add-name');
    await axe(page, info, 'add-name');
    await page.getByLabel('Car name').fill('Rocket');
    await page.getByRole('button', { name: 'Start driving' }).click();

    await expect(page.getByRole('heading', { name: 'Rocket' })).toBeVisible();
    await expect(page.locator('.radar__num')).toBeVisible({ timeout: 3000 });
    await shot(page, info, '04-drive');
    await axe(page, info, 'drive');

    // Second car (no ultrasonic sensor) and the garage with cards
    await addCar(page, 'Comet', 'garage');
    await page
      .getByRole('button', { name: 'Connect Comet' })
      .waitFor({ state: 'detached' })
      .catch(() => undefined);
    await expect(page.getByRole('article', { name: 'Comet' }).getByText('Connected')).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, info, '05-garage-cars');
    await axe(page, info, 'garage-cars');

    await page.getByRole('button', { name: 'Group drive' }).click();
    await expect(page.getByRole('heading', { name: 'Group drive' })).toBeVisible();
    await shot(page, info, '06-group');
    await axe(page, info, 'group');

    await page.getByRole('button', { name: 'Tune' }).click();
    await shot(page, info, '07-group-tune');
    await axe(page, info, 'group-tune');

    await page.goto('/?mock=1#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await shot(page, info, '08-settings');
    await axe(page, info, 'settings');

    await page.goto('/?mock=1#/dev');
    await expect(page.getByRole('heading', { name: 'Dev options' })).toBeVisible();
    const fwTable = page.getByRole('table', { name: 'Sent to each car' });
    await expect(fwTable).toContainText('i0');
    await expect(fwTable).toContainText('C:2.1,1,1,1'); // Rocket: sensor + horn + compass
    await expect(fwTable).toContainText('C:2.1,0,1,1'); // Comet: no distance sensor
    await page.waitForTimeout(500);
    await shot(page, info, '09-dev-live');
    await axe(page, info, 'dev');

    await page.goto('/?mock=1#/');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Commands' })).toBeVisible();
    await shot(page, info, '10-palette');
    await axe(page, info, 'palette');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Commands' })).toHaveCount(0);
  });

  test('add-car problems: cancelled chooser, Bluetooth off, permission denied, already added', async ({
    page,
  }, info) => {
    await fresh(page);
    await page.goto('/?mock=1#/add');
    await mock(page).nextPick('cancel');
    await page.getByRole('button', { name: 'Find my car' }).click();
    await expect(page.getByRole('heading', { name: 'No car picked' })).toBeVisible();
    await shot(page, info, '11-add-cancelled');

    await mock(page).nextPick('bluetooth-off');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Bluetooth is off' })).toBeVisible();

    await mock(page).nextPick('permission-denied');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(
      page.getByRole('heading', { name: 'STEMBOT needs Bluetooth permission' }),
    ).toBeVisible();
    await shot(page, info, '12-add-denied');
    await axe(page, info, 'add-denied');

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Name it' })).toBeVisible();
    await page.getByRole('button', { name: 'Save to garage' }).click();
    // The mock chooser cycles through 4 cars; pick until we land on the first again.
    for (let i = 0; i < 3; i++) {
      await page.goto('/?mock=1#/add');
      await page.getByRole('button', { name: 'Find my car' }).click();
      await expect(page.getByRole('heading', { name: 'Name it' })).toBeVisible();
      await page.getByRole('button', { name: 'Save to garage' }).click();
    }
    await page.goto('/?mock=1#/add');
    await page.getByRole('button', { name: 'Find my car' }).click();
    await expect(page.getByRole('heading', { name: /is already in your garage/ })).toBeVisible();
  });

  test('unsupported browser shows the alternative', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'bluetooth', { value: undefined, configurable: true });
    });
    await page.goto('/#/add');
    await expect(
      page.getByRole('heading', { name: "This browser can't use Bluetooth" }),
    ).toBeVisible();
    await expect(page.getByText('use the STEMBOT Control app')).toBeVisible();
  });
});

test.describe('safety: every way out sends stop', () => {
  test.beforeEach(async ({ page }) => {
    await fresh(page);
    await addCar(page, 'Rocket', 'drive');
    await expect(page.getByRole('heading', { name: 'Rocket' })).toBeVisible();
    await expect(page.locator('.radar__num')).toBeVisible({ timeout: 3000 });
  });

  test('keyboard: hold W drives with keep-alive, release sends x', async ({ page }) => {
    await page.keyboard.down('w');
    await page.waitForTimeout(1000);
    expect(await mock(page).motion(CAR1)).toBe('w');
    const lines = await mock(page).received(CAR1);
    // 1 s at 80 ms keep-alive = ~12 writes; allow slack for CI timers
    expect(lines.filter((l) => l.startsWith('w')).length).toBeGreaterThanOrEqual(9);
    await page.keyboard.up('w');
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
    expect(await mock(page).motion(CAR1)).toBe('x');
  });

  test('joystick: drag up drives, letting go sends x', async ({ page }) => {
    const box = await page.locator('.joystick').boundingBox();
    if (!box) throw new Error('no joystick');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - box.height / 2, { steps: 4 });
    await page.waitForTimeout(400);
    expect(await mock(page).motion(CAR1)).toBe('w');
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
  });

  test('window blur while driving sends x', async ({ page }) => {
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
    // and the keep-alive does not restart behind our back
    await page.waitForTimeout(400);
    expect(await lastLine(page, CAR1)).toBe('x');
    await page.keyboard.up('w');
  });

  test('switching tabs (visibility hidden) sends x', async ({ page }) => {
    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    expect(await mock(page).motion(CAR1)).toBe('d');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
    await page.keyboard.up('d');
  });

  test('Space and the giant STOP stop the car', async ({ page }) => {
    await page.keyboard.down('a');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
    await page.keyboard.up('a');

    await page.keyboard.down('w');
    await page.waitForTimeout(200);
    await page.getByTestId('stop-giant').dispatchEvent('pointerdown');
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
    await page.keyboard.up('w');
  });

  test('Stop when lifted off (default): a lifted car shows a calm state and still drives', async ({
    page,
  }, info) => {
    await page.waitForTimeout(400); // i0 is sent ~300 ms after connect
    expect(await mock(page).received(CAR1)).toContain('i0');
    await mock(page).lift(CAR1, true);
    await expect(page.getByText('Lifted (still drivable)').first()).toBeVisible({ timeout: 2000 });
    await shot(page, info, '13-drive-lifted-drivable');
    await page.keyboard.down('w');
    await page.waitForTimeout(400);
    expect(await mock(page).motion(CAR1)).toBe('w');
    await page.keyboard.up('w');
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
  });

  test('Stop when lifted on: sends i1, a lifted car stops and refuses to drive', async ({
    page,
  }, info) => {
    await page.getByRole('button', { name: 'Edit Rocket' }).click();
    const sheet = page.getByRole('dialog', { name: 'Rocket' });
    await sheet.getByRole('switch', { name: 'Stop when lifted' }).click();
    await expect(sheet.getByRole('radiogroup', { name: 'Obstacle stop, Rocket' })).toBeVisible();
    await expect(sheet.getByText(/Helps stop the car/)).toBeVisible();
    await shot(page, info, '17-car-editor-v2');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await mock(page).received(CAR1)).toContain('i1');

    await mock(page).lift(CAR1, true);
    await expect(page.getByText('Lifted: stopped').first()).toBeVisible({ timeout: 2000 });
    await shot(page, info, '13-drive-lifted-stopped');
    const before = (await mock(page).received(CAR1)).length;
    await page.keyboard.down('w');
    await page.waitForTimeout(400);
    expect(await mock(page).motion(CAR1)).toBe('x');
    const after = (await mock(page).received(CAR1)).slice(before);
    expect(after.filter((l) => l.startsWith('w')).length).toBe(0);
    await page.keyboard.up('w');

    // Turning it off again shows the one-time notice
    await page.getByRole('button', { name: 'Edit Rocket' }).click();
    await page
      .getByRole('dialog', { name: 'Rocket' })
      .getByRole('switch', { name: 'Stop when lifted' })
      .click();
    await expect(page.getByText('A lifted car keeps spinning its wheels').first()).toBeVisible();
  });

  test('losing the link stops, tells the user in plain words, and offers reconnect', async ({
    page,
  }, info) => {
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    await mock(page).drop(CAR1);
    await expect(page.getByText('Rocket lost connection').first()).toBeVisible();
    expect(await mock(page).motion(CAR1)).toBe('x');
    await page.keyboard.up('w');
    await shot(page, info, '14-drive-lost');
    await page.getByRole('button', { name: 'Reconnect' }).first().click();
    await expect(page.locator('.radar__num')).toBeVisible({ timeout: 3000 });
  });

  test('arrow keys inside the speed selector change speed, not direction', async ({ page }) => {
    await page.getByRole('radio', { name: 'Normal' }).focus();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Turbo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const lines = await mock(page).received(CAR1);
    expect(lines.filter((l) => l.startsWith('d')).length).toBe(0);
  });

  test('lock controls blocks driving but never blocks STOP', async ({ page }) => {
    await page.getByRole('button', { name: 'Lock controls' }).click();
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    expect(await mock(page).motion(CAR1)).toBe('x');
    await page.keyboard.up('w');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    expect(await lastLine(page, CAR1)).toBe('x');
  });
});

test.describe('group drive', () => {
  test('one control drives every ticked car; one failing car never blocks the others', async ({
    page,
  }, info) => {
    await fresh(page);
    await addCar(page, 'Rocket', 'garage');
    await addCar(page, 'Comet', 'garage');

    // Per car: Rocket stops when lifted, Comet keeps the default (off).
    // Comet has no distance sensor, so it gets no obstacle-stop control.
    await page.goto('/?mock=1#/settings');
    const rocket = page.getByRole('region', { name: 'Rocket' });
    const comet = page.getByRole('region', { name: 'Comet' });
    await rocket.getByRole('switch', { name: 'Stop when lifted' }).click();
    await expect(rocket.getByRole('radiogroup', { name: 'Obstacle stop, Rocket' })).toBeVisible();
    await expect(comet.getByRole('radiogroup')).toHaveCount(0);
    await rocket.getByRole('radio', { name: '30 cm' }).click();
    await shot(page, info, '18-settings-cars');

    await page.goto('/?mock=1#/group');
    await expect(page.getByText('2 of 2 cars')).toBeVisible();

    await page.keyboard.down('w');
    await page.waitForTimeout(400);
    expect(await mock(page).motion(CAR1)).toBe('w');
    expect(await mock(page).motion(CAR2)).toBe('w');

    // Car 1 (Stop when lifted on) is lifted: it stops, car 2 keeps going
    await mock(page).lift(CAR1, true);
    await page.waitForTimeout(500);
    expect(await mock(page).motion(CAR1)).toBe('x');
    expect(await mock(page).motion(CAR2)).toBe('w');

    // Car 2 (setting off) is lifted too: it keeps driving, car 1 is unaffected
    await mock(page).lift(CAR2, true);
    await page.waitForTimeout(500);
    expect(await mock(page).motion(CAR2)).toBe('w');
    expect(await mock(page).motion(CAR1)).toBe('x');
    await expect(page.getByText('Lifted (still drivable)').first()).toBeVisible();
    await shot(page, info, '15-group-lifted');
    await mock(page).lift(CAR2, false);

    // Car 2 drops off: car 1 is still lifted, nothing hangs, STOP still works
    await mock(page).drop(CAR2);
    await expect(page.getByText('Comet lost connection').first()).toBeVisible();
    await page.keyboard.up('w');
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');

    // Put car 1 down, drive again: only car 1 moves
    await mock(page).lift(CAR1, false);
    await page.waitForTimeout(500);
    await page.keyboard.down('s');
    await page.waitForTimeout(300);
    expect(await mock(page).motion(CAR1)).toBe('s');
    await page.keyboard.up('s');
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
  });

  test('reverse wheels swaps w/s for that car only', async ({ page }) => {
    await fresh(page);
    await addCar(page, 'Rocket', 'garage');
    await addCar(page, 'Comet', 'garage');
    await page.goto('/?mock=1#/group');
    await page.getByRole('button', { name: 'Tune' }).click();
    await page.getByRole('switch', { name: 'Reverse wheels for Comet' }).click();
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    expect(await mock(page).motion(CAR1)).toBe('w');
    expect(await mock(page).motion(CAR2)).toBe('s');
    await page.keyboard.up('w');
  });
});

test('desktop: keyboard hint shows once, then stays dismissed', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard hint is for fine pointers only');
  await fresh(page, { keyboardHint: true });
  await addCar(page, 'Rocket', 'drive');
  const hint = page.getByRole('complementary', { name: 'Keyboard' });
  await expect(hint).toBeVisible();
  await shot(page, info, '16-drive-keyboard-hint');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(hint).toHaveCount(0);
  await page.goto('/?mock=1#/');
  await page.goto('/?mock=1#/settings');
  await page.goBack();
  await expect(page.getByRole('complementary', { name: 'Keyboard' })).toHaveCount(0);
});

test.describe('firmware v2.1: compass, clap commands, car sounds, voice', () => {
  test.beforeEach(async ({ page }) => {
    await fresh(page);
    await addCar(page, 'Rocket', 'drive');
    await expect(page.locator('.radar__num')).toBeVisible({ timeout: 3000 });
  });

  const carId = (url: string) => decodeURIComponent(url.split('#/drive/')[1] ?? '');

  test('the compass shows a heading that turns with the car', async ({ page }, info) => {
    const compass = page.getByRole('img', { name: /^Heading / });
    await expect(compass).toBeVisible({ timeout: 3000 });
    const before = await compass.getAttribute('aria-label');
    await page.keyboard.down('d');
    await page.waitForTimeout(700);
    await page.keyboard.up('d');
    await page.waitForTimeout(300);
    expect(await compass.getAttribute('aria-label')).not.toBe(before);
    await shot(page, info, '19-drive-compass');
  });

  test('clap commands: switch sends k1, a clap moves the car and is shown', async ({
    page,
  }, info) => {
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Edit Rocket' }).click();
    const sheet = page.getByRole('dialog', { name: 'Rocket' });
    await sheet.getByRole('switch', { name: 'Clap commands' }).click();
    await expect(
      sheet.getByRole('button', { name: 'Set current direction as north' }),
    ).toBeEnabled();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await mock(page).received(CAR1)).toContain('k1');
    await expect(page.getByText('Listening for claps')).toBeVisible();

    expect(await mock(page).clap(CAR1, 1)).toBe(true);
    await page.waitForTimeout(300);
    expect(await mock(page).motion(CAR1)).toBe('w');
    await expect(page.locator('.chip--clap')).toContainText('heard 1 clap: forward');
    await shot(page, info, '20-drive-clap');
    // STOP still wins over a clap move
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    expect(await mock(page).motion(CAR1)).toBe('x');
  });

  test('car sounds switch sends m0, and m1 is sent on connect by default', async ({ page }) => {
    await page.waitForTimeout(400);
    expect(await mock(page).received(CAR1)).toContain('m1');
    await page.goto('/?mock=1#/settings');
    await page.getByRole('switch', { name: 'Car sounds' }).click();
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('m0');
  });

  test('voice phrases go through the same command layer (bounded move, stop wins)', async ({
    page,
  }) => {
    const id = carId(page.url());
    await mock(page).say('go forward', [id]);
    await page.waitForTimeout(400);
    expect(await mock(page).motion(CAR1)).toBe('w');
    await page.waitForTimeout(900); // a voice move lasts 1 s, then stops by itself
    expect(await mock(page).motion(CAR1)).toBe('x');
    await mock(page).say('spin left', [id]);
    await page.waitForTimeout(150);
    await mock(page).say('stop', [id]);
    await page.waitForTimeout(150);
    expect(await lastLine(page, CAR1)).toBe('x');
    expect(await mock(page).say('unlock', [id])).toBeNull();
  });

  test('voice is off by default and never probes the browser by itself', async ({ page }) => {
    // Turning voice on runs the browser's on-device check, which crashes headless Chromium,
    // so this test only covers the default: no probe, switch off, no mic button.
    await page.goto('/?mock=1#/settings');
    await expect(page.getByText('Uses speech recognition on this device only')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Voice commands' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.goto(page.url().replace('#/settings', '#/'));
    await expect(page.getByRole('button', { name: /Hold to talk/ })).toHaveCount(0);
  });
});
