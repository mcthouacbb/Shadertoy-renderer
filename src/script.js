function render() {
    gl.useProgram(program);
    gl.uniform3f(iResolutionLoc, width, height, 1);
    gl.uniform1f(iTimeLoc, time);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function startAnimation() {
    // TODO: variable to pause and play
    prevTime = performance.now();
    window.requestAnimationFrame(animate);
}

let prevTime = performance.now();
function animate() {
    render();
    let currTime = performance.now();
    let dt = (prevTime - currTime) / 1000;
    prevTime = currTime;
    time += dt;

    // TODO: variable to pause and play
    window.requestAnimationFrame(animate);
}

function createShader(type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    let success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

// this site was very helpful: https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html
const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");

// hardcoded for now
const width = 300;
const height = 300;

let time = 0;

canvas.width = width;
canvas.height = height;

let vs = createShader(gl.VERTEX_SHADER, fullscreenQuadShader);
let fs = createShader(gl.FRAGMENT_SHADER, compileShadertoy(shadertoyDefault));
let program = createProgram(vs, fs);

let iResolutionLoc = gl.getUniformLocation(program, "iResolution");
let iTimeLoc = gl.getUniformLocation(program, "iTime");

startAnimation();
