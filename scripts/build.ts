import solidPlugin from "@opentui/solid/bun-plugin";
import { mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  target: "bun",
  plugins: [solidPlugin],
  compile: {
    outfile: "./dist/diffler",
  },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log.message);
  }
  process.exit(1);
}
