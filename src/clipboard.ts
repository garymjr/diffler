const decoder = new TextDecoder();
const encoder = new TextEncoder();

type ClipboardResult = {
  ok: boolean;
  error?: string;
};

type ClipboardCommand = {
  cmd: string;
  args: string[];
};

const linuxCommands: ClipboardCommand[] = [
  { cmd: "wl-copy", args: ["--foreground"] },
  { cmd: "xclip", args: ["-selection", "clipboard"] },
];

export function copyToClipboard(text: string): ClipboardResult {
  const platform = process.platform;
  if (platform === "darwin") {
    return runClipboard({ cmd: "pbcopy", args: [] }, text);
  }
  if (platform === "win32") {
    return runClipboard({ cmd: "clip", args: [] }, text);
  }

  for (const command of linuxCommands) {
    const result = runClipboard(command, text);
    if (result.ok) return result;
  }

  return { ok: false, error: "No clipboard command available." };
}

function runClipboard(command: ClipboardCommand, text: string): ClipboardResult {
  try {
    const result = Bun.spawnSync({
      cmd: [command.cmd, ...command.args],
      stdin: encoder.encode(text),
      stdout: "ignore",
      stderr: "pipe",
    });

    if (result.exitCode === 0) return { ok: true };
    const stderr = decoder.decode(result.stderr).trim();
    return { ok: false, error: stderr || `Clipboard command failed: ${command.cmd}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Clipboard command failed.",
    };
  }
}
