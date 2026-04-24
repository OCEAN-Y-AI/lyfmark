const MODULE_SELECTOR = '[data-background-wave]';
const CANVAS_SELECTOR = '[data-wave-canvas]';
const IMAGE_SELECTOR = '.background-wave-module__asset';

const ALGORITHM_VALUES = ['rain', 'wave'];

const QUALITY_PRESET = {
	fpsDesktop: 30,
	fpsCoarse: 24,
	renderScaleDesktop: 1.35,
	renderScaleCoarse: 1.05,
	dprCapDesktop: 2,
	dprCapCoarse: 1.5,
	textureScaleDesktop: 1.9,
	textureScaleCoarse: 1.3,
	textureDprCapDesktop: 3,
	textureDprCapCoarse: 2,
	textureMaxPixelsDesktop: 25165824,
	textureMaxPixelsCoarse: 9437184,
	aaRadiusBase: 0.64,
	aaMixBase: 0.62,
};

const SHADER_TUNING = {
	wave: {
		direction: { x: 0.802, y: 0.8 },
		spatialFrequency: { min: 5.4, max: 1.0 },
		temporalFrequency: { min: 0.09, max: 0.62 },
		phaseBlend: {
			secondarySpatialMultiplier: 0.42,
			secondaryPhaseInfluence: 0.28,
			primaryMix: 0.43,
			secondaryMix: 0.85,
			timeMix: 1.3,
		},
		displacementMix: {
			alongPrimary: 0.84,
			alongSecondary: 0.16,
			crossSecondary: 0.2,
			crossSwirl: 0.08,
		},
		amplitudeByMinSide: { min: 0.0011, max: 0.0115 },
	},
	rain: {
		dropCount: 10,
		eventRate: { min: 0.22, max: 2.4 },
		radiusLimit: { min: 0.1, max: 0.44 },
		bandWidth: { min: 0.009, max: 0.03 },
		oscillationFrequency: { min: 56.0, max: 20.0 },
		amplitudeByMinSide: { min: 0.0022, max: 0.019 },
		life: { radiusMin: 0.001, fadeMultiplier: 0.62 },
		rippleProfile: { base: 0.58, oscillationWeight: 0.42 },
		hashSeed: {
			timeOffset: 1.6180339,
			ax: 0.73,
			ay: 11.31,
			az: 3.17,
			bx: 1.27,
			by: 17.53,
			bz: 7.91,
		},
	},
};

const toShaderFloat = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return '0.0';
	}
	if (Number.isInteger(parsed)) {
		return `${parsed}.0`;
	}
	return String(parsed);
};

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
	v_uv = a_position * 0.5 + 0.5;
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_boxSize;
uniform int u_algorithm;
uniform float u_frequencyLevel;
uniform float u_intensityLevel;
uniform float u_scaleLevel;
uniform float u_zoom;
uniform float u_time;
uniform float u_sampleRadius;
uniform float u_aaMix;

in vec2 v_uv;
out vec4 outColor;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec4 sampleSource(vec2 uv) {
	float inside =
		step(0.0, uv.x) *
		step(0.0, uv.y) *
		step(uv.x, 1.0) *
		step(uv.y, 1.0);
	if (inside < 0.5) {
		return vec4(0.0);
	}
	return texture(u_texture, uv);
}

vec2 waveDisplacement(vec2 uv) {
	vec2 direction = normalize(vec2(${toShaderFloat(SHADER_TUNING.wave.direction.x)}, ${toShaderFloat(SHADER_TUNING.wave.direction.y)}));
	vec2 cross = vec2(-direction.y, direction.x);
	float baseSpatialFrequency = mix(${toShaderFloat(SHADER_TUNING.wave.spatialFrequency.min)}, ${toShaderFloat(SHADER_TUNING.wave.spatialFrequency.max)}, u_scaleLevel);
	float temporalFrequency = mix(${toShaderFloat(SHADER_TUNING.wave.temporalFrequency.min)}, ${toShaderFloat(SHADER_TUNING.wave.temporalFrequency.max)}, u_frequencyLevel);
	float phasePrimary = dot(uv, direction) * baseSpatialFrequency - u_time * temporalFrequency * 6.2831853;
	float phaseSecondary = dot(uv, cross) * (baseSpatialFrequency * ${toShaderFloat(SHADER_TUNING.wave.phaseBlend.secondarySpatialMultiplier)}) - u_time * temporalFrequency * 2.35;
	float longWave = sin(phasePrimary);
	float crossWave = sin(phaseSecondary + longWave * ${toShaderFloat(SHADER_TUNING.wave.phaseBlend.secondaryPhaseInfluence)});
	float swirl = sin((phasePrimary * ${toShaderFloat(SHADER_TUNING.wave.phaseBlend.primaryMix)} + phaseSecondary * ${toShaderFloat(SHADER_TUNING.wave.phaseBlend.secondaryMix)}) - u_time * temporalFrequency * ${toShaderFloat(SHADER_TUNING.wave.phaseBlend.timeMix)});
	float minSide = min(u_boxSize.x, u_boxSize.y);
	float amplitudePx = mix(${toShaderFloat(SHADER_TUNING.wave.amplitudeByMinSide.min)}, ${toShaderFloat(SHADER_TUNING.wave.amplitudeByMinSide.max)}, u_intensityLevel) * minSide;
	vec2 displacement = direction * (longWave * ${toShaderFloat(SHADER_TUNING.wave.displacementMix.alongPrimary)} + crossWave * ${toShaderFloat(SHADER_TUNING.wave.displacementMix.alongSecondary)}) + cross * (crossWave * ${toShaderFloat(SHADER_TUNING.wave.displacementMix.crossSecondary)} + swirl * ${toShaderFloat(SHADER_TUNING.wave.displacementMix.crossSwirl)});
	return displacement * amplitudePx;
}

vec2 rainDisplacement(vec2 uv) {
	const int dropCount = ${Math.max(1, Math.round(SHADER_TUNING.rain.dropCount))};
	float eventRate = mix(${toShaderFloat(SHADER_TUNING.rain.eventRate.min)}, ${toShaderFloat(SHADER_TUNING.rain.eventRate.max)}, u_frequencyLevel);
	float radiusLimit = mix(${toShaderFloat(SHADER_TUNING.rain.radiusLimit.min)}, ${toShaderFloat(SHADER_TUNING.rain.radiusLimit.max)}, u_scaleLevel);
	float bandWidth = mix(${toShaderFloat(SHADER_TUNING.rain.bandWidth.min)}, ${toShaderFloat(SHADER_TUNING.rain.bandWidth.max)}, u_scaleLevel);
	float oscillationFrequency = mix(${toShaderFloat(SHADER_TUNING.rain.oscillationFrequency.min)}, ${toShaderFloat(SHADER_TUNING.rain.oscillationFrequency.max)}, u_scaleLevel);
	float minSide = min(u_boxSize.x, u_boxSize.y);
	float amplitudePx = mix(${toShaderFloat(SHADER_TUNING.rain.amplitudeByMinSide.min)}, ${toShaderFloat(SHADER_TUNING.rain.amplitudeByMinSide.max)}, u_intensityLevel) * minSide;
	vec2 total = vec2(0.0);

	for (int i = 0; i < dropCount; i++) {
		float index = float(i);
		float cycle = u_time * eventRate + index * ${toShaderFloat(SHADER_TUNING.rain.hashSeed.timeOffset)};
		float eventId = floor(cycle);
		float life = fract(cycle);
		vec2 center = vec2(
			hash(vec2(eventId + index * ${toShaderFloat(SHADER_TUNING.rain.hashSeed.ax)}, index * ${toShaderFloat(SHADER_TUNING.rain.hashSeed.ay)} + ${toShaderFloat(SHADER_TUNING.rain.hashSeed.az)})),
			hash(vec2(eventId + index * ${toShaderFloat(SHADER_TUNING.rain.hashSeed.bx)}, index * ${toShaderFloat(SHADER_TUNING.rain.hashSeed.by)} + ${toShaderFloat(SHADER_TUNING.rain.hashSeed.bz)}))
		);
		vec2 delta = uv - center;
		float distanceToCenter = length(delta);
		float radius = max(${toShaderFloat(SHADER_TUNING.rain.life.radiusMin)}, life * radiusLimit);
		float ring = exp(-pow((distanceToCenter - radius) / max(bandWidth, 0.0001), 2.0));
		float oscillation = sin((distanceToCenter - radius) * oscillationFrequency);
		float rippleProfile = ${toShaderFloat(SHADER_TUNING.rain.rippleProfile.base)} + ${toShaderFloat(SHADER_TUNING.rain.rippleProfile.oscillationWeight)} * oscillation;
		float fade = 1.0 - life * ${toShaderFloat(SHADER_TUNING.rain.life.fadeMultiplier)};
		vec2 direction = delta / max(distanceToCenter, 0.0001);
		total += direction * ring * rippleProfile * fade;
	}

	return total * (amplitudePx / float(dropCount));
}

void main() {
	float safeZoom = max(u_zoom, 0.0001);
	vec2 cameraUv = (v_uv - vec2(0.5)) / safeZoom + vec2(0.5);
	vec2 displacementPx = u_algorithm == 0 ? waveDisplacement(v_uv) : rainDisplacement(v_uv);
	vec2 displacedUv = cameraUv + displacementPx / max(u_boxSize, vec2(1.0));
	vec2 aaOffset = (u_sampleRadius / max(u_boxSize, vec2(1.0))) * (1.0 + u_intensityLevel * 0.35);

	vec4 center = sampleSource(displacedUv);
	vec4 axis =
		sampleSource(displacedUv + vec2(aaOffset.x, 0.0)) +
		sampleSource(displacedUv - vec2(aaOffset.x, 0.0)) +
		sampleSource(displacedUv + vec2(0.0, aaOffset.y)) +
		sampleSource(displacedUv - vec2(0.0, aaOffset.y));
	vec4 diagonal =
		sampleSource(displacedUv + aaOffset) +
		sampleSource(displacedUv - aaOffset) +
		sampleSource(displacedUv + vec2(aaOffset.x, -aaOffset.y)) +
		sampleSource(displacedUv + vec2(-aaOffset.x, aaOffset.y));

	vec4 aaColor = center * 0.36 + axis * 0.12 + diagonal * 0.04;
	outColor = mix(center, aaColor, u_aaMix);
}
`;

const attachedRoots = new WeakSet();
const activeStates = new Set();

let animationFrameId = 0;
let pageVisible = document.visibilityState !== 'hidden';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const WAVE_LOG_PREFIX = '[background-wave]';

const setWaveStatus = (root, status) => {
	root.dataset.waveStatus = status;
};

const reportWaveIssue = (root, message, error) => {
	setWaveStatus(root, 'error');
	if (error) {
		console.warn(`${WAVE_LOG_PREFIX} ${message}`, error);
		return;
	}
	console.warn(`${WAVE_LOG_PREFIX} ${message}`);
};

const readNumber = (value, fallback, min, max) => {
	const parsed = Number.parseFloat(String(value ?? ''));
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	return clamp(parsed, min, max);
};

const readZoom = (value) => {
	const parsed = Number.parseFloat(String(value ?? ''));
	if (!Number.isFinite(parsed)) {
		return 1;
	}
	return clamp(parsed, 0.1, 4);
};

const readPositiveNumber = (value, fallback, min, max) => {
	const parsed = Number.parseFloat(String(value ?? ''));
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	return clamp(parsed, min, max);
};

const readCompositionScale = (value) => {
	return readPositiveNumber(value, 1, 0.1, 6);
};

const readPresentationMetrics = (state) => {
	const assetStyle = window.getComputedStyle(state.image);
	const rootStyle = window.getComputedStyle(state.root);
	const cssWidth = Math.max(2, Number.parseFloat(assetStyle.width) || state.image.naturalWidth);
	const cssHeight = Math.max(2, Number.parseFloat(assetStyle.height) || state.image.naturalHeight);
	const zoom = readZoom(rootStyle.getPropertyValue('--background-wave-zoom'));
	const compositionScale = readCompositionScale(rootStyle.getPropertyValue('--background-wave-composition-scale'));
	const displayWidth = Math.max(2, cssWidth * compositionScale * zoom);
	const displayHeight = Math.max(2, cssHeight * compositionScale * zoom);
	return {
		cssWidth,
		cssHeight,
		zoom,
		compositionScale,
		displayWidth,
		displayHeight,
	};
};

const ensureAnimationLoop = () => {
	if (animationFrameId !== 0) {
		return;
	}
	animationFrameId = window.requestAnimationFrame(runFrame);
};

const calculateWaveFrame = (state, seconds) => {
	const frequencyLevel = Math.pow(clamp(state.frequency / 2, 0, 1), 0.8);
	const intensityLevel = Math.pow(clamp(state.intensity / 2, 0, 1), 0.72);
	const scaleLevel = clamp((state.scale - 0.25) / 2.75, 0, 1);
	return {
		algorithm: state.algorithm === 'rain' ? 1 : 0,
		frequencyLevel: state.reducedMotion ? 0 : frequencyLevel,
		intensityLevel: state.reducedMotion ? 0 : intensityLevel,
		scaleLevel,
		time: seconds,
	};
};

const createShader = (gl, type, source) => {
	const shader = gl.createShader(type);
	if (!shader) {
		return null;
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.warn(`${WAVE_LOG_PREFIX} shader compile failed`, gl.getShaderInfoLog(shader) || '');
		gl.deleteShader(shader);
		return null;
	}
	return shader;
};

const createProgram = (gl) => {
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
	if (!vertexShader || !fragmentShader) {
		if (vertexShader) {
			gl.deleteShader(vertexShader);
		}
		if (fragmentShader) {
			gl.deleteShader(fragmentShader);
		}
		return null;
	}

	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		return null;
	}

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.warn(`${WAVE_LOG_PREFIX} shader link failed`, gl.getProgramInfoLog(program) || '');
		gl.deleteProgram(program);
		return null;
	}

	return program;
};

const resolveTextureSize = (state, displayWidth, displayHeight) => {
	const textureScale = state.coarsePointer ? QUALITY_PRESET.textureScaleCoarse : QUALITY_PRESET.textureScaleDesktop;
	const textureDprCap = state.coarsePointer ? QUALITY_PRESET.textureDprCapCoarse : QUALITY_PRESET.textureDprCapDesktop;
	const textureMaxPixels = state.coarsePointer ? QUALITY_PRESET.textureMaxPixelsCoarse : QUALITY_PRESET.textureMaxPixelsDesktop;
	const dpr = clamp(window.devicePixelRatio || 1, 1, textureDprCap);

	let textureWidth = Math.max(2, Math.round(displayWidth * textureScale * dpr));
	let textureHeight = Math.max(2, Math.round(displayHeight * textureScale * dpr));

	if (textureWidth > state.maxTextureSize || textureHeight > state.maxTextureSize) {
		const sizeScale = Math.min(state.maxTextureSize / textureWidth, state.maxTextureSize / textureHeight);
		textureWidth = Math.max(2, Math.floor(textureWidth * sizeScale));
		textureHeight = Math.max(2, Math.floor(textureHeight * sizeScale));
	}

	const maxPixelRatio = Math.sqrt(textureMaxPixels / Math.max(1, textureWidth * textureHeight));
	if (maxPixelRatio < 1) {
		textureWidth = Math.max(2, Math.floor(textureWidth * maxPixelRatio));
		textureHeight = Math.max(2, Math.floor(textureHeight * maxPixelRatio));
	}

	return { textureWidth, textureHeight };
};

const ensureTextureRaster = (state, textureWidth, textureHeight) => {
	if (!state.textureCanvas) {
		state.textureCanvas = document.createElement('canvas');
		state.textureContext = state.textureCanvas.getContext('2d', { alpha: true, desynchronized: true });
	}
	if (!state.textureContext) {
		return state.image;
	}
	if (state.textureCanvas.width !== textureWidth || state.textureCanvas.height !== textureHeight) {
		state.textureCanvas.width = textureWidth;
		state.textureCanvas.height = textureHeight;
	}
	state.textureContext.clearRect(0, 0, textureWidth, textureHeight);
	state.textureContext.imageSmoothingEnabled = true;
	if ('imageSmoothingQuality' in state.textureContext) {
		state.textureContext.imageSmoothingQuality = 'high';
	}
	state.textureContext.drawImage(state.image, 0, 0, textureWidth, textureHeight);
	return state.textureCanvas;
};

const uploadTexture = (state, force = false) => {
	if (!(state.image.complete && state.image.naturalWidth > 0 && state.image.naturalHeight > 0)) {
		return;
	}

	const presentation = readPresentationMetrics(state);
	const { textureWidth, textureHeight } = resolveTextureSize(
		state,
		presentation.displayWidth,
		presentation.displayHeight,
	);
	if (
		!force &&
		Math.abs(textureWidth - state.lastTextureWidth) < 1 &&
		Math.abs(textureHeight - state.lastTextureHeight) < 1
	) {
		return;
	}

	try {
		const gl = state.gl;
		gl.useProgram(state.program);
		gl.bindTexture(gl.TEXTURE_2D, state.texture);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const textureSource = ensureTextureRaster(state, textureWidth, textureHeight);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureSource);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, state.texture);
		if (state.uniforms.texture) {
			gl.uniform1i(state.uniforms.texture, 0);
		}
	} catch (error) {
		reportWaveIssue(state.root, 'texture upload failed, fallback to static image', error);
		return;
	}

	state.lastTextureWidth = textureWidth;
	state.lastTextureHeight = textureHeight;
	state.textureReady = true;
	setupCanvasPresentation(state, true);
	if (!state.reducedMotion) {
		state.root.classList.add('background-wave-module--webgl');
		setWaveStatus(state.root, 'running');
		state.lastFrameTime = 0;
		ensureAnimationLoop();
	} else {
		setWaveStatus(state.root, 'reduced-motion');
	}
};

const setupCanvasPresentation = (state, force = false) => {
	if (!state.textureReady) {
		return;
	}

	const presentation = readPresentationMetrics(state);
	if (
		!force &&
		Math.abs(presentation.cssWidth - state.lastCssWidth) < 0.1 &&
		Math.abs(presentation.cssHeight - state.lastCssHeight) < 0.1 &&
		Math.abs(presentation.zoom - state.lastZoom) < 0.001 &&
		Math.abs(presentation.compositionScale - state.lastCompositionScale) < 0.0005
	) {
		return;
	}

	state.lastCssWidth = presentation.cssWidth;
	state.lastCssHeight = presentation.cssHeight;
	state.lastZoom = presentation.zoom;
	state.lastCompositionScale = presentation.compositionScale;

	state.canvas.style.width = `${presentation.cssWidth}px`;
	state.canvas.style.height = `${presentation.cssHeight}px`;

	const dprCap = state.coarsePointer ? QUALITY_PRESET.dprCapCoarse : QUALITY_PRESET.dprCapDesktop;
	const renderScale = state.coarsePointer ? QUALITY_PRESET.renderScaleCoarse : QUALITY_PRESET.renderScaleDesktop;
	const dpr = clamp(window.devicePixelRatio || 1, 1, dprCap);
	const pixelWidth = Math.max(2, Math.round(presentation.displayWidth * renderScale * dpr));
	const pixelHeight = Math.max(2, Math.round(presentation.displayHeight * renderScale * dpr));
	if (state.canvas.width !== pixelWidth || state.canvas.height !== pixelHeight) {
		state.canvas.width = pixelWidth;
		state.canvas.height = pixelHeight;
		state.gl.viewport(0, 0, pixelWidth, pixelHeight);
	}

	uploadTexture(state);
	state.gl.useProgram(state.program);
	if (state.uniforms.boxSize) {
		state.gl.uniform2f(state.uniforms.boxSize, presentation.displayWidth, presentation.displayHeight);
	}
	if (state.uniforms.zoom) {
		state.gl.uniform1f(state.uniforms.zoom, 1);
	}
};

const createWebGlState = (root, baseState) => {
	const canvas = root.querySelector(CANVAS_SELECTOR);
	const image = root.querySelector(IMAGE_SELECTOR);
	if (!(canvas instanceof HTMLCanvasElement) || !(image instanceof HTMLImageElement)) {
		reportWaveIssue(root, 'missing canvas or image element, fallback to static image');
		return null;
	}

	const gl = canvas.getContext('webgl2', {
		alpha: true,
		antialias: true,
		depth: false,
		stencil: false,
		premultipliedAlpha: true,
		preserveDrawingBuffer: false,
		powerPreference: window.matchMedia('(pointer: coarse)').matches ? 'low-power' : 'high-performance',
	});
	if (!gl) {
		setWaveStatus(root, 'no-webgl2');
		return null;
	}

	const program = createProgram(gl);
	if (!program) {
		setWaveStatus(root, 'shader-build-failed');
		return null;
	}

	const positionLocation = gl.getAttribLocation(program, 'a_position');
	const uniforms = {
		texture: gl.getUniformLocation(program, 'u_texture'),
		boxSize: gl.getUniformLocation(program, 'u_boxSize'),
		algorithm: gl.getUniformLocation(program, 'u_algorithm'),
		frequencyLevel: gl.getUniformLocation(program, 'u_frequencyLevel'),
		intensityLevel: gl.getUniformLocation(program, 'u_intensityLevel'),
		scaleLevel: gl.getUniformLocation(program, 'u_scaleLevel'),
		zoom: gl.getUniformLocation(program, 'u_zoom'),
		time: gl.getUniformLocation(program, 'u_time'),
		sampleRadius: gl.getUniformLocation(program, 'u_sampleRadius'),
		aaMix: gl.getUniformLocation(program, 'u_aaMix'),
	};
	if (positionLocation < 0 || !uniforms.texture || !uniforms.boxSize || !uniforms.zoom) {
		setWaveStatus(root, 'uniform-missing');
		gl.deleteProgram(program);
		return null;
	}

	const quadBuffer = gl.createBuffer();
	const texture = gl.createTexture();
	if (!quadBuffer || !texture) {
		if (quadBuffer) {
			gl.deleteBuffer(quadBuffer);
		}
		if (texture) {
			gl.deleteTexture(texture);
		}
		gl.deleteProgram(program);
		return null;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	gl.useProgram(program);
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.clearColor(0, 0, 0, 0);

	const state = {
		...baseState,
		canvas,
		image,
		gl,
		program,
		uniforms,
		texture,
		quadBuffer,
		maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096,
		textureCanvas: null,
		textureContext: null,
		coarsePointer: window.matchMedia('(pointer: coarse)').matches,
		textureReady: false,
		lastCssWidth: 0,
		lastCssHeight: 0,
		lastZoom: -1,
		lastCompositionScale: 1,
		lastTextureWidth: 0,
		lastTextureHeight: 0,
	};

	const onImageReady = () => {
		uploadTexture(state);
	};
	if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
		onImageReady();
	} else {
		image.addEventListener('load', onImageReady, { once: true });
	}

	canvas.addEventListener('webglcontextlost', (event) => {
		event.preventDefault();
		state.root.classList.remove('background-wave-module--webgl');
		setWaveStatus(state.root, 'context-lost');
		activeStates.delete(state);
	});

	return state;
};

const renderState = (state, timestamp) => {
	if (!state.textureReady || state.reducedMotion || !pageVisible) {
		return false;
	}
	if (timestamp - state.lastFrameTime < state.frameDuration) {
		return true;
	}
	state.lastFrameTime = timestamp;

	const seconds = timestamp * 0.001;
	const frame = calculateWaveFrame(state, seconds);
	setupCanvasPresentation(state);

	const sampleRadius = clamp(
		QUALITY_PRESET.aaRadiusBase + frame.intensityLevel * 0.18 + frame.scaleLevel * 0.12,
		0.56,
		1.18,
	);
	const aaMix = clamp(QUALITY_PRESET.aaMixBase + frame.intensityLevel * 0.08, 0.58, 0.84);
	state.gl.useProgram(state.program);
	if (state.uniforms.algorithm) {
		state.gl.uniform1i(state.uniforms.algorithm, frame.algorithm);
	}
	if (state.uniforms.frequencyLevel) {
		state.gl.uniform1f(state.uniforms.frequencyLevel, frame.frequencyLevel);
	}
	if (state.uniforms.intensityLevel) {
		state.gl.uniform1f(state.uniforms.intensityLevel, frame.intensityLevel);
	}
	if (state.uniforms.scaleLevel) {
		state.gl.uniform1f(state.uniforms.scaleLevel, frame.scaleLevel);
	}
	if (state.uniforms.time) {
		state.gl.uniform1f(state.uniforms.time, frame.time);
	}
	if (state.uniforms.sampleRadius) {
		state.gl.uniform1f(state.uniforms.sampleRadius, sampleRadius);
	}
	if (state.uniforms.aaMix) {
		state.gl.uniform1f(state.uniforms.aaMix, aaMix);
	}
	state.gl.drawArrays(state.gl.TRIANGLE_STRIP, 0, 4);

	if (!state.root.classList.contains('background-wave-module--webgl')) {
		state.root.classList.add('background-wave-module--webgl');
	}
	return true;
};

const runFrame = (timestamp) => {
	animationFrameId = 0;
	let continueLoop = false;
	activeStates.forEach((state) => {
		try {
			const keepState = renderState(state, timestamp);
			continueLoop = continueLoop || keepState;
		} catch (_error) {
			state.root.classList.remove('background-wave-module--webgl');
			reportWaveIssue(state.root, 'runtime render error, fallback to static image');
			activeStates.delete(state);
		}
	});
	if (continueLoop) {
		ensureAnimationLoop();
	}
};

const initWave = (root) => {
	if (attachedRoots.has(root) || root.dataset.backgroundWaveReady === 'true') {
		return;
	}
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}

	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const baseState = {
		root,
		algorithm: ALGORITHM_VALUES.includes(root.dataset.waveAlgorithm || '') ? root.dataset.waveAlgorithm : 'wave',
		frequency: readNumber(root.dataset.waveFrequency, 0.9, 0, 2),
		intensity: readNumber(root.dataset.waveIntensity, 0.8, 0, 2),
		scale: readNumber(root.dataset.waveScale, 1, 0.25, 3),
		frameDuration: 1000 / (window.matchMedia('(pointer: coarse)').matches ? QUALITY_PRESET.fpsCoarse : QUALITY_PRESET.fpsDesktop),
		reducedMotion: motionQuery.matches,
		lastFrameTime: 0,
	};

	const state = createWebGlState(root, baseState);
	root.dataset.backgroundWaveReady = 'true';
	attachedRoots.add(root);

	if (!state) {
		if (!root.dataset.waveStatus) {
			setWaveStatus(root, 'init-failed');
		}
		return;
	}

	const onMotionChange = () => {
		state.reducedMotion = motionQuery.matches;
		if (state.reducedMotion) {
			state.root.classList.remove('background-wave-module--webgl');
			setWaveStatus(state.root, 'reduced-motion');
			return;
		}
		if (state.textureReady) {
			state.lastFrameTime = 0;
			setWaveStatus(state.root, 'running');
			ensureAnimationLoop();
		}
	};
	if (typeof motionQuery.addEventListener === 'function') {
		motionQuery.addEventListener('change', onMotionChange);
	} else if (typeof motionQuery.addListener === 'function') {
		motionQuery.addListener(onMotionChange);
	}

	activeStates.add(state);
	if (!state.reducedMotion && state.textureReady) {
		ensureAnimationLoop();
	}
};

const initAllWaves = () => {
	document.querySelectorAll(MODULE_SELECTOR).forEach((root) => {
		if (root instanceof HTMLElement) {
			initWave(root);
		}
	});
};

window.addEventListener('resize', () => {
	activeStates.forEach((state) => {
		state.lastCssWidth = 0;
		state.lastCssHeight = 0;
		state.lastCompositionScale = 0;
		state.lastTextureWidth = 0;
		state.lastTextureHeight = 0;
	});
	ensureAnimationLoop();
});

document.addEventListener('visibilitychange', () => {
	pageVisible = document.visibilityState !== 'hidden';
	if (pageVisible) {
		ensureAnimationLoop();
	}
});

initAllWaves();
