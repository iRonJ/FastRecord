export class Recorder {
    constructor(canvasStream, audioStreams) {
        this.canvasStream = canvasStream;
        this.audioStreams = audioStreams || []; // Array of MediaStreams (mic, system audio)
        this.mediaRecorder = null;
        this.chunks = [];
        this.blob = null;
    }

    start() {
        // 1. Combine Audio Tracks
        const mixedStream = new MediaStream();

        // Add Video Track from Canvas
        this.canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));

        // Add Audio Tracks
        this.audioStreams.forEach(stream => {
            stream.getAudioTracks().forEach(track => mixedStream.addTrack(track));
        });

        // 2. Initialize MediaRecorder
        const options = {
            mimeType: 'video/webm;codecs=vp9,opus'
        };

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn(`${options.mimeType} is not supported, trying default.`);
            delete options.mimeType;
        }

        this.mediaRecorder = new MediaRecorder(mixedStream, options);

        this.chunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.start();
        console.log("Recording started");
    }

    async stop() {
        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                this.blob = new Blob(this.chunks, { type: 'video/webm' });
                console.log("Recording stopped, blob created:", this.blob.size);
                resolve(this.blob);
            };
            this.mediaRecorder.stop();
        });
    }
}
