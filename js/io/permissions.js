// permissions.js — Browser permission requests for mic/camera
// Stores grant status in localStorage so we know what's available

const STORAGE_KEY = 'unity_brain_permissions';

/**
 * Request microphone and camera permissions independently.
 * If one fails, the other still gets attempted.
 * Returns { mic, camera, micStream, cameraStream }
 */
export async function requestPermissions() {
  const result = {
    mic: false,
    camera: false,
    micStream: null,
    cameraStream: null
  };

  // Request microphone
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    result.mic = true;
    result.micStream = micStream;
  } catch (err) {
    console.warn('Microphone permission denied or unavailable:', err.message);
  }

  // Request camera — independent of mic result
  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    result.camera = true;
    result.cameraStream = cameraStream;
  } catch (err) {
    console.warn('Camera permission denied or unavailable:', err.message);
  }

  // Persist what was granted
  const granted = {
    mic: result.mic,
    camera: result.camera,
    timestamp: Date.now()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(granted));
  } catch (err) {
    console.warn('Could not save permission state to localStorage:', err.message);
  }

  return result;
}

/**
 * Returns previously granted permissions from localStorage.
 * Returns { mic: false, camera: false } if nothing stored.
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
  } catch (err) {
    console.warn('Could not read permission state from localStorage:', err.message);
  }

  return { mic: false, camera: false, timestamp: null };
}
