/* Dependency-free regression tests. All upload functions come from index.html. */
"use strict";

window.appErrors = [];
const results = [];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equalBytes = (first, second) =>
  first.length === second.length && first.every((value, index) => value === second[index]);

async function rejects(operation, pattern) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error");
    if (pattern) assert(pattern.test(error.message), "Unexpected error: " + error.message);
    return error;
  }
  throw new Error("Expected operation to reject");
}

async function test(name, operation) {
  let timeout;
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Test timed out")), 6000);
      })
    ]);
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.stack || String(error) });
  } finally {
    clearTimeout(timeout);
    document.querySelector("#results").textContent = JSON.stringify(results, null, 2);
  }
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function makeFactory(source) {
  const start = source.indexOf("    const ARDUINO_SAMPLE_COUNT =");
  const end = source.indexOf("    function arduinoBrightnessTable()", start);
  assert(start >= 0 && end > start, "Could not find the Arduino implementation in index.html");
  // Run the actual code in its own lexical scope. Only host APIs and UI are mocked.
  return new Function("$", "state", "arduinoBrightnessTable", "navigator", "fetch",
    "clamp", "showToast", "setTimeout", "clearTimeout", source.slice(start, end) + `
      return {
        profiles: ARDUINO_BOARD_PROFILES,
        fetchFirmwareBytes, loadPatchedFirmware, findFirmwareMarker,
        programAtmega328p, programNanoR4, programSelectedBoard, openDfuSession, enterNanoDfu, dfuOut, dfuStatus,
        pollDfuUntil, downloadNanoFirmware, readDfuProperties, waitForNanoDfu,
        setHooks(hooks) {
          if (hooks.transport) WebSerialTransport = hooks.transport;
          if (hooks.sleep) sleep = hooks.sleep;
          if (hooks.enterNanoDfu) enterNanoDfu = hooks.enterNanoDfu;
          if (hooks.waitForNanoDfu) waitForNanoDfu = hooks.waitForNanoDfu;
          if (hooks.downloadNanoFirmware) downloadNanoFirmware = hooks.downloadNanoFirmware;
          if (hooks.openDfuSessionSettled) openDfuSessionSettled = hooks.openDfuSessionSettled;
          if (hooks.dfuStatus) dfuStatus = hooks.dfuStatus;
          if (hooks.dfuOut) dfuOut = hooks.dfuOut;
          if (hooks.pollDfuUntil) pollDfuUntil = hooks.pollDfuUntil;
          if (hooks.waitForUsbDisconnect) waitForUsbDisconnect = hooks.waitForUsbDisconnect;
        }
      };
    `);
}

function makeHarness(factory, options = {}) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) {
      elements.set(selector, { value: "", textContent: "", style: {}, disabled: false });
    }
    return elements.get(selector);
  };
  element("#arduinoBoard").value = "uno328p";
  element("#arduinoOutput").value = "builtin";
  const state = { duration: 3 };
  const samples = Array.from({ length: 64 }, (_, index) => index * 4);
  const api = factory(element, state, () => samples.slice(), options.navigator || {},
    options.fetch || ((url, init) => fetch(new URL(url, location.origin + "/"), init)),
    (value, min, max) => Math.min(max, Math.max(min, value)), () => {},
    options.setTimeout || setTimeout.bind(window), clearTimeout.bind(window));
  return { api, state, samples, element };
}

function simulatedSerial(events, options = {}) {
  const memory = new Uint8Array(32768);
  memory.fill(0xff);
  let address = 0;
  return class {
    constructor() { this.queue = []; }
    async open(baudRate) { events.push("open:" + baudRate); }
    async resetArduino() { events.push("reset"); }
    drain() { this.queue.length = 0; }
    async close() { events.push("close"); }
    async write(command) {
      const code = command[0];
      let response = [];
      if (code === 0x75) response = options.signature || [0x1e, 0x95, 0x0f];
      if (code === 0x55) address = (command[1] | command[2] << 8) * 2;
      if (code === 0x64) {
        events.push("write:" + address);
        memory.set(command.slice(4, -1), address);
      }
      if (code === 0x74) {
        events.push("read:" + address);
        response = Array.from(memory.slice(address, address + (command[1] << 8 | command[2])));
        if (options.corruptRead) response[0] ^= 1;
      }
      if (code === 0x51) events.push("leave");
      this.queue.push(0x14, ...response, 0x10);
    }
    async readByte() {
      assert(this.queue.length > 0, "Mock serial response exhausted");
      return this.queue.shift();
    }
    async readBytes(count) {
      const bytes = [];
      for (let index = 0; index < count; index++) bytes.push(await this.readByte());
      return Uint8Array.from(bytes);
    }
  };
}

// A runtime USB device whose selected native call stays pending until the test
// explicitly releases it. The real descriptor/session/DETACH code runs unchanged.
function runtimeUsbFixture(stalledOperation) {
  const gate = deferred();
  const events = [];
  const alternate = { alternateSetting: 1, interfaceClass: 0xfe,
    interfaceSubclass: 1, interfaceProtocol: 1 };
  const configuration = { configurationValue: 1,
    interfaces: [{ interfaceNumber: 2, alternates: [alternate] }] };
  const descriptor = Uint8Array.from([
    9, 2, 27, 0, 1, 1, 0, 0x80, 50,
    9, 4, 2, 1, 0, 0xfe, 1, 1, 0,
    9, 0x21, 0x0b, 0xe8, 3, 0, 4, 0x10, 1
  ]);
  async function invoke(name, complete) {
    events.push(name);
    if (name === stalledOperation) await gate.promise;
    return complete();
  }
  const device = {
    vendorId: 0x2341, productId: 0x0074, serialNumber: "runtime-test-board",
    opened: false, configuration: null, configurations: [configuration],
    open: () => invoke("open", () => { device.opened = true; }),
    selectConfiguration: () => invoke("selectConfiguration", () => {
      device.configuration = configuration;
    }),
    claimInterface: () => invoke("claimInterface", () => {}),
    selectAlternateInterface: () => invoke("selectAlternateInterface", () => {}),
    controlTransferIn: (_, length) => invoke("controlTransferIn", () => ({
      status: "ok", data: new DataView(descriptor.slice(0, length).buffer)
    })),
    controlTransferOut: (_, data) => invoke("controlTransferOut", () => ({
      status: "ok", bytesWritten: data.byteLength
    })),
    close: () => invoke("close", () => { device.opened = false; })
  };
  const upgrade = { vendorId: device.vendorId, productId: 0x0374,
    serialNumber: device.serialNumber };
  const usb = new EventTarget();
  usb.requestDevice = async () => device;
  usb.getDevices = async () => [upgrade];
  return { device, upgrade, usb, events, gate };
}

async function main() {
  const source = await (await fetch("/index.html")).text();
  const factory = makeFactory(source);
  const fixtures = {};
  for (const [key, path] of Object.entries({
    avr: "/firmware/atmega328p-player/atmega328p-player.bin",
    nano: "/firmware/nano-r4-player/nano-r4-player.bin"
  })) {
    const response = await fetch(path);
    assert(response.ok, "Fixture not served: " + path);
    fixtures[key] = new Uint8Array(await response.arrayBuffer());
  }
  const responseFor = bytes => new Response(bytes.slice());
  const firmwareError = /firmware|configuration|config|download|reload|marker/i;

  await test("Shipped firmware patches all four board profiles", async () => {
    const harness = makeHarness(factory);
    harness.state.duration = 4.25;
    harness.element("#arduinoOutput").value = "pwm9";
    for (const profile of Object.values(harness.api.profiles)) {
      const original = fixtures[profile.transport === "dfu" ? "nano" : "avr"];
      const patched = new Uint8Array(await harness.api.loadPatchedFirmware(profile));
      const marker = new TextEncoder().encode(profile.marker);
      const offset = harness.api.findFirmwareMarker(patched, marker) + marker.length;
      assert(patched.length === original.length, profile.key + ": firmware length changed");
      assert(new DataView(patched.buffer).getUint32(offset, true) === 4250,
        profile.key + ": duration did not patch");
      assert(patched[offset + 4] === 1 && patched[offset + 5] === 9,
        profile.key + ": output did not patch");
      assert(equalBytes(patched.slice(offset + 8, offset + 72), harness.samples),
        profile.key + ": brightness table did not patch");
    }
  });

  await test("Repeated patches preserve the cached source firmware", async () => {
    let calls = 0;
    const harness = makeHarness(factory, { fetch: async () => {
      calls++;
      return responseFor(fixtures.avr);
    } });
    const profile = harness.api.profiles.uno328p;
    const raw = await harness.api.fetchFirmwareBytes(profile);
    const first = new Uint8Array(await harness.api.loadPatchedFirmware(profile));
    harness.state.duration = 6;
    harness.samples.fill(99);
    const second = new Uint8Array(await harness.api.loadPatchedFirmware(profile));
    assert(calls === 1, "Cache did not share the source fetch");
    assert(equalBytes(raw, fixtures.avr), "Patching modified the cached source");
    assert(!equalBytes(first, second), "New curve was not applied on repeated upload");
  });

  await test("Failed firmware downloads are retryable", async () => {
    let calls = 0;
    const harness = makeHarness(factory, { fetch: async () =>
      ++calls === 1 ? new Response("missing", { status: 404 }) : responseFor(fixtures.avr)
    });
    const profile = harness.api.profiles.uno328p;
    await rejects(() => harness.api.loadPatchedFirmware(profile), firmwareError);
    await harness.api.loadPatchedFirmware(profile);
    assert(calls === 2, "Failed download was retained in cache");
  });

  await test("Truncated firmware configuration is rejected clearly", async () => {
    const inspect = makeHarness(factory);
    const profile = inspect.api.profiles.uno328p;
    const marker = new TextEncoder().encode(profile.marker);
    const offset = inspect.api.findFirmwareMarker(fixtures.avr, marker);
    const truncated = fixtures.avr.slice(0, offset + marker.length + 3);
    const harness = makeHarness(factory, { fetch: async () => responseFor(truncated) });
    const error = await rejects(() => harness.api.loadPatchedFirmware(
      harness.api.profiles.uno328p), firmwareError);
    assert(!(error instanceof RangeError), "Truncation leaked an incidental DataView error");
  });

  await test("Damaged firmware marker is rejected", async () => {
    const inspect = makeHarness(factory);
    const profile = inspect.api.profiles.uno328p;
    const damaged = fixtures.avr.slice();
    const offset = inspect.api.findFirmwareMarker(damaged,
      new TextEncoder().encode(profile.marker));
    damaged[offset] ^= 0xff;
    const harness = makeHarness(factory, { fetch: async () => responseFor(damaged) });
    await rejects(() => harness.api.loadPatchedFirmware(harness.api.profiles.uno328p),
      firmwareError);
  });

  await test("Duplicate curve markers are rejected", async () => {
    const harness = makeHarness(factory);
    const marker = new TextEncoder().encode(harness.api.profiles.uno328p.marker);
    const duplicate = new Uint8Array(marker.length * 2);
    duplicate.set(marker);
    duplicate.set(marker, marker.length);
    await rejects(async () => harness.api.findFirmwareMarker(duplicate, marker), /multiple/i);
  });

  await test("Corruption outside the curve configuration is rejected", async () => {
    const damaged = fixtures.avr.slice();
    damaged[0] ^= 1;
    const harness = makeHarness(factory, { fetch: async () => responseFor(damaged) });
    await rejects(() => harness.api.loadPatchedFirmware(harness.api.profiles.uno328p),
      firmwareError);
  });

  await test("Firmware loading snapshots curve settings before a slow fetch", async () => {
    const gate = deferred();
    const harness = makeHarness(factory, { fetch: () => gate.promise });
    const profile = harness.api.profiles.uno328p;
    const loading = harness.api.loadPatchedFirmware(profile);
    harness.state.duration = 12;
    harness.samples.fill(3);
    harness.element("#arduinoOutput").value = "pwm9";
    gate.resolve(responseFor(fixtures.avr));
    const bytes = new Uint8Array(await loading);
    const offset = harness.api.findFirmwareMarker(bytes,
      new TextEncoder().encode(profile.marker)) + profile.marker.length;
    assert(new DataView(bytes.buffer).getUint32(offset, true) === 3000,
      "Duration changed while the firmware was loading");
    assert(bytes[offset + 4] === 0, "Output changed while firmware was loading");
    assert(bytes[offset + 9] === 4, "Curve changed while firmware was loading");
  });

  function avrHarness(fetchImpl, options = {}) {
    const events = [];
    const harness = makeHarness(factory, {
      fetch: fetchImpl,
      navigator: { serial: { requestPort: async () => { events.push("picker"); return {}; } } }
    });
    harness.api.setHooks({ transport: simulatedSerial(events, options) });
    return { ...harness, events };
  }

  await test("AVR waits for firmware before opening or resetting the serial port", async () => {
    const gate = deferred();
    const harness = avrHarness(() => gate.promise);
    const pending = harness.api.programAtmega328p(harness.api.profiles.uno328p);
    const outcome = pending.then(() => null, error => error);
    assert(harness.events[0] === "picker", "Serial picker was not called synchronously");
    await wait(30);
    const eventsBeforeFirmware = harness.events.slice();
    gate.resolve(responseFor(fixtures.avr));
    const error = await outcome;
    assert(!error, String(error));
    assert(eventsBeforeFirmware.join(",") === "picker",
      "Serial was touched before firmware was ready: " + eventsBeforeFirmware.join(", "));
    assert(harness.events.includes("reset"), "Serial reset never happened");
    assert(harness.events.at(-1) === "close", "Port was not closed after success");
  });

  await test("AVR failed firmware download leaves the selected serial port untouched", async () => {
    const harness = avrHarness(async () => new Response("missing", { status: 404 }));
    await rejects(() => harness.api.programAtmega328p(harness.api.profiles.uno328p),
      firmwareError);
    assert(harness.events.join(",") === "picker",
      "Failed preparation touched the port: " + harness.events.join(", "));
  });

  await test("AVR writes and reads back every page before leaving programming mode", async () => {
    const harness = avrHarness(async () => responseFor(fixtures.avr));
    await harness.api.programAtmega328p(harness.api.profiles.uno328p);
    const writes = harness.events.filter(event => event.startsWith("write:"));
    const reads = harness.events.filter(event => event.startsWith("read:"));
    const expectedPages = Math.ceil(fixtures.avr.length / 128);
    assert(writes.length === expectedPages && reads.length === expectedPages,
      "Not every page was written and verified");
    assert(harness.events.at(-2) === "leave" && harness.events.at(-1) === "close",
      "Programming mode or serial port was not released");
  });

  await test("AVR signature mismatch stops before writing and closes the port", async () => {
    const harness = avrHarness(async () => responseFor(fixtures.avr),
      { signature: [0, 0, 0] });
    await rejects(() => harness.api.programAtmega328p(harness.api.profiles.uno328p),
      /signature|ATmega328P/i);
    assert(!harness.events.some(event => event.startsWith("write:")),
      "Wrong chip received a flash write");
    assert(harness.events.at(-1) === "close", "Port was not closed after signature failure");
  });

  await test("AVR verification mismatch is reported and closes the port", async () => {
    const harness = avrHarness(async () => responseFor(fixtures.avr), { corruptRead: true });
    await rejects(() => harness.api.programAtmega328p(harness.api.profiles.uno328p),
      /verif/i);
    assert(harness.events.at(-1) === "close", "Port was not closed after verification failure");
    assert(!harness.events.includes("leave"), "Failed image was reported as a clean upload");
  });

  await test("Nano R4 waits for firmware before resetting into DFU", async () => {
    const gate = deferred();
    const events = [];
    const harness = makeHarness(factory, {
      fetch: () => gate.promise,
      navigator: { usb: { requestDevice: async () => {
        events.push("picker");
        return { productId: 0x0074 };
      } } }
    });
    harness.api.setHooks({
      enterNanoDfu: async () => { events.push("reset"); return { productId: 0x0374 }; },
      downloadNanoFirmware: async () => { events.push("download"); }
    });
    const pending = harness.api.programNanoR4(harness.api.profiles.nanor4);
    const outcome = pending.then(() => null, error => error);
    assert(events[0] === "picker", "USB picker was not called synchronously");
    await wait(30);
    const before = events.slice();
    gate.resolve(responseFor(fixtures.nano));
    const error = await outcome;
    assert(!error, String(error));
    assert(before.join(",") === "picker", "Nano reset before firmware validation: " + before);
    assert(events.join(",") === "picker,reset,download", "Unexpected Nano upload sequence");
  });


  await test("Nano R4 failed firmware validation does not reset or download", async () => {
    const events = [];
    const harness = makeHarness(factory, {
      fetch: async () => new Response("missing", { status: 404 }),
      navigator: { usb: { requestDevice: async () => ({ productId: 0x0074 }) } }
    });
    harness.api.setHooks({
      enterNanoDfu: async () => { events.push("reset"); return { productId: 0x0374 }; },
      downloadNanoFirmware: async () => { events.push("download"); }
    });
    await rejects(() => harness.api.programNanoR4(harness.api.profiles.nanor4), firmwareError);
    assert(events.length === 0, "Failed firmware preparation touched the Nano");
  });

  await test("Nano R4 permission handoff requires a second click and selects only Upgrade", async () => {
    const selections = [];
    let downloads = 0;
    const harness = makeHarness(factory, {
      fetch: async () => responseFor(fixtures.nano),
      navigator: { usb: { requestDevice: async options => {
        selections.push(options.filters);
        return { productId: selections.length === 1 ? 0x0074 : 0x0374,
          close: async () => {} };
      } } }
    });
    harness.api.setHooks({
      enterNanoDfu: async () => { throw new Error("Bootloader permission is not granted"); },
      waitForNanoDfu: async () => {
        throw new Error("Automatic post-reset wait replaced the required next-click prompt");
      },
      downloadNanoFirmware: async () => { downloads++; }
    });
    await rejects(() => harness.api.programNanoR4(harness.api.profiles.nanor4),
      /click.*again.*Upgrade/i);
    assert(selections.length === 1 && downloads === 0,
      "Permission handoff opened an automatic picker or started flashing");
    await harness.api.programNanoR4(harness.api.profiles.nanor4);
    assert(selections[1].length === 1 && selections[1][0].productId === 0x0374,
      "Second click did not restrict selection to the Upgrade bootloader");
    assert(downloads === 1, "Explicit second click did not resume programming");
  });

  await test("Nano discovery ignores other boards and reports missing bootloader permission", async () => {
    const usb = new EventTarget();
    const other = { vendorId: 0x2341, productId: 0x0374, serialNumber: "other-board" };
    const wanted = { ...other, serialNumber: "selected-board" };
    usb.getDevices = async () => [other];
    const harness = makeHarness(factory, { navigator: { usb } });
    let resolved = false;
    const pending = harness.api.waitForNanoDfu(1000, wanted.serialNumber)
      .then(device => { resolved = true; return device; });
    const wrong = new Event("connect");
    wrong.device = other;
    usb.dispatchEvent(wrong);
    await wait(15);
    assert(!resolved, "Discovery chose a different board");
    const matching = new Event("connect");
    matching.device = wanted;
    usb.dispatchEvent(matching);
    assert(await pending === wanted, "Discovery did not return the selected board");
    usb.getDevices = async () => [];
    await rejects(() => harness.api.waitForNanoDfu(25, wanted.serialNumber),
      /click.*again.*Upgrade/i);
    await rejects(() => harness.api.waitForNanoDfu(25, ""), /click.*again.*Upgrade/i);
  });

  await test("Composite USB descriptor selects DFU instead of HID and supports shared alternates", async () => {
    const configuration = { configurationValue: 1 };
    const descriptor = Uint8Array.from([
      9, 2, 54, 0, 2, 1, 0, 0x80, 50,
      9, 4, 0, 0, 0, 3, 0, 0, 0,
      9, 0x21, 0x11, 1, 0, 1, 0x22, 0x3f, 0,
      9, 4, 1, 0, 0, 0xfe, 1, 2, 0,
      9, 4, 1, 1, 0, 0xfe, 1, 2, 0,
      9, 0x21, 7, 0xe8, 3, 0, 4, 0x10, 1
    ]);
    const device = {
      configurations: [configuration],
      controlTransferIn: async (_, length) => ({
        status: "ok", data: new DataView(descriptor.slice(0, length).buffer)
      })
    };
    const harness = makeHarness(factory);
    const properties = await harness.api.readDfuProperties(device, configuration, 1, 0);
    assert(properties.transferSize === 1024, "HID descriptor was mistaken for DFU");
    assert(properties.canDownload && properties.manifestationTolerant,
      "DFU capabilities were not parsed");
    await rejects(() => harness.api.readDfuProperties(device, configuration, 1, 2),
      /descriptor|DFU|interface/i);
  });

  await test("Real Nano runtime handoff reads descriptors, detaches, and closes", async () => {
    const fixture = runtimeUsbFixture(null);
    const harness = makeHarness(factory, {
      navigator: { usb: fixture.usb },
      setTimeout: (callback, milliseconds, ...args) =>
        setTimeout(callback, Math.min(milliseconds, 50), ...args)
    });
    const device = await harness.api.enterNanoDfu(fixture.device);
    assert(device === fixture.upgrade, "Runtime handoff did not select the matching Upgrade device");
    assert(fixture.events.filter(event => event !== "close").join(",") === [
      "open", "selectConfiguration", "claimInterface", "selectAlternateInterface",
      "controlTransferIn", "controlTransferIn", "controlTransferOut"
    ].join(","), "Runtime native calls were incomplete: " + fixture.events.join(","));
    assert(fixture.events.includes("close"), "Runtime device was not closed");
    assert(!fixture.device.opened, "Runtime device was left open after a successful handoff");
  });

  for (const operation of ["open", "selectConfiguration", "claimInterface",
    "selectAlternateInterface", "controlTransferIn", "controlTransferOut", "close"]) {
    await test("Hung runtime USB " + operation + " releases UI and prevents late continuation", async () => {
      const fixture = runtimeUsbFixture(operation);
      const harness = makeHarness(factory, {
        fetch: async () => responseFor(fixtures.nano),
        navigator: { usb: fixture.usb },
        setTimeout: (callback, milliseconds, ...args) =>
          setTimeout(callback, Math.min(milliseconds, 50), ...args)
      });
      harness.element("#arduinoBoard").value = "nanor4";
      harness.api.setHooks({ downloadNanoFirmware: async () => {
        fixture.events.push("download");
      } });
      const running = harness.api.programSelectedBoard();
      try {
        await Promise.race([
          running,
          wait(400).then(() => { throw new Error("Native " + operation + " left programming stuck"); })
        ]);
        assert(fixture.events.includes(operation), "Test did not reach native " + operation);
        for (const selector of ["#programBoardBtn", "#arduinoBoard", "#arduinoOutput"]) {
          assert(!harness.element(selector).disabled, selector + " stayed disabled after timeout");
        }
        const message = harness.element("#programStatus").textContent;
        assert(/timed out|timeout/i.test(message), "Timeout cause was lost: " + message);
        assert(/RESET/.test(message), "Physical recovery instructions were missing: " + message);
        assert(!fixture.events.includes("download"), "A stalled reset was followed by firmware writing");
        const beforeLateCompletion = fixture.events.filter(event => event !== "close").join(",");
        fixture.gate.resolve();
        await wait(40);
        assert(fixture.events.filter(event => event !== "close").join(",") === beforeLateCompletion,
          "Timed-out native " + operation + " continued after late completion: " + fixture.events.join(","));
        assert(!fixture.device.opened, "Late native " + operation + " left the runtime device open");
        if (operation === "open") {
          await rejects(() => harness.api.enterNanoDfu(fixture.device), /RESET|reconnect|unplug/i);
          assert(fixture.events.filter(event => event !== "close").join(",") === beforeLateCompletion,
            "A timed-out runtime device was reused without a physical reset");
        }
      } finally {
        fixture.gate.resolve();
      }
    });
  }

  await test("DFU rejects a stalled control transfer", async () => {
    const harness = makeHarness(factory);
    await rejects(() => harness.api.dfuOut({
      interfaceNumber: 0,
      device: { controlTransferOut: async () => ({ status: "stall", bytesWritten: 0 }) }
    }, 1, new Uint8Array([1])), /stall|transfer/i);
  });

  await test("DFU nonzero status rejects even when the state matches", async () => {
    const harness = makeHarness(factory);
    harness.api.setHooks({ dfuStatus: async () => ({ status: 3, state: 5, pollTimeout: 0 }) });
    await rejects(() => harness.api.pollDfuUntil({}, state => state === 5), /status|DFU/i);
  });

  await test("DFU manifestation timeout is not silently treated as success", async () => {
    const harness = makeHarness(factory, { navigator: { usb: new EventTarget() } });
    const events = [];
    let polls = 0;
    const device = { close: async () => { events.push("close"); } };
    harness.api.setHooks({
      sleep: async () => {},
      openDfuSessionSettled: async () => ({
        device, interfaceNumber: 0, properties: { transferSize: 1024, canDownload: true }
      }),
      dfuStatus: async () => ({ state: 2, status: 0, pollTimeout: 0 }),
      dfuOut: async (_, request) => { events.push("request:" + request); return 1; },
      pollDfuUntil: async () => {
        if (++polls === 1) return { state: 5, status: 0, pollTimeout: 0 };
        throw new Error("Nano R4 DFU operation timed out");
      },
      waitForUsbDisconnect: async () => {}
    });
    await rejects(() => harness.api.downloadNanoFirmware(device, new Uint8Array([1]).buffer),
      /timed out/i);
    assert(events.at(-1) === "close", "DFU device was not closed after failure");
    assert(!events.includes("request:0"), "Failed manifestation was followed by success detach");
  });

  await test("Application starts without exceptions and opens Arduino code for every board", async () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width:1280px;height:900px";
    const loaded = new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = () => reject(new Error("Application iframe failed to load"));
    });
    iframe.src = "/__app_smoke__.html";
    document.body.append(iframe);
    try {
      await loaded;
      await wait(150);
      const doc = iframe.contentDocument;
      const button = doc.querySelector("#arduinoBtn");
      assert(button, "Arduino code button is missing");
      button.click();
      assert(doc.querySelector("#arduinoDialog").open, "Arduino dialog did not open");
      const board = doc.querySelector("#arduinoBoard");
      for (const option of board.options) {
        board.value = option.value;
        board.dispatchEvent(new iframe.contentWindow.Event("change", { bubbles: true }));
        assert(doc.querySelector("#arduinoCode").textContent.includes("void setup()"),
          "Arduino sketch is missing for " + option.value);
        assert(doc.querySelector("#programBoardBtn").textContent.includes("Program"),
          "Programming button is missing for " + option.value);
      }
      await wait(150);
      assert(window.appErrors.length === 0, "Application errors: " + window.appErrors.join("; "));
    } finally {
      iframe.remove();
    }
  });
}

(async () => {
  let fatal;
  try { await main(); } catch (error) { fatal = error.stack || String(error); }
  const report = { tests: results, fatal };
  document.querySelector("#results").textContent = JSON.stringify(report, null, 2);
  await fetch("/__test_result__", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report)
  });
})();
