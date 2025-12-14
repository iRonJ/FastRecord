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
    }

    async init() {
        // Initialize Fabric Canvas
        this.fabricCanvas = new fabric.Canvas(this.canvasId, {
            width: this.width,
            height: this.height,
            backgroundColor: '#000',
            selection: false
        });

        // Resize canvas to fit window but keep aspect ratio
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Load BodyPix
        console.log('Loading BodyPix...');
        // Initialize TF.js backend
        await tf.ready();
        this.net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log('BodyPix Loaded');
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

        // Set display size (CSS)
        const canvasEl = document.getElementById(this.canvasId);
        canvasEl.style.width = `${finalWidth}px`;
        canvasEl.style.height = `${finalHeight}px`;

        // Internal size remains high res
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: 30 },
                audio: true
            });
            this.webcamVideo.srcObject = stream;
            await this.webcamVideo.play();

            // Create temporary canvas for segmentation mask
            this.maskCanvas = document.createElement('canvas');
            this.maskCanvas.width = this.webcamVideo.videoWidth;
            this.maskCanvas.height = this.webcamVideo.videoHeight;

            // Create Fabric Image for webcam
            // We will update its element frame by frame
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
                cornerColor: 'white',
                cornerSize: 10,
                transparentCorners: false
            });

            this.fabricCanvas.add(this.webcamImage);
            // Ensure webcam is always on top
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

            // Fabric Image for Screen
            if (this.screenImage) {
                this.fabricCanvas.remove(this.screenImage);
            }

            this.screenImage = new fabric.Image(this.screenVideo, {
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                objectCaching: false, // Important for video
            });

            // Scale screen to fit canvas
            const scale = Math.max(
                this.width / this.screenVideo.videoWidth,
                this.height / this.screenVideo.videoHeight
            );
            // Usually we want to fit, not cover, or cover? Let's fit to width for now
            this.screenImage.scaleToWidth(this.width);

            this.fabricCanvas.add(this.screenImage);
            this.fabricCanvas.sendObjectToBack(this.screenImage);

            // If webcam exists, bring it to front
            if (this.webcamImage) {
                this.fabricCanvas.bringObjectToFront(this.webcamImage);
            }

            // Handle stop sharing
            stream.getVideoTracks()[0].onended = () => {
                this.fabricCanvas.remove(this.screenImage);
                this.screenImage = null;
            };

            this.startRenderLoop(); // Ensure loop is running

            return stream;
        } catch (err) {
            console.error("Error starting screen share:", err);
            throw err;
        }
    }

    startRenderLoop() {
        if (this.animationRunning) return;
        this.animationRunning = true;

        // Offscreen canvas for the mask
        const maskCanvas = document.createElement('canvas');
        // Size will be set in loop if needed, or initialized here if fixed. 
        // Best to check in loop to match video size.
        let maskCtx = null;

        const loop = async () => {
            // 1. Process Webcam (Segmentation)
            if (this.isSegmenting && this.webcamVideo.readyState === 4) {
                try {
                    // Update mask canvas size if changed
                    if (maskCanvas.width !== this.webcamVideo.videoWidth || maskCanvas.height !== this.webcamVideo.videoHeight) {
                        maskCanvas.width = this.webcamVideo.videoWidth;
                        maskCanvas.height = this.webcamVideo.videoHeight;
                        maskCtx = maskCanvas.getContext('2d');
                    }

                    // Foreground (person) = OPAQUE (Alpha 255)
                    // Background = TRANSPARENT (Alpha 0)
                    // We use the mask to 'cut out' the person.
                    const fgColor = { r: 0, g: 0, b: 0, a: 255 }; // R,G,B don't matter for destination-in, only Alpha
                    const bgColor = { r: 0, g: 0, b: 0, a: 0 };

                    const segmentation = await this.net.segmentPerson(this.webcamVideo, {
                        internalResolution: 'medium',
                        segmentationThreshold: 0.7,
                        maxDetections: 1
                    });

                    const maskImageData = bodyPix.toMask(segmentation, fgColor, bgColor);

                    // Put mask on offscreen canvas
                    maskCtx.putImageData(maskImageData, 0, 0);

                    // Draw to final webcam render canvas
                    this.webcamRenderCtx.clearRect(0, 0, this.webcamRenderCanvas.width, this.webcamRenderCanvas.height);

                    this.webcamRenderCtx.save();

                    // 1. Draw Video
                    this.webcamRenderCtx.globalCompositeOperation = 'source-over';
                    this.webcamRenderCtx.drawImage(this.webcamVideo, 0, 0);

                    // 2. Composite Mask
                    // 'destination-in': Keep existing content (video) ONLY where new content (mask) is OPAQUE.
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

            // 2. Mark Screen as dirty
            if (this.screenImage) {
                // Ensure video is playing and has data
                if (this.screenVideo.readyState >= 2) {
                    this.screenImage.dirty = true;
                }
            }

            // 3. Render Canvas
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
