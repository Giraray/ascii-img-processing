@group(0) @binding(0) var colorBuffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uThreshold: f32;
@group(0) @binding(4) var uBaseTexture: texture_2d<f32>;

var<workgroup> tile : array<array<vec3<f32>, 8>, 8>;
var<workgroup> texTile : array<array<vec3<f32>, 8>, 8>;
const red = vec3(1.0,0.0,0.0);
const green = vec3(0.0,1.0,0.0);
const blue = vec3(0.0,0.0,1.0);

fn vec4Equals(a: vec4<f32>, b: vec4<f32>) -> bool {
    var boolVec = a == b;
    if(boolVec.x == false || boolVec.y == false || boolVec.z == false || boolVec.w == false) {
        return false;
    }
    return true;
}

fn vec3Equals(a: vec3<f32>, b: vec3<f32>) -> bool {
    var boolVec = a == b;
    if(boolVec.x == false || boolVec.y == false || boolVec.z == false) {
        return false;
    }
    return true;
}

fn vec3EqualsU32(a: vec3<u32>, b: vec3<u32>) -> bool {
    var boolVec = a == b;
    if(boolVec.x == false || boolVec.y == false || boolVec.z == false) {
        return false;
    }
    return true;
}

// 9 represents amount of characters in ascii bitmap -1 (10 in this case)
fn getQuantizedLuma(frag: vec4<f32>) -> f32 {
    var fragLuma = frag.r * 0.2126 + frag.g * 0.7152 + frag.b * 0.0722;
    return floor(fragLuma * 9.0)/9.0;
}

@compute @workgroup_size(8,8,1)
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) wg_id: vec3<u32>
    ) {

    var val = vec2(i32(local_id.x) + i32(wg_id.x)*8, i32(local_id.y) + i32(wg_id.y)*8);
    let screenPos: vec2<i32> = vec2(i32(global_id.x), i32(global_id.y));
    var texColor = textureLoad(uTexture, screenPos, 0);

    var baseTex = textureLoad(uBaseTexture, screenPos, 0);

    tile[local_id.x][local_id.y] = texColor.rgb;
    texTile[local_id.x][local_id.y] = baseTex.rgb;

    workgroupBarrier();

    // var 
    // lum_tile[local_id.x][local_id.y] = 

    // array that counts occurances of specific colors: red, green, blue, yellow and black
    var histogram = vec4(0.0);
    var yellow = vec3(1.0,1.0,0.0);

    var texVec = vec3(0.0);

    for(var i = 0; i < 8; i++) {
        for(var j = 0; j < 8; j++) {
            var targetColor: vec3<f32> = tile[i][j];
            
            if(vec3Equals(targetColor, yellow.rgb)) {
                histogram += vec4(0.0,0.0,0.0,1.0);
            }
            else {
                histogram += vec4(targetColor, 0.0);
            }

            texVec += texTile[i][j];
        }
    }

    var texel = vec4(texVec / 64.0, 1.0);
    texel = vec4(vec3(getQuantizedLuma(texel)),1.0);

    var color = vec4(0.0,0.0,0.0, 1.0);

    if(vec4Equals(histogram, vec4(0.0))) {
        textureStore(colorBuffer, wg_id.xy, texel);
        return;
    }

    var resultColor = vec3(0.0);
    var max = 0.0;
    if(histogram.r > max) {
        max = histogram.r;
        resultColor = red;
    }
    if(histogram.g > max) {
        max = histogram.g;
        resultColor = green;
    }
    if(histogram.b > max) {
        max = histogram.b;
        resultColor = blue;
    }
    if(histogram.a > max) {
        max = histogram.a;
        resultColor = yellow;
    }

    if(max >= uThreshold) {
        color = vec4(resultColor, 1.0);
    }

    textureStore(colorBuffer, wg_id.xy, color); 
}