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

        // 2. Determine mimeType
        let mimeType = 'video/webm;codecs=vp9,opus';
        let extension = 'webm';

        // Check for MP4 support (Chrome/Safari)
        const mp4Types = [
            'video/mp4;codecs=avc1,mp4a.40.2',
            'video/mp4'
        ];

        for (const type of mp4Types) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                extension = 'mp4';
                break;
            }
        }

        console.log(`Using MIME type: ${mimeType}`);

        // 3. Initialize MediaRecorder with Quality Settings
        // 5 Mbps for Video (Good 1080p quality), 128 kbps for Audio
        const options = {
            mimeType: mimeType,
            videoBitsPerSecond: 5000000,
            audioBitsPerSecond: 128000
        };

        try {
            this.mediaRecorder = new MediaRecorder(mixedStream, options);
        } catch (e) {
            console.warn("Error creating MediaRecorder with options, trying default:", e);
            this.mediaRecorder = new MediaRecorder(mixedStream);
        }

        this.chunks = [];
        this.extension = extension; // Store for saving

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.start(1000); // Collect chunks every second
        console.log("Recording started");
    }

    getRecordedBlob() {
        return {
            blob: this.blob,
            extension: this.extension || 'webm'
        };
    }

    async stop() {
        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                const type = this.mediaRecorder.mimeType || 'video/webm';
                this.blob = new Blob(this.chunks, { type: type });
                console.log("Recording stopped, blob created:", this.blob.size, "Type:", type);
                resolve(this.getRecordedBlob());
            };
            this.mediaRecorder.stop();
        });
    }
}
