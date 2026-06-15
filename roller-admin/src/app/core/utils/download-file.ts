/**
 * Saves a blob to disk, working both in the browser and inside the Tauri
 * desktop shell.
 *
 * The usual `URL.createObjectURL` + `<a download>` + `click()` pattern is
 * silently ignored by Tauri's embedded WebView (WebView2 on Windows,
 * WKWebView on macOS) - clicking does nothing, with no error. Inside Tauri
 * we use the native save dialog + filesystem plugin instead.
 */
export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  if ('__TAURI_INTERNALS__' in window) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: filename });
    if (!path) return;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
