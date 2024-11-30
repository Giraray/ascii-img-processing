interface ShaderDescriptor {
    module: GPUShaderModule;
    pipeline: GPUComputePipeline;
    bindGroup: GPUBindGroup;
    renderTarget?: GPUTexture;
    storageBuffer?: GPUBuffer;
}

export default class Shader {
    module: GPUShaderModule;
    pipeline: GPUComputePipeline;
    bindGroup: GPUBindGroup;

    renderTarget?: GPUTexture;
    storageBuffer?: GPUBuffer;

    constructor(config: ShaderDescriptor) {
        this.module = config.module;
        this.pipeline = config.pipeline;
        this.bindGroup = config.bindGroup;

        this.renderTarget = config.renderTarget;
        this.storageBuffer = config.storageBuffer;
    }
}

// export class RenderShader extends Shader {
//     source: ImageBitmap;

//     constructor(config: ShaderDescriptor, source: ImageBitmap) {
//         super(config);
//     }
// }