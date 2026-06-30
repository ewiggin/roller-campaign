// Desktop (Tauri) build. The Rust shell injects the sidecar's dynamic port as
// a global via initialization_script before any app code runs, so reading it
// at module-evaluation time is safe. The sidecar binds to 127.0.0.1 only —
// do not use "localhost" (it may resolve to ::1, where nothing listens).
declare global {
  interface Window {
    __ROLLER_API_PORT__?: number;
  }
}

const urlPort = parseInt(new URLSearchParams(window.location.search).get('_port') ?? '', 10);
const apiPort = window.__ROLLER_API_PORT__ ?? (Number.isFinite(urlPort) ? urlPort : 3000);

export const environment = {
  production: true,
  apiUrl: `http://127.0.0.1:${apiPort}/api`,
  googleMapsApiKey: 'AIzaSyCAlxhBc7f3JB3dcUtamk_vka3VGGccOlQ',
  version: '0.6.0',
};
