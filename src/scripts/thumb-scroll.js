const MODULE_SELECTOR = '[data-thumb-scroll]';
const ACTIVE_CLASS = 'thumb-scroll__slide--active';
const attachedRoots = new WeakSet();
const AUTO_TONE_CLASS = 'thumb-scroll--auto';
const DARK_TONE_CLASS = 'thumb-scroll--dark';
const LIGHT_TONE_CLASS = 'thumb-scroll--light';

const parseRgbChannels = (value) => {
	const match = /^rgba?\((.+)\)$/i.exec(value.trim());
	if (!match) {
		return null;
	}
	const parts = match[1].split(',').map((part) => part.trim());
	if (parts.length < 3) {
		return null;
	}
	const red = Number.parseFloat(parts[0]);
	const green = Number.parseFloat(parts[1]);
	const blue = Number.parseFloat(parts[2]);
	if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
		return null;
	}
	let alpha = 1;
	if (parts.length >= 4) {
		const parsedAlpha = Number.parseFloat(parts[3]);
		if (!Number.isNaN(parsedAlpha)) {
			alpha = parsedAlpha;
		}
	}
	return { red, green, blue, alpha };
};

const toLinear = (channel) => {
	const normalized = channel / 255;
	if (normalized <= 0.03928) {
		return normalized / 12.92;
	}
	return ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb) => {
	return 0.2126 * toLinear(rgb.red) + 0.7152 * toLinear(rgb.green) + 0.0722 * toLinear(rgb.blue);
};

const toneFromClassList = (element) => {
	for (const className of element.classList) {
		const normalized = className.toLowerCase();
		if (normalized.includes('tone-') && normalized.includes('dark')) {
			return 'dark';
		}
		if (normalized.includes('tone-') && normalized.includes('light')) {
			return 'light';
		}
		if (/(^|-)dark($|-)/.test(normalized)) {
			return 'dark';
		}
		if (/(^|-)light($|-)/.test(normalized)) {
			return 'light';
		}
	}
	return null;
};

const toneFromBackground = (element) => {
	const computed = window.getComputedStyle(element);
	const parsed = parseRgbChannels(computed.backgroundColor);
	if (!parsed || parsed.alpha < 0.05) {
		return null;
	}
	return luminance(parsed) < 0.45 ? 'dark' : 'light';
};

const toneFromForeground = (element) => {
	const computed = window.getComputedStyle(element);
	const parsed = parseRgbChannels(computed.color);
	if (!parsed || parsed.alpha < 0.05) {
		return null;
	}
	return luminance(parsed) > 0.62 ? 'dark' : 'light';
};

const resolveNearestTone = (root) => {
	let cursor = root.parentElement;
	while (cursor) {
		const byClass = toneFromClassList(cursor);
		if (byClass) {
			return byClass;
		}
		const byBackground = toneFromBackground(cursor);
		if (byBackground) {
			return byBackground;
		}
		const byForeground = toneFromForeground(cursor);
		if (byForeground) {
			return byForeground;
		}
		cursor = cursor.parentElement;
	}
	return 'light';
};

const applyAutoTone = (root) => {
	if (!(root instanceof HTMLElement) || !root.classList.contains(AUTO_TONE_CLASS)) {
		return;
	}
	const tone = resolveNearestTone(root);
	root.classList.remove(AUTO_TONE_CLASS);
	root.classList.remove(DARK_TONE_CLASS, LIGHT_TONE_CLASS);
	root.classList.add(tone === 'dark' ? DARK_TONE_CLASS : LIGHT_TONE_CLASS);
	root.setAttribute('data-thumb-scroll-resolved-tone', tone);
};

const clampIndex = (value, size) => {
	if (size === 0) {
		return 0;
	}
	return ((value % size) + size) % size;
};

const setSlideState = (slides, activeIndex) => {
	slides.forEach((slide, index) => {
		const isActive = index === activeIndex;
		slide.classList.toggle(ACTIVE_CLASS, isActive);
		slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
	});
};

const attachNavHandlers = (root, slides, controls) => {
	let currentIndex = slides.findIndex((slide) => slide.classList.contains(ACTIVE_CLASS));
	if (currentIndex < 0) {
		currentIndex = 0;
	}
	const size = slides.length;
	const update = () => setSlideState(slides, currentIndex);
	const move = (delta) => {
		if (size <= 1) {
			return;
		}
		currentIndex = clampIndex(currentIndex + delta, size);
		update();
	};

	controls.prev.forEach((button) => button.addEventListener('click', () => move(-1)));
	controls.next.forEach((button) => button.addEventListener('click', () => move(1)));

	let pointerStartX = 0;
	let pointerActive = false;

	const shouldHandlePointer = (target) => !(target instanceof HTMLElement && target.closest('button'));

	const onPointerDown = (event) => {
		if (!event.isPrimary || size <= 1 || !shouldHandlePointer(event.target)) {
			return;
		}
		pointerActive = true;
		pointerStartX = event.clientX;
	};

	const endPointerInteraction = () => {
		pointerActive = false;
	};

	const onPointerUp = (event) => {
		if (!pointerActive) {
			return;
		}
		const deltaX = event.clientX - pointerStartX;
		if (Math.abs(deltaX) > 40) {
			move(deltaX < 0 ? 1 : -1);
		}
		endPointerInteraction();
	};

	root.addEventListener('pointerdown', onPointerDown);
	root.addEventListener('pointerup', onPointerUp);
	root.addEventListener('pointerleave', endPointerInteraction);
	root.addEventListener('pointercancel', endPointerInteraction);

	const onKeyDown = (event) => {
		if (size <= 1) {
			return;
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			move(-1);
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			move(1);
		}
	};

	root.addEventListener('keydown', onKeyDown);
	attachedRoots.add(root);
	update();
};

const resolveControls = (root, slidesContainer) => {
	if (slidesContainer && slidesContainer.id) {
		const controlSelector = `[aria-controls="${slidesContainer.id}"]`;
		return {
			prev: Array.from(document.querySelectorAll(`[data-thumb-scroll-prev]${controlSelector}`)),
			next: Array.from(document.querySelectorAll(`[data-thumb-scroll-next]${controlSelector}`)),
		};
	}

	return {
		prev: Array.from(root.querySelectorAll('[data-thumb-scroll-prev]')),
		next: Array.from(root.querySelectorAll('[data-thumb-scroll-next]')),
	};
};

const initController = () => {
	const modules = document.querySelectorAll(MODULE_SELECTOR);
	modules.forEach((root) => {
		if (root.closest('[data-module-clone="true"]')) {
			return;
		}
		applyAutoTone(root);
		if (attachedRoots.has(root)) {
			return;
		}
		const slides = Array.from(root.querySelectorAll('.thumb-scroll__slide'));
		if (slides.length === 0) {
			return;
		}
		const slidesContainer = root.querySelector('.thumb-scroll__slides');
		const controls = resolveControls(root, slidesContainer);
		attachNavHandlers(root, slides, controls);
	});
};

const run = () => {
	initController();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
