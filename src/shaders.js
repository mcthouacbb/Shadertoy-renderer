const fullscreenQuadShader = `#version 300 es

const vec2 vertexPositions[3] = vec2[](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
);

void main() {
    gl_Position = vec4(vertexPositions[gl_VertexID], 0.0, 1.0);
}`;

const shadertoyHeader = `#version 300 es

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

const shadertoyDefault = `void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));

    // Output to screen
    fragColor = vec4(col,1.0);
}`;

function compileShadertoy(shadertoy) {
    return shadertoyHeader + shadertoy;
}
