import { ShaderObject } from "./tShaderObject";
import imgShader from './shaders/defaultShader.wgsl?raw';

interface Size {
    width: number;
    height: number;
}

export class Ascii {
    readonly canvasFormat: GPUTextureFormat;
    readonly device: GPUDevice
    readonly context: GPUCanvasContext;
    source: ImageBitmap;
    container: HTMLDivElement;
    size: Size;

    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;

    shader: ShaderObject;

    constructor(canvasFormat: GPUTextureFormat, device: GPUDevice, context: GPUCanvasContext, source: ImageBitmap) {
        this.canvasFormat = canvasFormat;
        this.device = device;
        this.context = context;
        this.source = source;

        this.size = {
            width: this.source.width,
            height: this.source.height,
        }
    }

    updateTexture() {
        const source = this.source;
        const device = this.device;

        // texture
        const texture = device.createTexture({
            label: 'imgTexture',
            format: 'rgba8unorm',
            size: [source.width, source.height],
            usage: 
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture(
            {source: source, flipY: false},
            {texture: texture},
            {width: source.width, height: source.height},
        );

        // shader module
        const shaderModule = device.createShaderModule({
            label: 'default shader module',
            code: imgShader,
        });

        // render pipeline
        const pipeline = device.createRenderPipeline({
            label: 'render pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
            },
            fragment: {
                module: shaderModule,
                targets: [{format:this.canvasFormat}],
            },
        })

        // sampler
       const sampler = device.createSampler();

        // bindgroup
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {binding: 0, resource: sampler},
                {binding: 1, resource: texture.createView()},
            ],
        });

        this.bindGroup = bindGroup;
        this.pipeline = pipeline;
    }

    public renderToCanvas() {
        this.updateTexture();

        // create renderTarget if a shader is to be applied; otherwise use context
        let textureOutput: GPUTexture;
        if(this.shader) {

            const renderTarget = this.device.createTexture({
                label: 'texA placeholder',
                format: this.canvasFormat,
                size: [this.size.width, this.size.height],
                usage: 
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_SRC
            });

            textureOutput = renderTarget
        }
        else {
            textureOutput = this.context.getCurrentTexture();
        }

        const textureEncoder = this.device.createCommandEncoder({
            label: 'texEncoder',
        });

        const pass = textureEncoder.beginRenderPass({
            label: 'defaultImg pass',
            colorAttachments: [<GPURenderPassColorAttachment>{
                view: textureOutput.createView(),
                clearValue: [0, 0, 0, 1],
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6);
        pass.end();

        this.device.queue.submit([textureEncoder.finish()]);

        // RENDER SHADER (if exists)
        if(this.shader) {
            const shader = this.shader;
            const renderOptions = {
                size: {
                    width: this.size.width,
                    height: this.size.height,
                },
                canvasFormat: this.canvasFormat,
                context: this.context,
                finalRender: true,
            }

            shader.texture = textureOutput;

            if(this.shader.static == true) {
                shader.render(renderOptions);
            }
            else{
                shader.renderOnTimer(renderOptions);
            }
        }
    }

    public resizeCanvas() {
        const canvas = <HTMLCanvasElement>this.context.canvas;
        canvas.width = this.size.width;
        canvas.height = this.size.height;

        canvas.style.width = this.size.width + 'px';
        canvas.style.height = this.size.height + 'px';
    }

    /**
     * Sets or removes a texture's active shader.
     * @param shader Removes and deactivates current shaders if null
     */
    public setShader(shader: ShaderObject | null) {
        const shaderConfigs = document.getElementById('shaderOptions');

        // if texture already has a shader: deactive it
        if(this.shader != undefined) {
            clearInterval(this.shader.timeout);
        }

        // if current shader is reselected: negate it. Also clear out shader config HTML
        if(this.shader != undefined && shader != null && shader.constructor.name === this.shader.constructor.name) {
            shader = null;
            shaderConfigs.innerHTML = '';
        }

        this.shader = shader;
    }
}