import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class Transcoder {
    constructor() {
        this.ffmpeg = new FFmpeg();
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;

        try {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm';
            await this.ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            this.loaded = true;
            console.log("FFmpeg loaded");
        } catch (err) {
            console.error("Failed to load FFmpeg:", err);
            // Fallback for demo if headers are wrong or load fails
            throw new Error("FFmpeg failed to load. Check SharedArrayBuffer support.");
        }
    }

    async transcode(webmBlob) {
        if (!this.loaded) await this.load();

        const inputName = 'input.webm';
        const outputName = 'output.mp4';

        await this.ffmpeg.writeFile(inputName, await fetchFile(webmBlob));

        // -preset ultrafast for speed
        await this.ffmpeg.exec(['-i', inputName, '-c:v', 'copy', outputName]);
        // Uses copy if compatible, or re-encode: ['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', outputName]
        // The previous implementation used copy for video, let's try that first for speed.

        const data = await this.ffmpeg.readFile(outputName);
        return new Blob([data.buffer], { type: 'video/mp4' });
    }
}
