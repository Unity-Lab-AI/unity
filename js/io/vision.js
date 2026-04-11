/**
 * vision.js — Camera capture + AI-powered scene description + gaze tracking
 *
 * Captures frames from the user's webcam and sends them to an AI
 * model for description. Returns both what Unity sees AND where
 * the point of interest is in the frame (gaze coordinates).
 */

export class Vision {
  constructor() {
    this._stream = null;
    this._video = null;
    this._canvas = null;
    this._ctx = null;
    this._lastDescription = '';
    this._lastCaptureTime = 0;
    this._captureInterval = 8000;
    this._active = false;
    this._describer = null;

    // Gaze target — normalized 0-1 coordinates of where Unity is looking
    this.gazeX = 0.5;
    this.gazeY = 0.5;
    this.gazeTarget = ''; // what she's focused on
  }

  init(stream, describer) {
    if (!stream) return;
    this._stream = stream;
    this._describer = describer;

    this._video = document.createElement('video');
    this._video.srcObject = stream;
    this._video.setAttribute('playsinline', '');
    this._video.muted = true;
    this._video.style.display = 'none';
    document.body.appendChild(this._video);
    this._video.play();

    this._canvas = document.createElement('canvas');
    this._canvas.width = 320;
    this._canvas.height = 240;
    this._ctx = this._canvas.getContext('2d');

    this._active = true;
    console.log('[Vision] Camera initialized');
  }

  captureFrame() {
    if (!this._active || !this._video || !this._ctx) return null;
    this._ctx.drawImage(this._video, 0, 0, 320, 240);
    return this._canvas.toDataURL('image/jpeg', 0.6);
  }

  /**
   * Get a description + gaze coordinates of what the camera sees.
   * The AI returns JSON with description, focus point, and target name.
   */
  async getDescription(lookFor = null) {
    if (!this._active) return 'Camera not available.';

    const now = Date.now();
    // Skip cache if we're looking for something specific
    if (!lookFor && now - this._lastCaptureTime < this._captureInterval && this._lastDescription) {
      return this._lastDescription;
    }

    const frame = this.captureFrame();
    if (!frame) return this._lastDescription || 'Camera frame capture failed.';

    if (this._describer) {
      try {
        const result = await this._describer(frame, lookFor);
        if (typeof result === 'object' && result.description) {
          this._lastDescription = result.description;
          this.gazeX = result.gazeX ?? 0.5;
          this.gazeY = result.gazeY ?? 0.5;
          this.gazeTarget = result.target || '';
        } else {
          this._lastDescription = String(result);
        }
        this._lastCaptureTime = now;
      } catch (err) {
        console.warn('[Vision] Description failed:', err.message);
      }
    }

    return this._lastDescription || 'Could not describe scene.';
  }

  /**
   * Look at something specific — forces a fresh capture and targeted description.
   */
  async lookAt(thing) {
    return this.getDescription(thing);
  }

  getLastDescription() {
    return this._lastDescription || 'No visual context yet.';
  }

  getGaze() {
    return { x: this.gazeX, y: this.gazeY, target: this.gazeTarget };
  }

  isActive() {
    return this._active;
  }

  destroy() {
    this._active = false;
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
    }
    if (this._video) this._video.remove();
  }
}
