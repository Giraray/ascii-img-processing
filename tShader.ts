import asciiDogCode from './shaders/asciiDoG.wgsl?raw';
import asciiSobelCode from './shaders/asciiSobel.wgsl?raw';
import asciiDownscaleCode from './shaders/asciiDownscale.wgsl?raw';
import asciiConvertCode from './shaders/asciiConvert.wgsl?raw';
import {ShaderObject, ProgramInstructions, ShaderProgram} from './tShaderObject';

export default class AsciiShader extends ShaderObject {
    constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
        super(device, canvasFormat);
        this.code = asciiDogCode;
        this.static = true;
        this.shaderModule = device.createShaderModule({
            code: this.code,
        });
        this.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.shaderModule,
            },
            fragment: {
                module: this.shaderModule,
                targets: [{format: canvasFormat}],
            }
        });
    }

    createInstructions(time: number, width: number, height: number): ProgramInstructions {
        // buffer for compute
        const colorBuffer = this.device.createTexture({
            size: {width: width/8, height: height/8},
            format: 'rgba8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC |
             GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        });

        const storageBuffer = this.device.createBuffer({
            size: Math.floor(width/8) * Math.floor(height/8) * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            label: 'StorageBuffer',
        });

        const uUsage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
        const baseTexture = this.texture.createView();

        // resolution buffer
        const resBuffer = this.device.createBuffer({size:8, usage: uUsage});
        this.device.queue.writeBuffer(resBuffer, 0, new Float32Array([width, height]));

        // DoG
        const entries = [
            {binding: 0, resource: this.sampler},
            {binding: 1, resource: this.texture.createView()},
            {binding: 2, resource: { buffer: resBuffer }},
        ];

        // SOBEL
        const sobelShaderModule = this.device.createShaderModule({
            label: 'sobel filter',
            code: asciiSobelCode
        })

        const sobelPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: sobelShaderModule,
            },
            fragment: {
                module: sobelShaderModule,
                targets: [{format: this.canvasFormat}],
            }
        });

        // DOWNSCALE
        const downscaleShaderModule = this.device.createShaderModule({
            label: 'downscale',
            code: asciiDownscaleCode,
        });

        const downscalePipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: downscaleShaderModule,
                entryPoint: 'main',
            },
        });

        const threshBuffer = this.device.createBuffer({size: 4, usage: uUsage});
        this.device.queue.writeBuffer(threshBuffer, 0, new Float32Array([10]));

        const downscaleEntries = [
            {binding: 0, resource: colorBuffer.createView()},
            {binding: 1, resource: this.texture.createView()},
            {binding: 2, resource: { buffer: threshBuffer }},
            {binding: 4, resource: baseTexture},
            {binding: 5, resource: {buffer: storageBuffer}},
        ];

        // FINALIZE
        
        // calculate edges bool (enum)
        const calculateEdgeBoolBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(calculateEdgeBoolBuffer, 0, new Float32Array([1]));

        const finalizeModule = this.device.createShaderModule({
            label: 'ascii finalize',
            code: asciiConvertCode,
        })

        const finalizePipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: finalizeModule,
            },
            fragment: {
                module: finalizeModule,
                targets: [{format: this.canvasFormat}],
            },
        });
        const finalizeEntries = [
            {binding: 0, resource: this.sampler},
            {binding: 1, resource: colorBuffer.createView()},
            {binding: 4, resource: this.texture.createView()},
            {binding: 5, resource: {buffer: resBuffer}},
        ];

        const passes: ShaderProgram[] = [
            {
                // processes and renders the edges of the image
                label: 'DoG',
                passType: 'render',
                pipeline: this.pipeline,
                entries: entries,
            },
            {
                // computes and renders the edge normals
                label: 'sobel',
                passType: 'render',
                pipeline: sobelPipeline,
                entries: entries,
            },
            {
                // computes the average direction of the normals (8x8)
                label: 'downscale',
                passType: 'compute',
                pipeline: downscalePipeline,
                entries: downscaleEntries,
                workgroupSize: 8,
                storageBuffer: storageBuffer,
            },
            // {
            //     // converts edge calculations into ascii edges and converts image luminance into ascii
            //     label: 'ascii finalize',
            //     passType: 'render',
            //     pipeline: finalizePipeline,
            //     entries: finalizeEntries,
            // },
        ];

        const instructions: ProgramInstructions = {
            label: 'ASCII shader instructions',
            passes,
        }

        return instructions;
    }
}