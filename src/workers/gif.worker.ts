import { GIFEncoder, quantize, applyPalette } from "gifenc";

let encoder = GIFEncoder();
self.onmessage = (event: MessageEvent) => {
  try {
    const { type, rgba, width, height, delay } = event.data;
    if (type === "frame") {
      const pixels = new Uint8Array(rgba);
      const palette = quantize(pixels, 256);
      encoder.writeFrame(applyPalette(pixels, palette), width, height, {
        palette,
        delay,
        repeat: 0,
      });
      self.postMessage({ type: "ready" });
    } else if (type === "finish") {
      encoder.finish();
      const bytes = encoder.bytes();
      self.postMessage(
        { type: "finished", bytes },
        { transfer: [bytes.buffer] },
      );
      encoder = GIFEncoder();
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "GIF encoding failed.",
    });
  }
};
