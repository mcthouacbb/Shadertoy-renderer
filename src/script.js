function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbChannel0);

    gl.useProgram(raymarchProgram);
    gl.uniform3f(
        gl.getUniformLocation(raymarchProgram, "iResolution"),
        width,
        height,
        1
    );
    gl.uniform1f(gl.getUniformLocation(raymarchProgram, "iTime"), time);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(ditherProgram);
    gl.uniform3f(
        gl.getUniformLocation(ditherProgram, "iResolution"),
        width,
        height,
        1
    );
    gl.uniform1f(gl.getUniformLocation(ditherProgram, "iTime"), time);

    gl.uniform1i(gl.getUniformLocation(ditherProgram, "iChannel0"), 0);
    gl.uniform1i(gl.getUniformLocation(ditherProgram, "iChannel1"), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texChannel0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

let runAnimate = false;
function startAnimation() {
    prevTime = performance.now();
    runAnimate = true;
    window.requestAnimationFrame(animate);
}

let prevTime = performance.now();
function animate() {
    render();
    let currTime = performance.now();
    let dt = (currTime - prevTime) / 1000;
    prevTime = currTime;
    setCurrTime(time + dt);

    if (play && runAnimate) {
        window.requestAnimationFrame(animate);
    }
}

let keys = new Map();
document.addEventListener("keydown", (e) => {
    keys.set(e.key, true);
});
document.addEventListener("keyup", (e) => {
    keys.set(e.key, false);
});

function startControls() {
    prevTime = performance.now();
    cameraPosX = 0;
    cameraPosY = 7;
    cameraPosZ = 0;
    cameraRotationX = 0;
    cameraRotationY = 0;
    window.requestAnimationFrame(runControls);
}

let cameraRotationX = 0;
let cameraRotationY = 0;

function rotateCamera(e) {
    cameraRotationX -= e.movementY / 100.0;
    cameraRotationX = Math.min(
        Math.max(cameraRotationX, -Math.PI / 2),
        Math.PI / 2
    );
    cameraRotationY -= e.movementX / 100.0;
}

let cameraPosX = 0;
let cameraPosY = 10;
let cameraPosZ = 0;
function runControls() {
    render();
    let currTime = performance.now();
    let dt = (currTime - prevTime) / 1000;
    prevTime = currTime;

    if (play) {
        setCurrTime(time + dt);
    }

    const SPEED = 6;

    if (keys.get("w")) {
        cameraPosZ += SPEED * Math.cos(cameraRotationY) * dt;
        cameraPosX -= SPEED * Math.sin(cameraRotationY) * dt;
    }

    if (keys.get("s")) {
        cameraPosZ -= SPEED * Math.cos(cameraRotationY) * dt;
        cameraPosX += SPEED * Math.sin(cameraRotationY) * dt;
    }

    if (keys.get("a")) {
        cameraPosZ -= SPEED * Math.sin(cameraRotationY) * dt;
        cameraPosX -= SPEED * Math.cos(cameraRotationY) * dt;
    }

    if (keys.get("d")) {
        cameraPosZ += SPEED * Math.sin(cameraRotationY) * dt;
        cameraPosX += SPEED * Math.cos(cameraRotationY) * dt;
    }

    if (keys.get("e") || keys.get(" ")) {
        cameraPosY += SPEED * dt;
    }

    if (keys.get("q") || keys.get("Shift")) {
        cameraPosY -= SPEED * dt;
    }

    gl.useProgram(raymarchProgram);
    gl.uniform3f(
        gl.getUniformLocation(raymarchProgram, "uCameraPos"),
        cameraPosX,
        cameraPosY,
        cameraPosZ
    );
    gl.uniform2f(
        gl.getUniformLocation(raymarchProgram, "uCameraRotation"),
        cameraRotationX,
        cameraRotationY
    );

    if (manualControls) {
        window.requestAnimationFrame(runControls);
    }
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

function createDitherProgram(mode) {
    let ditherVS = createShader(gl.VERTEX_SHADER, fullscreenQuadShader);
    let ditherFS = createShader(
        gl.FRAGMENT_SHADER,
        ditherHeader + ditherModeDefs(mode) + ditherShader
    );
    return createProgram(ditherVS, ditherFS);
}

function createRaymarchProgram(manualControls) {
    let raymarchVS = createShader(gl.VERTEX_SHADER, fullscreenQuadShader);
    let raymarchFS = createShader(
        gl.FRAGMENT_SHADER,
        raymarchHeader +
            (manualControls ? "\n#define MANUAL_CONTROLS\n" : "") +
            raymarchShader
    );
    return createProgram(raymarchVS, raymarchFS);
}

let modeInput = document.getElementById("dither-mode");
modeInput.addEventListener("input", () => {
    switch (modeInput.value) {
        case "dynamic":
            ditherProgram = createDitherProgram(DitherMode.DYNAMIC);
            break;
        case "white-noise":
            ditherProgram = createDitherProgram(DitherMode.WHITE_NOISE);
            break;
        case "blue-noise":
            ditherProgram = createDitherProgram(DitherMode.BLUE_NOISE);
            break;
        case "bayer2":
            ditherProgram = createDitherProgram(DitherMode.BAYER2);
            break;
        case "bayer3":
            ditherProgram = createDitherProgram(DitherMode.BAYER3);
            break;
        case "none":
            ditherProgram = createDitherProgram(DitherMode.NO_DITHER);
            break;
    }
    render();
});

let widthInput = document.getElementById("render-width");
let heightInput = document.getElementById("render-height");

widthInput.addEventListener("blur", () => {
    trySetWidthFromInput();
});

widthInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        trySetWidthFromInput();
    }
});

heightInput.addEventListener("blur", () => {
    trySetHeightFromInput();
});

heightInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        trySetHeightFromInput();
    }
});

function trySetWidthFromInput() {
    let validChars = new RegExp(`[0-9]`);
    let valid = validChars.test(widthInput.value);
    let result = parseInt(widthInput.value);
    if (Number.isNaN(result) || !valid) {
        widthInput.value = width.toFixed(0);
    } else {
        resize(result, height);
        render();
    }
}

function trySetHeightFromInput() {
    let validChars = new RegExp(`[0-9]`);
    let valid = validChars.test(heightInput.value);
    let result = parseInt(heightInput.value);
    if (Number.isNaN(result) || !valid) {
        heightInput.value = width.toFixed(0);
    } else {
        resize(width, result);
        render();
    }
}

function createChannel0() {}

function resize(w, h) {
    width = w;
    height = h;

    widthInput.value = width.toFixed(0);
    heightInput.value = height.toFixed(0);

    canvas.width = width;
    canvas.height = height;

    canvas.style.transformOrigin = "top left";
    canvas.style.transform = `scale(${1.0 / window.devicePixelRatio})`;

    gl.viewport(0, 0, width, height);

    gl.deleteTexture(texChannel0);
    texChannel0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texChannel0);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        width,
        height,
        0,
        gl.RGBA,
        gl.FLOAT,
        null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.deleteFramebuffer(fbChannel0);
    fbChannel0 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbChannel0);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texChannel0,
        0
    );
}

let time = 0;
let timeInput = document.getElementById("render-time");
function setCurrTime(t) {
    time = t;
    timeInput.value = time.toFixed("2");
}

function trySetTimeFromInput() {
    let validChars = new RegExp(`[0-9.]`);
    let valid = validChars.test(timeInput.value);
    let result = parseFloat(timeInput.value);
    if (Number.isNaN(result) || !valid) {
        setCurrTime(time);
    } else {
        setCurrTime(result);
        render();
    }
}

timeInput.addEventListener("blur", () => {
    trySetTimeFromInput();
});

timeInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        trySetTimeFromInput();
    }
});

let play = true;
let togglePlayButton = document.getElementById("toggle-play");
togglePlayButton.addEventListener("click", () => {
    if (play) {
        togglePlayButton.innerText = "Play";
        play = false;
    } else {
        togglePlayButton.innerText = "Pause";
        play = true;
        startAnimation();
    }
});

let manualControls = false;
let toggleControlsButton = document.getElementById("toggle-controls");
toggleControlsButton.addEventListener("click", () => {
    if (manualControls) {
        manualControls = false;
        toggleControlsButton.innerText = "Enable Manual Camera Controls";
        raymarchProgram = createRaymarchProgram(false);

        if (play) {
            startAnimation();
        }
    } else {
        manualControls = true;
        toggleControlsButton.innerText = "Enable Automatic Camera Controls";
        runAnimate = false;
        raymarchProgram = createRaymarchProgram(true);
        startControls();
    }
});

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = (err) => reject(err);

        image.src = url;
    });
}

// this site was very helpful: https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html
const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl2");
const extF32Framebuffer = gl.getExtension("EXT_color_buffer_float");
if (!extF32Framebuffer) {
    alert(
        "Error: Your browser/computer does not support rendering to floating point frame buffers"
    );
}

canvas.addEventListener("click", () => {
    canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement == canvas) {
        document.addEventListener("mousemove", rotateCamera);
    } else {
        document.removeEventListener("mousemove", rotateCamera);
    }
});

document.getElementById("fullscreen").addEventListener("click", async () => {
    await canvas.requestFullscreen();
});

// hardcoded for now
let width = 0;
let height = 0;

let raymarchProgram = createRaymarchProgram(false);
let ditherProgram = createDitherProgram(DitherMode.DYNAMIC);

let texChannel0;
let fbChannel0;
let blueNoiseTexture = gl.createTexture();

async function init() {
    let image = await loadImage("images/blue_noise.png");

    resize(768, 432);

    gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        image.width,
        image.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    startAnimation();
}

init();
