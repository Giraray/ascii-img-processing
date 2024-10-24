import sukuna from './sukunaiPadKid.jpg';
import {Ascii} from './texture';
import AsciiShader from './tShader.ts';
import CanvasProcessor from './canvasProcessor.ts'

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

let canvasTexture;
function initTexture(newTexture) {
    // newTexture is of type TextureObject (exists from before)
    let keepShader = false;
    if(canvasTexture instanceof Ascii) {
        detachTexture();

        if(canvasTexture.shader != undefined) {
            keepShader = canvasTexture.shader;
        }

        // both textures are of the same type
        if(newTexture.constructor.name == canvasTexture.constructor.name) {

            // if newTexture is the same as canvasTexture AND it does not have a source, do nothing
            if(!Object.hasOwn(newTexture, 'source')) {
                return;
            }
    
            // if newTexture has a source that is the same as canvasTexture.source, then do nothing
            if(newTexture.source == canvasTexture.source) {
                return;
            }
        }
    }

    // otherwise, update texture
    canvasTexture = newTexture;

    if(keepShader != false) {
        initShader(keepShader);
    }

    canvasTexture.resizeCanvas();
    canvasTexture.renderToCanvas();
}

function initShader(shader) {
    canvasTexture.setShader(shader);
    canvasTexture.renderToCanvas();
}

const source = await loadTexture(sukuna);
const tex = new Ascii(canvasFormat, device, context, source);
initTexture(tex);

const asciiShader = new AsciiShader(device, canvasFormat);
initShader(asciiShader);


// process
const processor = new CanvasProcessor({
    context: context,
    textArea: document.getElementById('textArea'),
    device: device,
});

processor.convertToText();