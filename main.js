import sukuna from './sukunaiPadKid.jpg';
import {Ascii} from './texture';
import AsciiShader from './tShader.ts';
import Shader from './shader.ts';

import imgShaderCode from './shaders/defaultShader.wgsl?raw';
import asciiDogCode from './shaders/asciiDoG.wgsl?raw';
import asciiSobelCode from './shaders/asciiSobel.wgsl?raw';
import asciiDownscaleCode from './shaders/asciiDownscale.wgsl?raw';
import asciiConvertCode from './shaders/asciiConvert.wgsl?raw';

if(!navigator.gpu) {
    alert('WebGPU is currently only supported in Chromium based browsers.')
    throw new Error('WebGPU not supported on this browser');
}
const adapter = await navigator.gpu.requestAdapter();
if(!adapter) {
    alert(`No appropriate GPUAdapter found. There are either no GPUs available for the browser, or the browser settings has graphics acceleration turned off.`)
    throw new Error('No appropriate GPUAdapter found');
}

const device = await adapter.requestDevice();
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');

const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device: device,
    format: canvasFormat,
});

async function loadTexture(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const source = await createImageBitmap(blob, {colorSpaceConversion: 'none'});
    return source;
}

// source texture
const source = await loadTexture(sukuna);
const imgTexture = device.createTexture({
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
    {texture: imgTexture},
    {width: source.width, height: source.height},
);

const w = source.width;
const h = source.height

// canvas.width = w;
// canvas.height = h;
// canvas.style.width = w + 'px';
// canvas.style.height = h + 'px';

const sampler = device.createSampler();

function createPipeline(module) {
    const pipeline = device.createRenderPipeline({
        label: 'imageRenderPipeline',
        layout: 'auto',
        vertex: {module},
        fragment: {module, targets: [{format:canvasFormat}]}
    });

    return pipeline;
}


// imageShader
let module = device.createShaderModule({
    label: 'imageRenderModule',
    code: imgShaderCode,
})

let pipeline = device.createRenderPipeline({
    label: 'imageRenderPipeline',
    layout: 'auto',
    vertex: {module},
    fragment: {module, targets: [{format:canvasFormat}]}
});

let bindGroup = device.createBindGroup({
    label: 'imageBindGroup',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        {binding: 0, resource: sampler},
        {binding: 1, resource: imgTexture.createView()},
    ],
})

let renderTarget = device.createTexture({
    label: 'renderTarget',
    format: canvasFormat,
    size: [w, h],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
});

const imageShader = new Shader({
    module,
    pipeline,
    bindGroup,
    renderTarget,
});

render(imageShader);

// DoG
// resolution buffer
const uUsage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
const resBuffer = device.createBuffer({size:8, usage: uUsage});
device.queue.writeBuffer(resBuffer, 0, new Float32Array([w, h]));

module = device.createShaderModule({
    code: asciiDogCode,
});
pipeline = createPipeline(module);
bindGroup = device.createBindGroup({
    label: 'dogBindGroup',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        {binding: 0, resource: sampler},
        {binding: 1, resource: imageShader.renderTarget.createView()},
        {binding: 2, resource: { buffer: resBuffer }},
    ]
})

renderTarget = device.createTexture({
    label: 'renderTarget',
    format: canvasFormat,
    size: [w, h],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
});

const dogShader = new Shader({
    module,
    pipeline,
    bindGroup,
    renderTarget
})

render(dogShader);

// sobel
module = device.createShaderModule({
    code: asciiSobelCode,
});
pipeline = createPipeline(module);
bindGroup = device.createBindGroup({
    label: 'sobelBindGroup',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        {binding: 0, resource: sampler},
        {binding: 1, resource: dogShader.renderTarget.createView()},
        {binding: 2, resource: { buffer: resBuffer }},
    ]
})

renderTarget = device.createTexture({
    label: 'renderTarget',
    format: canvasFormat,
    size: [w, h],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
});

const sobelShader = new Shader({
    module,
    pipeline,
    bindGroup,
    renderTarget
})

render(sobelShader);

// downscale
const downscaleThreshold = 14;
const threshBuffer = device.createBuffer({size: 4, usage: uUsage});
device.queue.writeBuffer(threshBuffer, 0, new Float32Array([downscaleThreshold]));

const storageBuffer = device.createBuffer({size: Math.floor(w/8) * Math.floor(h/8) * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
});

module = device.createShaderModule({
    code: asciiDownscaleCode,
});

pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
        module,
        entryPoint: 'main',
    },
})

bindGroup = device.createBindGroup({
    label: 'downscaleBindGroup',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        {binding: 0, resource: {buffer: storageBuffer}},
        {binding: 1, resource: sobelShader.renderTarget.createView()},
        {binding: 2, resource: { buffer: threshBuffer }},
        {binding: 3, resource: imgTexture.createView()},
    ]
})

const downscaleShader = new Shader({
    module,
    pipeline,
    bindGroup,
    storageBuffer,
})
const size = Math.floor(w/8) * Math.floor(h/8);
const readBuffer = device.createBuffer({
    label: 'readBuffer',
    size: size * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ},
);


renderCompute(downscaleShader, readBuffer);

function render(shader) {
    let renderTarget = context.getCurrentTexture()
    if(shader.renderTarget != undefined) {
        renderTarget = shader.renderTarget;
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        label: 'img pass',
        colorAttachments: [{
            view: renderTarget.createView(),
            clearValue: [0,0,0,1],
            loadOp: 'clear',
            storeOp: 'store',
        }],
    })
    pass.setPipeline(shader.pipeline);
    pass.setBindGroup(0, shader.bindGroup);
    pass.draw(6);
    pass.end();

    device.queue.submit([encoder.finish()]);
}

function renderCompute(shader, readBuffer) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(shader.pipeline);
    pass.setBindGroup(0, shader.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(w/8), Math.ceil(h/8), 1);
    pass.end();

    encoder.copyBufferToBuffer(shader.storageBuffer, 0, readBuffer, 0, size * 4);
    device.queue.submit([encoder.finish()]);
}

await Promise.all([
    readBuffer.mapAsync(GPUMapMode.READ),
]);
const result = new Float32Array(readBuffer.getMappedRange());
console.log(result);


// start ascii processing
const area = document.getElementById('textArea');
for(let i = 0; i < result.length; i++) {
    const val = Math.floor(result[i]*1000)/1000;

    let add;

    if(i % Math.floor(w/8) == 0) {
        area.innerHTML += '\n';
    }

    else {
        switch(val) {
            case 0:
                add = ' ';
                break;
            case 0.111:
                add = '.';
                break;
            case 0.222:
                add = ':'
                break;
            default:
                add = ' ';
                break;
        }
    
        area.innerHTML += add;
    }
}