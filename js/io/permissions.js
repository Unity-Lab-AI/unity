// permissions.js — Browser permission requests for mic/camera
// Stores grant status in localStorage so we know what's available
// Supports device selection via localStorage preferences

const STORAGE_KEY = 'unity_brain_permissions';
const DEVICE_KEY = 'unity_device_prefs';
const TIMEOUT_MS = 5000; // Don't hang forever on bad devices

/**
 * Request microphone and camera permissions independently.
 * If one fails or times out, the other still gets attempted.
 * Checks localStorage for preferred deviceId (set via settings).
 * Returns { mic, camera, micStream, cameraStream }
 */
export async function requestPermissions() {
  const result = {
    mic: false,
    camera: false,
    micStream: null,
    cameraStream: null
  };

  const prefs = getDevicePrefs();

  // Request microphone
  try {
    const audioConstraints = prefs.micId
      ? { audio: { deviceId: { exact: prefs.micId } } }
      : { audio: true };
    const micStream = await withTimeout(
      navigator.mediaDevices.getUserMedia(audioConstraints),
      TIMEOUT_MS,
      'Microphone timed out'
    );
    result.mic = true;
    result.micStream = micStream;
  } catch (err) {
    console.warn('Microphone:', err.message);
    // Retry without specific device if preferred device failed
    if (prefs.micId) {
      try {
        const micStream = await withTimeout(
          navigator.mediaDevices.getUserMedia({ audio: true }),
          TIMEOUT_MS,
          'Microphone fallback timed out'
        );
        result.mic = true;
        result.micStream = micStream;
      } catch (err2) {
        console.warn('Microphone fallback:', err2.message);
      }
    }
  }

  // Request camera — independent of mic result
  try {
    const videoConstraints = prefs.cameraId
      ? { video: { deviceId: { exact: prefs.cameraId } } }
      : { video: true };
    const cameraStream = await withTimeout(
      navigator.mediaDevices.getUserMedia(videoConstraints),
      TIMEOUT_MS,
      'Camera timed out'
    );
    result.camera = true;
    result.cameraStream = cameraStream;
  } catch (err) {
    console.warn('Camera:', err.message);
    if (prefs.cameraId) {
      try {
        const cameraStream = await withTimeout(
          navigator.mediaDevices.getUserMedia({ video: true }),
          TIMEOUT_MS,
          'Camera fallback timed out'
        );
        result.camera = true;
        result.cameraStream = cameraStream;
      } catch (err2) {
        console.warn('Camera fallback:', err2.message);
      }
    }
  }

  // Persist what was granted
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mic: result.mic,
      camera: result.camera,
      timestamp: Date.now()
    }));
  } catch {}

  return result;
}

/**
 * List available audio/video devices for settings UI.
 */
export async function listDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      microphones: devices.filter(d => d.kind === 'audioinput'),
      cameras: devices.filter(d => d.kind === 'videoinput'),
      speakers: devices.filter(d => d.kind === 'audiooutput'),
    };
  } catch {
    return { microphones: [], cameras: [], speakers: [] };
  }
}

/**
 * Save preferred device IDs.
 */
export function saveDevicePrefs(prefs) {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(prefs));
  } catch {}
}

/**
 * Load preferred device IDs.
 */
export function getDevicePrefs() {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

/**
 * Returns previously granted permissions from localStorage.
 */
export function getGrantedPermissions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        mic: parsed.mic || false,
        camera: parsed.camera || false,
        timestamp: parsed.timestamp || null
      };
    }
  } catch {}
  return { mic: false, camera: false, timestamp: null };
}

// --- Helpers ---

function withTimeout(promise, ms, msg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}
