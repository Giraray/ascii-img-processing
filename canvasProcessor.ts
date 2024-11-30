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
        this.textArea.innerHTML = ":)"
    }
}