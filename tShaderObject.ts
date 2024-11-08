interface Size {
    width: number,
    height: number,
}

interface RenderDescriptor {
    size: Size;
    canvasFormat: GPUTextureFormat,
    context: GPUCanvasContext;
    finalRender?: boolean;
    renderTarget?: GPUTexture
}

type ShaderType =
    'render' |
    'compute'

export interface ShaderProgram {
    label: string;
    passType: ShaderType;
    pipeline: GPURenderPipeline | GPUComputePipeline;
    entries: Array<GPUBindGroupEntry>;
    workgroupSize?: number;
}

export interface ProgramInstructions {
    label: string;
    passes: Array<ShaderProgram>;
}

export abstract class ShaderObject {
    canvasFormat: GPUTextureFormat; // YUUUUCK!!!!!!!!!!!!
    context: GPUCanvasContext;
    size: Size;

    code: string;
    shaderModule: GPUShaderModule;
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
    texture: GPUTexture;

    timeout: number;
    time: number;
    lastUpdate: number;

    static: boolean;
    readonly device: GPUDevice;
    readonly sampler: GPUSampler;

    constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
        this.device = device;
        this.canvasFormat = canvasFormat;

        this.static = false;

        this.sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
        this.time = 0;
        this.lastUpdate = Date.now();
    }

    abstract createInstructions(...args: any): ProgramInstructions;

    /**
     * This is easily the ugliest function I have ever had the displeasure of writing.
     * I'm sorry, future me.
     * @param options
     */
    render(options: RenderDescriptor) {
        const w = options.size.width;
        const h = options.size.height;

        // these are used in config events in order to internally call render()
        this.size = {width: w, height: h}; 
        this.context = options.context;
        this.canvasFormat = options.canvasFormat;

        let textureOutput: GPUTexture;
        let pass: GPUCommandEncoder;

        const instructions = this.createInstructions(this.time, options.size.width, options.size.height);

        for(let i = 1; i <= instructions.passes.length; i++) {
            const shader = instructions.passes[i-1];

            // if this shader is NOT the first operation, then use previously made textureOutput as 
            // a render target
            if(i-1 > 0 && instructions.passes[i-2].passType != 'compute') {
                shader.entries[1].resource = textureOutput.createView({
                    label: textureOutput.label + '_view'
                });
            }

            if(i-1 > 0 && instructions.passes[i-2].passType == 'compute') {
                // if this pass follows a compute pass, then dont create another commandEncoder.
                // do nothing
            }
            else {
                pass = this.device.createCommandEncoder();
            }

            if(shader.passType === 'render') {

                // if this shader is not the last operation, then create a new GPUTexture as an output 
                if(i < instructions.passes.length) {
                    const renderTarget = this.device.createTexture({
                        label: 'texA placeholder',
                        format: options.canvasFormat,
                        size: [w, h],
                        usage: 
                            GPUTextureUsage.TEXTURE_BINDING |
                            GPUTextureUsage.RENDER_ATTACHMENT |
                            GPUTextureUsage.COPY_DST
                    });
                    textureOutput = renderTarget
                }

                else {
                    textureOutput = options.context.getCurrentTexture();
                }

                const bindGroup = this.device.createBindGroup({
                    layout: shader.pipeline.getBindGroupLayout(0),
                    entries: shader.entries,
                });
                const renderPass = pass.beginRenderPass({
                    colorAttachments: [<GPURenderPassColorAttachment>{
                        view: textureOutput.createView(),
                        clearValue: [0,0,0,1],
                        loadOp: 'clear',
                        storeOp: 'store',
                    }],
                });

                renderPass.setPipeline(<GPURenderPipeline>shader.pipeline);
                renderPass.setBindGroup(0, bindGroup);
                renderPass.draw(6);
                renderPass.end();
                
                this.device.queue.submit([pass.finish()]);
            }
            // compute stuff
            else if(shader.passType = 'compute') {
                const bindGroup = this.device.createBindGroup({
                    layout: shader.pipeline.getBindGroupLayout(0),
                    entries: shader.entries,
                });
                const computePass = pass.beginComputePass();
                computePass.setPipeline(<GPUComputePipeline>shader.pipeline);
                computePass.setBindGroup(0, bindGroup);

                computePass.dispatchWorkgroups(Math.ceil(w/shader.workgroupSize), Math.ceil(h/shader.workgroupSize), 1);
                computePass.end();

                // console.log(shader.entries.)
            }
        }
    }

    renderOnTimer(options: RenderDescriptor) {
        clearInterval(this.timeout);
        this.timeout = setInterval(() => {

            const now = Date.now();
            const delta = this.lastUpdate - now;
            this.lastUpdate = now;
            this.time -= delta/1000;

            requestAnimationFrame(this.render.bind(this, options));
        }, 1000 / 30);
    }
}