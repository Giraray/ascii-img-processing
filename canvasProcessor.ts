interface CanvasProcessorDescriptor {
    context: GPUCanvasContext;
    textArea: HTMLTextAreaElement;
    device: GPUDevice;
}

export default class CanvasProcessor {
    context: GPUCanvasContext;
    textArea: HTMLTextAreaElement;
    device: GPUDevice;

    constructor(config: CanvasProcessorDescriptor) {
        this.context = config.context;
        this.textArea = config.textArea;
        this.device = config.device;
    }

    public async convertToText() {
        const canvas = this.context.canvas;
        const texture = this.context.getCurrentTexture();
        const byteLength = 4 * canvas.height * canvas.width;

        const buffer = this.device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const encoder = this.device.createCommandEncoder();
        encoder.copyTextureToBuffer(
            {texture: texture, origin: [0,0,0]},
            {buffer: buffer},
            [canvas.width, canvas.height, 1]
        );

        await buffer.mapAsync(GPUMapMode.READ);
        const f32Buffer = new Float32Array(buffer.getMappedRange());

        console.log(f32Buffer);
    }
}