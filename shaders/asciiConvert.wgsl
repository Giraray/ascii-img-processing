@group(0) @binding(0) var uSampler : sampler;
@group(0) @binding(1) var colorBuffer : texture_2d<f32>;
@group(0) @binding(4) var uTexture : texture_2d<f32>;
@group(0) @binding(5) var<uniform> uResolution: vec2<f32>;

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) uv : vec2<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {

    var positions = array<vec2<f32>, 6>(
        vec2<f32>( 1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0,  1.0)
    );

    var texCoords = array<vec2<f32>, 6>(
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(0.0, 0.0)
    );

    var output : VertexOutput;
    output.Position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
    output.uv = texCoords[VertexIndex];
    return output;
}

const red = vec3(1.0,0.0,0.0);
const green = vec3(0.0,1.0,0.0);
const blue = vec3(0.0,0.5,1.0);
const yellow = vec3(1.0,1.0,0.0);

const QUANTIZATION = 9.0;

fn desaturate(color: vec3<f32>) -> vec4<f32> {
    var lum = vec3(0.299, 0.587, 0.114);
    var gray = vec3(dot(lum, color));
    return vec4(mix(color, gray, 1.0), 1.0);
}

fn compressUV(scale: f32, fragCoord: vec2<f32>) -> vec2<f32> {
    var modifiedCoord = fragCoord.xy;
    modifiedCoord -= modifiedCoord % scale;
    var px = modifiedCoord / uResolution;

    return px;
}

fn getQuantizedLuma(frag: vec4<f32>) -> f32 {
    var fragLuma = frag.r * 0.2126 + frag.g * 0.7152 + frag.b * 0.0722;
    return floor(fragLuma * QUANTIZATION)/QUANTIZATION;
}

fn getBitmapOffset(luma: f32) -> f32 {
    return luma * QUANTIZATION * 8.0;
}

fn getEdgeOffset(color: vec3<f32>) -> f32 {
    if(color.r == 1.0 && color.g == 0.0) {
        // red
        return 3.0 * 8.0;
    }
    else if(color.r == 0.0 && color.g == 1.0) {
        // green
        return 0.0 * 8.0;
    }
    else if(color.b == 1.0) {
        // blue
        return 2.0 * 8.0;
    }
    else {
        // yellow
        return 1.0 * 8.0;
    }
}

fn vec3Equals(a: vec3<f32>, b: vec3<f32>) -> bool {
    var boolVec = a == b;
    if(boolVec.x == false || boolVec.y == false || boolVec.z == false) {
        return false;
    }
    return true;
}

@fragment
fn frag_main(
    @location(0) uv : vec2<f32>,
    @builtin(position) pos: vec4<f32>
    ) -> @location(0) vec4<f32> {
    
    var resolution = uResolution; // wtf just make a bindgroup layout man...

    // here it starts
    var fragCoord = pos.xy;
    var pixel = compressUV(8.0, fragCoord);
    var pixelTex = textureSample(uTexture, uSampler, pixel);
    var luma = getQuantizedLuma(pixelTex);

    var edges = textureSample(colorBuffer, uSampler, uv);

    var color: vec4<f32>;
    if(vec3Equals(edges.rgb, vec3(0.0))) {
        return vec4(vec3(luma), 1.0);
    }
    return edges;
}