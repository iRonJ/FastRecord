# FastRecord

**FastRecord** is a modern, privacy-focused, browser-based screen recorder. It allows you to record your screen with a professional webcam overlay—complete with real-time background removal—without installing any software.

Built with **Vite**, **Fabric.js**, and **TensorFlow.js**.

## Features

- **🔒 Privacy First**: All processing runs locally in your browser. No video is ever uploaded to a cloud server.
- **🎥 Professional Composting**:
  - **Screen Sharing**: Use any window or screen as your background.
  - **Webcam Cutout**: AI-powered background removal (BodyPix) creates a clean "streamer style" overlay.
  - **Interactive Overlay**: Drag, **Pinch-to-Resize** (touch/trackpad), and **Scroll-to-Rotate** your webcam bubble.
- **💾 High-Quality Recording**:
  - Records directly to **MP4** (H.264) on supported browsers (Chrome, Safari).
  - Falls back gracefully to WebM on others (Firefox).
  - Records at 1080p, 5Mbps bitrate.
- **📱 Device Support**:
  - Works on Desktop.
  - Works on **Vision Pro** (via HTTPS network sharing).

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm

### Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/iRonJ/FastRecord.git
   cd FastRecord
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to the local URL (usually `https://localhost:5173`).
   *Note: Accept the self-signed certificate warning to enable HTTPS, which is required for camera access.*

## Testing on External Devices (e.g. Vision Pro)

1. Make sure your computer and device are on the **same Wi-Fi network**.
2. Run `npm run dev`.
3. Look for the **Network** URL in the terminal (e.g., `https://192.168.1.50:5173`).
4. Open that URL on your device.
5. Grant Camera/Microphone permissions.

## Architecture

- **`src/compositor.js`**: Core engine using Fabric.js to composite the webcam and screen. Handles the TensorFlow.js segmentation loop.
- **`src/recorder.js`**: Manages the `MediaRecorder` API to capture the canvas stream and mix audio.
- **`vite.config.js`**: Configured with `@vitejs/plugin-basic-ssl` to serve HTTPS for secure context access (required for `getUserMedia` on networks).

## License

MIT
