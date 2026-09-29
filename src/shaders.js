const fullscreenQuadShader = `#version 300 es

const vec2 vertexPositions[3] = vec2[](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
);

void main() {
    gl_Position = vec4(vertexPositions[gl_VertexID], 0.0, 1.0);
}`;

const raymarchHeader = `#version 300 es

precision highp float;

uniform vec3 iResolution;
uniform float iTime;

out vec4 shaderOutput;

void mainImage(out vec4 fragColor, in vec2 fragCoord);

void main() {
    vec4 temp = vec4(0.0, 0.0, 0.0, 0.0);
    mainImage(temp, gl_FragCoord.xy);
    shaderOutput = temp;
}\n`;

const ditherHeader = `#version 300 es

precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;

out vec4 shaderOutput;

void mainImage(out vec4 fragColor, in vec2 fragCoord);

void main() {
    vec4 temp = vec4(0.0, 0.0, 0.0, 0.0);
    mainImage(temp, gl_FragCoord.xy);
    shaderOutput = temp;
}\n`;

const raymarchShader = `#define HUGE_NUM 1e30
#define MAX_STEPS 384
#define MAX_DIST 256.0
#define SURFACE_EPS 0.001
#define PI 3.14159265358979323

#ifdef MANUAL_CONTROLS

uniform vec3 uCameraPos;
uniform vec2 uCameraRotation;

mat3 rotateX(float rotationAngle) {
    float sinAng = sin(rotationAngle);
    float cosAng = cos(rotationAngle);
    return mat3(
        1,      0,       0,
        0, cosAng, -sinAng,
        0, sinAng,  cosAng
    );
}
mat3 rotateY(float rotationAngle) {
    float sinAng = sin(rotationAngle);
    float cosAng = cos(rotationAngle);
    return mat3(
         cosAng, 0, sinAng,
              0, 1,      0,
        -sinAng, 0, cosAng
    );
}

#endif

const vec3 REP_PERIOD = vec3(5.0, 25.0, 5.0);

mat3 lookAt(vec3 from, vec3 to, vec3 up) {
    vec3 forward = normalize(to - from);
    vec3 right = normalize(cross(up, forward));
    vec3 up2 = normalize(cross(forward, right));
    
    return mat3(right, up2, forward);
}

// repeat every period units, centered at (0, 0)
vec3 infiniteRepetition(vec3 p, vec3 period, out vec3 id) {
    id = round(p / period);
    return p - id * period;
}

// box with size halfExtent * 2 centered at (0, 0, 0)
float boxSDF(vec3 p, vec3 halfExtent) {
    vec3 diff = abs(p) - halfExtent;
    
    float outer = length(max(diff, vec3(0.0)));
    float inner = max(diff.z, max(diff.x, diff.y));
    
    return min(inner, 0.0) + outer;
}

vec4 sdfUnion(vec4 a, vec4 b) {
    return a.w < b.w ? a : b;
}

// https://iquilezles.org/articles/distfunctions/
float sdPyramid( vec3 p, float h )
{
  float m2 = h*h + 0.25;
    
  p.xz = abs(p.xz);
  p.xz = (p.z>p.x) ? p.zx : p.xz;
  p.xz -= 0.5;

  vec3 q = vec3( p.z, h*p.y - 0.5*p.x, h*p.x + 0.5*p.y);
  float s = max(-q.x,0.0);
  float t = clamp( (q.y-0.5*p.z)/(m2+0.25), 0.0, 1.0 );
  float a = m2*(q.x+s)*(q.x+s) + q.y*q.y;
  float b = m2*(q.x+0.5*t)*(q.x+0.5*t) + (q.y-m2*t)*(q.y-m2*t);
    
  float d2 = min(q.y,-q.x*m2-q.y*0.5) > 0.0 ? 0.0 : min(a,b);
  return sqrt( (d2+q.z*q.z)/m2 ) * sign(max(q.z,-p.y));
}


// https://iquilezles.org/articles/palettes/
vec3 colorPalette(vec3 inputVal) {
    const vec3 a = vec3(0.5, 0.5, 0.5);
    const vec3 b = vec3(0.5, 0.5, 0.5);
    const vec3 c = vec3(2.0, 1.0, 0.0);
    const vec3 d = vec3(0.50, 0.20, 0.25);
    
    float t = 0.5 * inputVal.x + 0.6 * inputVal.y + 0.3 * inputVal.z + 0.5;
    
    return a + b * cos(2.0 * PI * (c * t + d));
}

float checkers(vec2 pos) {
    vec2 centerPt = round(pos + vec2(0.5, 0.5)) - vec2(0.5, 0.5);
    return pow(abs(pos.x - centerPt.x), 3.0) + pow(abs(pos.y - centerPt.y), 3.0);
}

// combined color + sdf function
vec4 sceneDistCol(vec3 p) {
    vec3 id;
    vec3 rep = infiniteRepetition(p, REP_PERIOD, id);
    float sphere = length(rep) - 1.0;
    float box = boxSDF(rep - vec3(0.0, -0.5, 0.0), vec3(0.6, 1.5, 0.6)) - 0.2;
    
    float bound = boxSDF(p - vec3(0.0, 5.0, 0.0), vec3(32.5, 7.5, 32.5));
    float bound2 = boxSDF(p - vec3(0.0, 5.0, 0.0), vec3(2.5, 7.5, 7.5));
    float bound3 = boxSDF(p - vec3(0.0, 5.0, 0.0), vec3(7.5, 7.5, 2.5));
    
    vec4 thingsSDF = vec4(
        colorPalette(rep / 7.0 + sin(id) - cos(id)),
        max(max(max(max(-sphere, box), bound), -bound2), -bound3)
    );
    
    
    float t = mix(0.02, 0.05, (sin(p.x + iTime) + sin(p.z - iTime * 1.5)) / 3.0);
    vec4 groundPlane = vec4(
        checkers(p.xz) < t ?
            vec3(0.168627, 0.890196, 0.192157) :
            vec3(0.196078, 0.758824, 0.495294),
        boxSDF(p - vec3(0.0, -3.0, 0.0), vec3(50.0, 1.0, 50.0))
    );
    
    vec3 pyramidPos = 0.15 * (p - vec3(0.0, -3.0, 0.0));
    vec4 groundCone = vec4(
        mix(
            vec3(0.831373, 0.623529, 0.0509804),
            vec3(0.929412, 0.819608, 0.419608),
            round(pyramidPos.y * 5.0) / 4.0
        ),
        sdPyramid(0.13 * (p - vec3(0.0, -3.0, 0.0)), 0.8) / 0.13
    );
    
    return sdfUnion(sdfUnion(groundPlane, thingsSDF), groundCone);
}

uint murmurHash(uint x) {
    x ^= x >> 16;
    x *= 0x85ebca6bu;
    x ^= x >> 13;
    x *= 0xc2b2ae35u;
    x ^= x >> 16;
    
    return x;
}

float uniformUintToFloat(uint x) {
    return uintBitsToFloat((x >> 9) | 0x3F800000u) - 1.0;
}

float hash(vec2 pos) {
    return uniformUintToFloat(
        murmurHash(floatBitsToUint(pos.x))
        ^ murmurHash(murmurHash(floatBitsToUint(pos.y)))
    );
}

float valueNoise(vec2 p)
{
    vec2 i = floor( p );
    vec2 f = fract( p );

    vec2 u = f * f * (3.0- 2.0 * f);
    
    float noise0 = mix(hash(i + vec2(0, 0)), hash(i + vec2(1, 0)), u.x);
    float noise1 = mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x);
    
    return mix(noise0, noise1, u.y);
}

float fbmNoise(vec2 p) {
    return (valueNoise(0.5 * p)
        + 0.4 * valueNoise(1.0 * p)
        + 0.16 * valueNoise(2.0 * p)
        + 0.064 * valueNoise(4.0 * p)) / 1.624;
}

vec4 raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    
    for (int i = 0; i < MAX_STEPS && t < MAX_DIST; i++) {
        vec4 distCol = sceneDistCol(ro + t * rd);
        if (distCol.w <= SURFACE_EPS) {
            return vec4(distCol.xyz, t);
        }

        t += distCol.w;
    }

    const vec3 color0 = vec3(0.951961, 0.553529, 0.511569) * 0.9;
    const vec3 color1 = vec3(0.290196, 0.878431, 0.713725) * 0.9;
    const vec3 cloudColor = vec3(0.87451, 0.941176, 0.937255);
    
    const float cloudHeight = 50.0;
    
    vec3 skyColor = mix(color0, color1, max(rd.y * 0.7 + 0.3, 0.0));
    
    // domain specific hack: only works if the ray origin is below cloudHeight
    if (rd.y > 0.0) {
        // offset to "adjust the seed"
        vec2 cloudUV = (ro + (cloudHeight - ro.y) * rd / rd.y).xz + vec2(-120.0, -100.0);
        float cloudStrength = 10.0 * (clamp(fbmNoise(0.05 * cloudUV), 0.55, 0.65) - 0.55)
            * exp(-0.003 * length(cloudUV - ro.xz));
        skyColor = mix(skyColor, cloudColor, cloudStrength * 0.8);
    }
    
    return vec4(skyColor, HUGE_NUM);
}

float softShadow(vec3 ro, vec3 rd, float k) {
    float res = 1.0;
    float t = 0.0;
    
    for (int i = 0; i < MAX_STEPS && t < MAX_DIST; i++) {
        float dist = sceneDistCol(ro + t * rd).w;
        if (dist < SURFACE_EPS) {
            return 0.0;
        }
        res = min(res, k * dist / t);
        t += dist;
    }
    return res;
}

// taken from https://iquilezles.org/articles/normalsSDF/
vec3 calcNormal(vec3 p)
{
    const float eps = SURFACE_EPS;
    const vec2 k = vec2(1, -1);
    return normalize(
        k.xyy * sceneDistCol(p + k.xyy * eps).w + 
        k.yyx * sceneDistCol(p + k.yyx * eps).w + 
        k.yxy * sceneDistCol(p + k.yxy * eps).w + 
        k.xxx * sceneDistCol(p + k.xxx * eps).w
    );
}

vec4 render(vec3 ro, vec3 rd) {
    const vec3 TO_LIGHT_DIR = normalize(vec3(0.25, 0.2, 0.15));

    vec4 result = raymarch(ro, rd);
    if (result.w < HUGE_NUM) {
        vec3 hitPt = ro + result.w * rd;
        vec3 normal = calcNormal(hitPt);
        vec3 newOrigin = hitPt + normal * 2.0 * SURFACE_EPS;
        
        float diffuse = 1.15 * max(dot(normal, TO_LIGHT_DIR) * 0.4 + 0.6, 0.4);
        float shadowFactor = softShadow(newOrigin, TO_LIGHT_DIR, 8.0);
        
        float light = min(diffuse, shadowFactor);
        
        result.xyz *= max(light, 0.4);
    }
    return result;
}

vec3 cameraCurve(float t) {
    vec3 base = 5.0 * vec3(cos(t / 5.0), 0.7, sin(t / 5.0));
    vec3 jitter = 0.3 * vec3(sin(t), cos(t), sin(t + 5.0));
    return base + jitter;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = ((fragCoord - iResolution.xy / 2.0) / (iResolution.yy / 2.0));

#ifdef MANUAL_CONTROLS
    vec3 ro = uCameraPos;
    mat3 rotation = rotateY(uCameraRotation.y) * rotateX(uCameraRotation.x);
    vec3 rd = normalize(rotation * vec3(uv, 1.0));
#else
    vec3 ro = cameraCurve(iTime);
    mat3 rotation = lookAt(ro, vec3(0.5, 0.8, 0.5) * cameraCurve(iTime + 1.0), vec3(0.0, 1.0, 0.0));

    //vec3 ro = 2.5 * vec3(cos(iTime / 2.0), 0.2, sin(iTime / 2.0));
    //mat3 rotation = lookAt(ro, vec3(0.0), vec3(0.0, 1.0, 0.0));
    vec3 rd = normalize(rotation * vec3(uv, 1.0));
#endif

    vec4 result = render(ro, rd);
    vec3 color = result.xyz;
    float t = result.w;
    if (t < HUGE_NUM) {
        fragColor = vec4(color, t);
    } else {
        fragColor = vec4(color, -1.0);
    }
}`;

const DitherMode = Object.freeze({
    NO_DITHER: 0,
    WHITE_NOISE: 1,
    BLUE_NOISE: 2,
    BAYER2: 3,
    BAYER3: 4,
    DYNAMIC: 5,
});

function ditherModeDefs(mode) {
    let dither = 1;
    let whiteNoise = 0;
    let blueNoise = 0;
    let bayer2 = 0;
    let bayer3 = 0;
    let dynamic = 0;
    switch (mode) {
        case DitherMode.NO_DITHER:
            dither = 0;
            break;
        case DitherMode.WHITE_NOISE:
            whiteNoise = 1;
            break;
        case DitherMode.BLUE_NOISE:
            blueNoise = 1;
            break;
        case DitherMode.BAYER2:
            bayer2 = 1;
            break;
        case DitherMode.BAYER3:
            bayer3 = 1;
            break;
        case DitherMode.DYNAMIC:
            dynamic = 1;
            break;
        default:
            throw new Error("Invalid mode passed to ditherModeDefs()");
    }

    return `#define DITHER ${dither}
#define WHITE_NOISE ${whiteNoise}
#define BLUE_NOISE ${blueNoise}
#define BAYER2 ${bayer2}
#define BAYER3 ${bayer3}
#define DYNAMIC_DITHER ${dynamic}\n\n`;
}

const ditherShader = `uint murmurHash(uint x) {
    x ^= x >> 16;
    x *= 0x85ebca6bu;
    x ^= x >> 13;
    x *= 0xc2b2ae35u;
    x ^= x >> 16;
    
    return x;
}

float uniformUintToFloat(uint x) {
    return uintBitsToFloat((x >> 9) | 0x3F800000u) - 1.0;
}

vec3 hash(vec2 pos) {
    uint baseHash = murmurHash(floatBitsToUint(pos.x))
        ^ murmurHash(murmurHash(floatBitsToUint(pos.y)));
    uint hash1 = murmurHash(baseHash);
    uint hash2 = murmurHash(hash1);
    uint hash3 = murmurHash(hash2);
    
    return vec3(
        uniformUintToFloat(hash1),
        uniformUintToFloat(hash2),
        uniformUintToFloat(hash3)
    );
}

float bayer2(vec2 pos) {
    const mat4 bayer2_mat = transpose(mat4(
        vec4( 0,  8,  2, 10),
        vec4(12,  4, 14,  6),
        vec4( 3, 11,  1,  9),
        vec4(15,  7, 13,  5)
    )) / 16.0;
    
    return bayer2_mat[uint(pos.x) % 4u][uint(pos.y) % 4u];
}

float bayer3(vec2 pos) {
    float base = bayer2(pos);
    uint incx = (uint(pos.x) & 0x4u) >> 2;
    uint incy = (uint(pos.y) & 0x4u) >> 2;
    
    return base + float((2u * incx - incy) % 4u) / 64.0;
}

float brightness(vec3 color) {
    // doesn't work correctly with color spaces/perception
    return (color.r + color.g + color.b) / 3.0;
}

vec3 whiteNoise(vec2 fragCoord) {
    return pow(hash(fragCoord), vec3(1.0 / 2.2));
}

vec3 blueNoise(vec2 fragCoord) {
    return pow(texture(iChannel1, fragCoord / vec2(1024.0, 1024.0)).xyz, vec3(1.0 / 2.2));
}

vec3 bayer2Noise(vec2 fragCoord) {
    float r = bayer2(fragCoord);
    float g = bayer2(fragCoord + vec2(1.0, 3.0));
    float b = bayer2(fragCoord + vec2(3.0, 1.0));
    return pow(vec3(r, g, b), vec3(1.0 / 2.2));
}

vec3 bayer3Noise(vec2 fragCoord) {
    float r = bayer3(fragCoord);
    float g = bayer3(fragCoord + vec2(7.0, 3.0));
    float b = bayer3(fragCoord + vec2(1.0, 5.0));
    return pow(vec3(r, g, b), vec3(1.0 / 2.2));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec4 channel0 = texture(iChannel0, fragCoord / iResolution.xy);
    vec3 realColor = channel0.rgb;
    float dist = channel0.w;
    
    vec3 threshold;
#if WHITE_NOISE
    threshold = whiteNoise(fragCoord);
#endif
#if BLUE_NOISE
    threshold = blueNoise(fragCoord);
#endif
#if BAYER2
    threshold = bayer2Noise(fragCoord);
#endif
#if BAYER3
    threshold = bayer3Noise(fragCoord);
#endif
#if DYNAMIC_DITHER
    if (dist < 0.0) {
        // didn't hit anything
        threshold = blueNoise(fragCoord);
    } else {
        threshold = bayer3Noise(fragCoord);
    }
#endif

#if DITHER
    fragColor = vec4(step(threshold, realColor), 1.0);
#else
    fragColor = vec4(realColor, 1.0);
#endif
    
    //fragColor = vec4(vec3(step(brightness(hash), brightness(realColor))), 1.0);
    //fragColor = vec4(vec3(brightness(realColor)), 1.0);
    
    //fragColor = vec4(texture(iChannel1, fragCoord / vec2(1024.0, 1024.0)).xyz, 1.0);
}`;
