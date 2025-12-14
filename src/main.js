import './style.css';
import { Compositor } from './compositor.js';
import { Recorder } from './recorder.js';

const app = {
  compositor: null,
  recorder: null,
  isRecording: false,
  webcamStream: null,
  screenStream: null,

  ui: {
    btnStartCamera: document.getElementById('btn-start-camera'),
    btnShareScreen: document.getElementById('btn-share-screen'),
    btnRecord: document.getElementById('btn-record'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    statusIndicator: document.getElementById('status-indicator'),
  },

  async init() {
    this.showLoading(true, "Initializing Engine...");

    try {
      this.compositor = new Compositor('main-canvas');
      await this.compositor.init();

      this.setupEventListeners();
      this.showLoading(false);
      this.setStatus("Ready");
    } catch (e) {
      console.error(e);
      this.showLoading(false);
      this.setStatus("Initialization Failed");
    }
  },

  setupEventListeners() {
    this.ui.btnStartCamera.onclick = async () => {
      this.ui.btnStartCamera.disabled = true;
      try {
        this.webcamStream = await this.compositor.startCamera();
        this.checkReadyToRecord();
      } catch (e) {
        console.error(e);
        this.ui.btnStartCamera.disabled = false;
        alert("Failed to access camera.");
      }
    };

    this.ui.btnShareScreen.onclick = async () => {
      this.ui.btnShareScreen.disabled = true;
      try {
        this.screenStream = await this.compositor.startScreenShare();
        this.checkReadyToRecord();

        // Reset button if they stop sharing via browser UI
        this.screenStream.getVideoTracks()[0].onended = () => {
          this.ui.btnShareScreen.disabled = false;
          this.screenStream = null;
          this.checkReadyToRecord();
        };

      } catch (e) {
        console.error(e);
        this.ui.btnShareScreen.disabled = false;
      }
    };

    this.ui.btnRecord.onclick = () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    };
  },

  checkReadyToRecord() {
    // We allow recording if at least one source is active
    if (this.webcamStream || this.screenStream) {
      this.ui.btnRecord.disabled = false;
    } else {
      this.ui.btnRecord.disabled = true;
    }
  },

  async startRecording() {
    this.isRecording = true;
    this.ui.btnRecord.textContent = "Stop Recording";
    this.ui.btnRecord.classList.add("recording"); // Helper class for styling if needed
    this.setStatus("Recording...");

    // Gather audio streams
    const audioStreams = [];
    if (this.webcamStream) audioStreams.push(this.webcamStream);
    if (this.screenStream) audioStreams.push(this.screenStream);

    this.recorder = new Recorder(this.compositor.getCanvasStream(), audioStreams);
    this.recorder.start();
  },

  async stopRecording() {
    this.isRecording = false;
    this.ui.btnRecord.textContent = "Start Recording";
    this.ui.btnRecord.classList.remove("recording");
    this.ui.btnRecord.disabled = true; // Disable until processing done

    this.showLoading(true, "Finalizing Video...");
    this.setStatus("Processing...");

    const { blob, extension } = await this.recorder.stop();

    try {
      const filename = `fastrecord-output.${extension}`;
      this.download(blob, filename);
      this.setStatus(`Saved as ${extension.toUpperCase()}!`);
    } catch (e) {
      console.error("Save failed", e);
      this.setStatus("Save Failed");
    }

    this.showLoading(false);
    this.checkReadyToRecord();
  },

  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  showLoading(show, text = "") {
    this.ui.loadingOverlay.style.display = show ? 'flex' : 'none';
    if (text) this.ui.loadingText.textContent = text;
  },

  updateLoadingText(text) {
    this.ui.loadingText.textContent = text;
  },

  setStatus(text) {
    this.ui.statusIndicator.textContent = text;
  }
};

app.init();
