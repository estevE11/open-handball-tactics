import {
  expect,
  test,
  type BrowserContext,
  type WebSocketRoute,
} from "@playwright/test";
import { generate, parser, type Packet } from "mqtt-packet";

// Exercise real WebRTC data channels between isolated browser profiles. Only
// public MQTT discovery is replaced with an in-memory broker for reliable CI.
function discoveryRelay() {
  const sockets = new Map<WebSocketRoute, Set<string>>();
  return async (context: BrowserContext) =>
    context.routeWebSocket(/wss:\/\//, (socket) => {
      const subscriptions = new Set<string>();
      sockets.set(socket, subscriptions);
      socket.onClose(() => sockets.delete(socket));
      const reader = parser();
      reader.on("packet", (packet: Packet) => {
        if (packet.cmd === "connect")
          socket.send(
            generate({ cmd: "connack", returnCode: 0, sessionPresent: false }),
          );
        else if (packet.cmd === "subscribe") {
          packet.subscriptions.forEach(({ topic }) => subscriptions.add(topic));
          socket.send(
            generate({
              cmd: "suback",
              messageId: packet.messageId,
              granted: packet.subscriptions.map(() => 0),
            }),
          );
        } else if (packet.cmd === "unsubscribe") {
          packet.unsubscriptions.forEach((topic) =>
            subscriptions.delete(topic),
          );
          socket.send(
            generate({ cmd: "unsuback", messageId: packet.messageId }),
          );
        } else if (packet.cmd === "publish") {
          for (const [peer, topics] of sockets)
            if (topics.has(packet.topic))
              peer.send(
                generate({
                  cmd: "publish",
                  topic: packet.topic,
                  payload: packet.payload,
                  qos: 0,
                  dup: false,
                  retain: false,
                }),
              );
        } else if (packet.cmd === "pingreq")
          socket.send(generate({ cmd: "pingresp" }));
      });
      socket.onMessage((data) =>
        reader.parse(Buffer.isBuffer(data) ? data : Buffer.from(data)),
      );
    });
}

test("shared link syncs edits, live gestures, settings, assets, undo and rejoining", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const relay = discoveryRelay();
  const hostContext = await browser.newContext({ serviceWorkers: "block" });
  const guestContext = await browser.newContext({ serviceWorkers: "block" });
  await relay(hostContext);
  await relay(guestContext);
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest])
    page.on("pageerror", (error) => errors.push(error.message));
  try {
    await host.goto("/");
    await host.getByRole("button", { name: "5:1", exact: true }).click();
    await host
      .locator('input[type="file"][accept^="image/png"]')
      .setInputFiles("public/icon-192.png");
    await host.getByRole("button", { name: "Add icon-192.png" }).click();
    await host
      .getByRole("button", { name: "Share live room", exact: true })
      .click();
    await host.getByLabel("Your collaboration name").fill("Alex");
    await host
      .getByRole("button", { name: "Create live room", exact: true })
      .click();
    const link = await host
      .getByLabel("Room link", { exact: true })
      .inputValue();
    expect(link).toMatch(/#room=.+&key=/);
    await host
      .getByRole("button", { name: "Retry connection", exact: true })
      .click();
    await expect(host.getByLabel("Room link", { exact: true })).toHaveValue(
      link,
    );
    await host.getByLabel("Close dialog").click();
    await expect(host.getByRole("dialog")).not.toBeVisible();
    await guest.goto(link);
    await expect(
      guest.getByRole("button", { name: "Live collaboration", exact: true }),
    ).toContainText("Live · 2", { timeout: 25000 });
    await expect(guest.locator(".room-waiting")).toHaveCount(0);
    const hostCourt = host.getByLabel("Interactive handball court");
    const guestCourt = guest.getByLabel("Interactive handball court");
    await expect(
      guestCourt.getByRole("img", { name: "defender Av" }),
    ).toBeVisible();
    await expect(guestCourt.locator("image")).toHaveAttribute("href", /^blob:/);
    const hostPlayer = hostCourt.getByRole("img", {
      name: "attacker C",
      exact: true,
    });
    const guestPlayer = guestCourt.getByRole("img", {
      name: "attacker C",
      exact: true,
    });
    const original = await guestPlayer.getAttribute("transform");
    const box = (await hostPlayer.boundingBox())!;
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    await host.mouse.move(box.x + 80, box.y + 50, { steps: 6 });
    await expect(guestPlayer).not.toHaveAttribute("transform", original!);
    await expect(guestCourt.locator("[data-peer-cursor]")).toHaveCount(1);
    await expect(guestCourt.getByText("Alex", { exact: true })).toBeVisible();
    await host.mouse.up();
    await expect(guestPlayer).toHaveAttribute(
      "transform",
      (await hostPlayer.getAttribute("transform"))!,
    );
    await guest.getByLabel("Template").selectOption("full");
    await expect(hostCourt).toHaveAttribute("viewBox", "-12 -12 824 424");
    // Host undo must retain the guest's court setting.
    await host.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(guestPlayer).toHaveAttribute("transform", original!);
    await expect(guestCourt).toHaveAttribute("viewBox", "-12 -12 824 424");
    await host.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(guestPlayer).not.toHaveAttribute("transform", original!);
    await host
      .getByRole("button", { name: "Drill details", exact: true })
      .click();
    await host
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Shared attack");
    await host
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      guest.getByRole("heading", { name: "Shared attack", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Freehand drawing (B)", exact: true })
      .click();
    await expect(hostCourt.locator("[data-drawing-surface]")).toBeVisible();
    const courtBox = (await hostCourt.boundingBox())!;
    await host.mouse.move(
      courtBox.x + courtBox.width * 0.35,
      courtBox.y + courtBox.height * 0.5,
    );
    await host.mouse.down();
    await host.mouse.move(
      courtBox.x + courtBox.width * 0.6,
      courtBox.y + courtBox.height * 0.6,
      { steps: 8 },
    );
    await expect(hostCourt.locator("[data-drawing-stroke]")).toHaveCount(1);
    await expect(guestCourt.locator("[data-peer-stroke]")).toHaveCount(1);
    await host.mouse.up();
    await expect(guestCourt.locator("[data-drawing-stroke]")).toHaveCount(1);
    await host
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .click();
    await expect(
      guest.getByRole("button", { name: "Switch to light mode", exact: true }),
    ).toBeVisible();
    await host.getByRole("tab", { name: "Animation", exact: true }).click();
    await expect(
      guest.getByRole("tab", { name: "Animation", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await host.getByRole("button", { name: "Add step", exact: true }).click();
    await expect(
      guest.getByRole("button", { name: /02 Step 2/ }),
    ).toBeVisible();
    await host.getByLabel("Onion skin").check();
    await expect(guest.getByLabel("Onion skin")).toBeChecked();
    await host
      .getByRole("button", { name: "Play animation", exact: true })
      .click();
    await expect(
      guest.getByRole("button", { name: "Pause animation", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Live collaboration", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Leave room and keep local copy" })
      .click();
    await expect(
      host.getByRole("button", { name: "Share live room", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Drill details", exact: true })
      .click();
    await host
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Private after leaving");
    await host
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      guest.getByRole("heading", { name: "Shared attack", exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("button", { name: "Live collaboration", exact: true }),
    ).toContainText("Room · 1");
    await guest.reload();
    await expect(guest.locator(".room-waiting")).toHaveCount(0);
    await expect(
      guest.getByRole("button", { name: /02 Step 2/ }),
    ).toBeVisible();
    await expect(guestCourt.locator("image")).toHaveAttribute("href", /^blob:/);
    // Original creator can reconnect to the remaining peer with the same link.
    await host.goto(link);
    await expect(
      host.getByRole("button", { name: "Live collaboration", exact: true }),
    ).toContainText("Live · 2", { timeout: 25000 });
    await expect(host.getByRole("button", { name: /02 Step 2/ })).toBeVisible();
    await host.getByLabel("Toggle library").click();
    await host.getByLabel("Search drills").fill("Private after leaving");
    await expect(host.locator(".drill-card")).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("an unavailable room waits without exposing or replacing the local drill", async ({
  page,
}) => {
  await page.routeWebSocket(/wss:\/\//, (socket) =>
    socket.close({ code: 1013, reason: "Simulated unavailable discovery" }),
  );
  await page.goto(
    "/#room=79995cac-f895-4c0c-856a-a3942234a209&key=567088cc-1c0c-4d18-9a8d-4ec19ac6205e",
  );
  await expect(
    page.getByRole("heading", { name: "Joining live room…" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Peer discovery services could not be reached. Check your internet connection and retry.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await expect(page).toHaveURL(/#room=79995cac/);
  await page.getByRole("button", { name: "Cancel joining" }).click();
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/#room=/);
});

test("public discovery connects separate browser processes despite a failed broker and clock skew", async ({
  browser,
}) => {
  test.skip(
    !process.env.PUBLIC_DISCOVERY,
    "Opt-in check of external public relay availability",
  );
  test.setTimeout(65000);
  const hostContext = await browser.newContext({ serviceWorkers: "block" });
  const remoteBrowser = await browser
    .browserType()
    .launch({ channel: process.env.CI ? undefined : "chrome" });
  const guestContext = await remoteBrowser.newContext({
    serviceWorkers: "block",
    baseURL: test.info().project.use.baseURL,
  });
  await guestContext.addInitScript(() => {
    const now = Date.now.bind(Date);
    Date.now = () => now() + 120000;
  });
  await guestContext.routeWebSocket(
    "wss://broker.emqx.io:8084/mqtt",
    (socket) => socket.close({ code: 1013, reason: "Simulated broker outage" }),
  );
  try {
    const host = await hostContext.newPage(),
      guest = await guestContext.newPage();
    await host.goto("/");
    await host
      .getByRole("button", { name: "Share live room", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Create live room", exact: true })
      .click();
    const link = await host
      .getByLabel("Room link", { exact: true })
      .inputValue();
    await guest.goto(link);
    await expect(
      guest.getByRole("button", { name: "Live collaboration", exact: true }),
    ).toContainText("Live · 2", { timeout: 55000 });
    await expect(guest.locator(".room-waiting")).toHaveCount(0);
    await host.getByLabel("Close dialog").click();
    await host.getByLabel("Template").selectOption("full");
    await expect(
      guest.getByLabel("Interactive handball court"),
    ).toHaveAttribute("viewBox", "-12 -12 824 424");
  } finally {
    await hostContext.close();
    await guestContext.close();
    await remoteBrowser.close();
  }
});
