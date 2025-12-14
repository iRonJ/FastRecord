import * as fabric from 'fabric';
import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';

export class Compositor {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.fabricCanvas = null;
        this.webcamVideo = document.getElementById('webcam-video');
        this.screenVideo = document.getElementById('screen-video');
        this.net = null;
        this.isSegmenting = false;
        this.webcamImage = null;
        this.screenImage = null;

        // Config
        this.width = 1920;
        this.height = 1080;

        // Render canvases for video sources
        this.screenRenderCanvas = null;
        this.screenRenderCtx = null;
    }

    async init() {
        // Initialize Fabric Canvas
        this.fabricCanvas = new fabric.Canvas(this.canvasId, {
            width: this.width,
            height: this.height,
            backgroundColor: '#000',
            selection: true
        });

        // Resize canvas to fit window but keep aspect ratio
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Setup Gestures
        this.setupGestures();

        // Load BodyPix
        console.log('Loading BodyPix...');
        await tf.ready();
        this.net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log('BodyPix Loaded');
    }

    setupGestures() {
        // 1. Scroll to Rotate (Webcam) - only when no ctrl key (ctrl+wheel = pinch on Chrome)
        this.fabricCanvas.on('mouse:wheel', (opt) => {
            const evt = opt.e;

            // Check if this is a pinch gesture (Chrome/Firefox on Mac trackpad)
            if (evt.ctrlKey && this.webcamImage) {
                // Pinch-to-zoom via trackpad (Chrome/Firefox)
                evt.preventDefault();
                evt.stopPropagation();

                const delta = evt.deltaY;
                const currentScale = this.webcamImage.scaleX;
                const scaleFactor = delta > 0 ? 0.95 : 1.05; // Zoom out / in
                const newScale = Math.max(0.1, Math.min(3, currentScale * scaleFactor));

                this.webcamImage.scale(newScale);
                this.fabricCanvas.requestRenderAll();
                return;
            }

            // Regular scroll = rotate (only when webcam is selected)
            if (this.webcamImage && this.fabricCanvas.getActiveObject() === this.webcamImage) {
                evt.preventDefault();
                evt.stopPropagation();

                const curAngle = this.webcamImage.angle || 0;
                this.webcamImage.rotate(curAngle + (evt.deltaY > 0 ? 1 : -1));
                this.fabricCanvas.requestRenderAll();
            }
        });

        // 2. Safari Gesture Events (trackpad pinch on Safari)
        let gestureStartScale = 1;

        document.addEventListener('gesturestart', (e) => {
            if (this.webcamImage) {
                e.preventDefault();
                gestureStartScale = this.webcamImage.scaleX;
            }
        }, { passive: false });

        document.addEventListener('gesturechange', (e) => {
            if (this.webcamImage) {
                e.preventDefault();
                const newScale = Math.max(0.1, Math.min(3, gestureStartScale * e.scale));
                this.webcamImage.scale(newScale);
                this.fabricCanvas.requestRenderAll();
            }
        }, { passive: false });

        document.addEventListener('gestureend', (e) => {
            e.preventDefault();
        }, { passive: false });

        // 2. Pinch to Zoom (Webcam)
        let initialDistance = 0;
        let initialScale = 1;
        let isPinching = false;

        // Get the canvas element - Fabric v6 might expose differently
        const canvasEl = this.fabricCanvas.upperCanvasEl || this.fabricCanvas.getElement();
        console.log('Pinch gesture target element:', canvasEl);

        if (!canvasEl) {
            console.error('Could not find canvas element for touch gestures');
            return;
        }

        canvasEl.addEventListener('touchstart', (e) => {
            console.log('Touch start:', e.touches.length, 'touches');
            if (e.touches.length === 2 && this.webcamImage) {
                isPinching = true;
                initialDistance = this.getDistance(e.touches[0], e.touches[1]);
                initialScale = this.webcamImage.scaleX;
                console.log('Pinch started, initial distance:', initialDistance, 'scale:', initialScale);
                e.preventDefault();
            }
        }, { passive: false });

        canvasEl.addEventListener('touchmove', (e) => {
            if (isPinching && e.touches.length === 2 && this.webcamImage) {
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const scaleFactor = currentDistance / initialDistance;
                const newScale = initialScale * scaleFactor;

                console.log('Pinch move, scale:', newScale);
                this.webcamImage.scale(newScale);
                this.fabricCanvas.requestRenderAll();
                e.preventDefault();
            }
        }, { passive: false });

        canvasEl.addEventListener('touchend', (e) => {
            if (isPinching) {
                console.log('Pinch ended');
                isPinching = false;
            }
        });

        // Prevent default browser zoom gestures (Safari)
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    resizeCanvas() {
        const container = document.getElementById('canvas-container');
        const ratio = this.width / this.height;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        let finalWidth, finalHeight;

        if (containerWidth / containerHeight > ratio) {
            finalHeight = containerHeight;
            finalWidth = finalHeight * ratio;
        } else {
            finalWidth = containerWidth;
            finalHeight = finalWidth / ratio;
        }

        if (this.fabricCanvas) {
            this.fabricCanvas.setDimensions(
                { width: `${finalWidth}px`, height: `${finalHeight}px` },
                { cssOnly: true }
            );
        }
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: 30 },
                audio: true
            });
            this.webcamVideo.srcObject = stream;
            await this.webcamVideo.play();

            const webcamEl = document.createElement('canvas');
            webcamEl.width = this.webcamVideo.videoWidth;
            webcamEl.height = this.webcamVideo.videoHeight;
            this.webcamRenderCanvas = webcamEl;
            this.webcamRenderCtx = webcamEl.getContext('2d');

            this.webcamImage = new fabric.Image(webcamEl, {
                left: this.width - 350,
                top: this.height - 250,
                scaleX: 0.5,
                scaleY: 0.5,
                originX: 'center',
                originY: 'center',
                flipX: true,
                selectable: true,
                hasControls: true,
                hasBorders: true,
                lockUniScaling: false,
                cornerColor: '#bb86fc',
                cornerStyle: 'circle',
                cornerSize: 12,
                transparentCorners: false,
                borderColor: '#bb86fc',
                borderScaleFactor: 2
            });

            this.fabricCanvas.add(this.webcamImage);
            this.fabricCanvas.bringObjectToFront(this.webcamImage);

            this.isSegmenting = true;
            this.startRenderLoop();

            return stream;
        } catch (err) {
            console.error("Error starting camera:", err);
            throw err;
        }
    }

    async startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: true
            });

            this.screenVideo.srcObject = stream;
            await this.screenVideo.play();

            if (this.screenImage) {
                this.fabricCanvas.remove(this.screenImage);
            }

            this.screenRenderCanvas = document.createElement('canvas');
            this.screenRenderCanvas.width = this.screenVideo.videoWidth;
            this.screenRenderCanvas.height = this.screenVideo.videoHeight;
            this.screenRenderCtx = this.screenRenderCanvas.getContext('2d');

            this.screenImage = new fabric.Image(this.screenRenderCanvas, {
                left: 0,
                top: 0,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                objectCaching: false,
            });

            // Scale to fit (contain)
            const scale = Math.min(
                this.width / this.screenVideo.videoWidth,
                this.height / this.screenVideo.videoHeight
            );
            this.screenImage.scale(scale);

            // Center in canvas
            this.screenImage.set({
                left: this.width / 2,
                top: this.height / 2
            });

            this.fabricCanvas.add(this.screenImage);
            this.fabricCanvas.sendObjectToBack(this.screenImage);

            if (this.webcamImage) {
                this.fabricCanvas.bringObjectToFront(this.webcamImage);
            }

            stream.getVideoTracks()[0].onended = () => {
                this.fabricCanvas.remove(this.screenImage);
                this.screenImage = null;
                this.screenRenderCanvas = null;
                this.screenRenderCtx = null;
            };

            this.startRenderLoop();

            return stream;
        } catch (err) {
            console.error("Error starting screen share:", err);
            throw err;
        }
    }

    startRenderLoop() {
        if (this.animationRunning) return;
        this.animationRunning = true;

        const maskCanvas = document.createElement('canvas');
        let maskCtx = null;

        const loop = async () => {
            // 1. Process Webcam (MediaPipe Selfie Segmentation)
            if (this.isSegmenting && this.webcamVideo.readyState === 4) {
                try {
                    // Update mask canvas
                    if (maskCanvas.width !== this.webcamVideo.videoWidth || maskCanvas.height !== this.webcamVideo.videoHeight) {
                        maskCanvas.width = this.webcamVideo.videoWidth;
                        maskCanvas.height = this.webcamVideo.videoHeight;
                        maskCtx = maskCanvas.getContext('2d');
                    }

                    // Run BodyPix segmentation
                    const segmentation = await this.net.segmentPerson(this.webcamVideo, {
                        internalResolution: 'medium',
                        segmentationThreshold: 0.7,
                        maxDetections: 1
                    });

                    // Create mask: person = opaque, background = transparent
                    const fgColor = { r: 0, g: 0, b: 0, a: 255 };
                    const bgColor = { r: 0, g: 0, b: 0, a: 0 };
                    const maskImageData = bodyPix.toMask(segmentation, fgColor, bgColor);

                    // Put mask on offscreen canvas
                    maskCtx.putImageData(maskImageData, 0, 0);

                    // Composite onto webcam render canvas
                    this.webcamRenderCtx.clearRect(0, 0, this.webcamRenderCanvas.width, this.webcamRenderCanvas.height);
                    this.webcamRenderCtx.save();
                    this.webcamRenderCtx.drawImage(this.webcamVideo, 0, 0);
                    this.webcamRenderCtx.globalCompositeOperation = 'destination-in';
                    this.webcamRenderCtx.drawImage(maskCanvas, 0, 0);
                    this.webcamRenderCtx.restore();

                    if (this.webcamImage) {
                        this.webcamImage.dirty = true;
                    }
                } catch (e) {
                    console.warn("Segmentation error:", e);
                }
            }

            if (this.screenImage && this.screenRenderCtx && this.screenVideo.readyState >= 2) {
                this.screenRenderCtx.drawImage(this.screenVideo, 0, 0);
                this.screenImage.dirty = true;
            }

            this.fabricCanvas.renderAll();

            requestAnimationFrame(loop);
        };
        loop();
    }

    getCanvasStream() {
        const canvas = document.getElementById(this.canvasId);
        return canvas.captureStream(30);
    }
}
