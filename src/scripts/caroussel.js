const MODULE_SELECTOR = '[data-caroussel]';
const VIEWPORT_SELECTOR = '[data-caroussel-viewport]';
const TRACK_SELECTOR = '[data-caroussel-track]';
const SLIDE_SELECTOR = '[data-caroussel-slide]';
const ACTIVE_SLIDE_CLASS = 'caroussel__slide--active';
const AUTO_TONE_CLASS = 'caroussel--tone-auto';
const DARK_TONE_CLASS = 'caroussel--tone-dark';
const LIGHT_TONE_CLASS = 'caroussel--tone-light';
const DISPLAY_REVOLVER = 'revolver';
const DISPLAY_CUT_ELEMENTS = 'cut-elements';
const PAGE_TEASER_SELECTOR = '[data-page-teaser]';
const PAGE_TEASER_READY_EVENT = 'page-teaser:ready';
const REVOLVER_CARD_HEIGHT_VAR = '--caroussel-revolver-card-base-height';
const REVOLVER_OVERFLOW_PAD_VAR = '--caroussel-revolver-overflow-pad';
const REVOLVER_CENTER_SCALE = 1.1;

const attachedRoots = new WeakSet();

const prefersReducedMotion = () => {
	return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const clampIndex = (value, size) => {
	if (size === 0) {
		return 0;
	}
	return ((value % size) + size) % size;
};

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
	root.setAttribute('data-caroussel-resolved-tone', tone);
};

const shouldWaitForPageTeaserRandomShuffle = (root) => {
	const pageTeaser = root.closest(PAGE_TEASER_SELECTOR);
	if (!(pageTeaser instanceof HTMLElement)) {
		return false;
	}
	return pageTeaser.dataset.pageTeaserOrder === 'random' && pageTeaser.dataset.pageTeaserReady !== 'true';
};

const shouldIgnorePointer = (target) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return Boolean(target.closest('a,button,input,textarea,select,summary,details,label'));
};

const setSlideInteractivity = (slide, isActive) => {
	slide.classList.toggle(ACTIVE_SLIDE_CLASS, isActive);
	if (isActive) {
		slide.setAttribute('aria-hidden', 'false');
		slide.removeAttribute('inert');
		return;
	}
	slide.setAttribute('aria-hidden', 'true');
	slide.setAttribute('inert', '');
};

const clearRevolverState = (slides) => {
	slides.forEach((slide) => {
		slide.dataset.carousselState = 'hidden';
		setSlideInteractivity(slide, false);
	});
};

const markSlideState = (slides, index, state, isActive = false) => {
	const slide = slides[index];
	if (!slide) {
		return;
	}
	slide.dataset.carousselState = state;
	setSlideInteractivity(slide, isActive);
};

const initRevolverDisplay = (root, viewport, track, slides) => {
	if (slides.length < 3) {
		return false;
	}

	root.dataset.carousselDisplayResolved = DISPLAY_REVOLVER;
	let activeIndex = slides.findIndex((slide) => slide.classList.contains(ACTIVE_SLIDE_CLASS));
	if (activeIndex < 0) {
		activeIndex = 0;
	}

	const size = slides.length;
	let isAnimating = false;
	let animationTimeout = 0;
	let pointerActive = false;
	let dragLocked = false;
	let pointerStartX = 0;
	let pointerStartY = 0;
	let measureFrame = 0;
	let cardResizeObserver = null;

	const updateTrackHeight = () => {
		root.style.removeProperty(REVOLVER_CARD_HEIGHT_VAR);
		root.style.removeProperty(REVOLVER_OVERFLOW_PAD_VAR);
		track.style.removeProperty('minHeight');
		track.style.removeProperty('height');

		const activeMap = slides.map((slide) => slide.classList.contains(ACTIVE_SLIDE_CLASS));
		slides.forEach((slide) => {
			slide.classList.remove(ACTIVE_SLIDE_CLASS);
		});

		let maxHeight = 0;
		slides.forEach((slide) => {
			if (!(slide instanceof HTMLElement)) {
				return;
			}
			const card = slide.querySelector('.caroussel__card');
			if (!(card instanceof HTMLElement)) {
				return;
			}
			maxHeight = Math.max(maxHeight, card.offsetHeight);
		});

		slides.forEach((slide, index) => {
			slide.classList.toggle(ACTIVE_SLIDE_CLASS, activeMap[index] === true);
		});

		if (maxHeight > 0) {
			const baseHeight = `${Math.ceil(maxHeight)}px`;
			const scaledHeight = `${Math.ceil(maxHeight * REVOLVER_CENTER_SCALE)}px`;
			const topOverflowPad = `${Math.ceil((maxHeight * (REVOLVER_CENTER_SCALE - 1)) / 2 + 6)}px`;
			root.style.setProperty(REVOLVER_CARD_HEIGHT_VAR, baseHeight);
			root.style.setProperty(REVOLVER_OVERFLOW_PAD_VAR, topOverflowPad);
			track.style.minHeight = scaledHeight;
			track.style.height = scaledHeight;
		}
	};

	const scheduleTrackMeasure = () => {
		if (measureFrame) {
			cancelAnimationFrame(measureFrame);
		}
		measureFrame = requestAnimationFrame(() => {
			measureFrame = 0;
			updateTrackHeight();
		});
	};

	const clearAnimationClass = () => {
		root.classList.remove('caroussel--animating', 'caroussel--animating-next', 'caroussel--animating-prev');
	};

	const applyRestState = () => {
		clearRevolverState(slides);
		const centerIndex = activeIndex;
		const leftIndex = clampIndex(activeIndex - 1, size);
		const rightIndex = clampIndex(activeIndex + 1, size);
		markSlideState(slides, leftIndex, 'left');
		markSlideState(slides, centerIndex, 'center', true);
		markSlideState(slides, rightIndex, 'right');
		root.dataset.carousselActiveIndex = String(activeIndex);
		scheduleTrackMeasure();
	};

	const setAnimatingTargetActive = (targetIndex) => {
		slides.forEach((slide, index) => {
			setSlideInteractivity(slide, index === targetIndex);
		});
	};

	const prepareAnimationState = (direction) => {
		clearRevolverState(slides);
		const centerIndex = activeIndex;
		if (direction > 0) {
			const leftExitIndex = clampIndex(activeIndex - 1, size);
			const rightIndex = clampIndex(activeIndex + 1, size);
			const enteringIndex = clampIndex(activeIndex + 2, size);
			markSlideState(slides, centerIndex, 'center');
			markSlideState(slides, rightIndex, 'right');
			markSlideState(slides, leftExitIndex, 'left-exit');
			if (enteringIndex !== centerIndex && enteringIndex !== rightIndex && enteringIndex !== leftExitIndex) {
				markSlideState(slides, enteringIndex, 'enter-right');
			}
			setAnimatingTargetActive(rightIndex);
			return;
		}

		const rightExitIndex = clampIndex(activeIndex + 1, size);
		const leftIndex = clampIndex(activeIndex - 1, size);
		const enteringIndex = clampIndex(activeIndex - 2, size);
		markSlideState(slides, centerIndex, 'center');
		markSlideState(slides, leftIndex, 'left');
		markSlideState(slides, rightExitIndex, 'right-exit');
		if (enteringIndex !== centerIndex && enteringIndex !== leftIndex && enteringIndex !== rightExitIndex) {
			markSlideState(slides, enteringIndex, 'enter-left');
		}
		setAnimatingTargetActive(leftIndex);
	};

	const finishAnimation = (direction) => {
		activeIndex = clampIndex(activeIndex + direction, size);
		clearAnimationClass();
		applyRestState();
		isAnimating = false;
	};

	const moveBy = (direction) => {
		if (isAnimating || size <= 1) {
			return;
		}
		if (prefersReducedMotion()) {
			activeIndex = clampIndex(activeIndex + direction, size);
			applyRestState();
			return;
		}
		isAnimating = true;
		if (animationTimeout) {
			window.clearTimeout(animationTimeout);
			animationTimeout = 0;
		}

		prepareAnimationState(direction);
		requestAnimationFrame(() => {
			root.classList.add('caroussel--animating');
			root.classList.add(direction > 0 ? 'caroussel--animating-next' : 'caroussel--animating-prev');
		});

		animationTimeout = window.setTimeout(() => {
			animationTimeout = 0;
			finishAnimation(direction);
		}, 440);
	};

	const controlSelector = viewport.id ? `[aria-controls="${viewport.id}"]` : '';
	const prevButtons = Array.from(root.querySelectorAll(`[data-caroussel-prev]${controlSelector}`));
	const nextButtons = Array.from(root.querySelectorAll(`[data-caroussel-next]${controlSelector}`));
	prevButtons.forEach((button) => button.addEventListener('click', () => moveBy(-1)));
	nextButtons.forEach((button) => button.addEventListener('click', () => moveBy(1)));

	const onPointerDown = (event) => {
		if (!event.isPrimary || shouldIgnorePointer(event.target) || size <= 1) {
			return;
		}
		pointerActive = true;
		dragLocked = false;
		pointerStartX = event.clientX;
		pointerStartY = event.clientY;
		root.classList.remove('caroussel--dragging');
	};

	const onPointerMove = (event) => {
		if (!pointerActive) {
			return;
		}
		const deltaX = event.clientX - pointerStartX;
		const deltaY = event.clientY - pointerStartY;
		if (!dragLocked) {
			if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
				pointerActive = false;
				return;
			}
			if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
				dragLocked = true;
				viewport.classList.add('caroussel__viewport--dragging');
				root.classList.add('caroussel--dragging');
			} else {
				return;
			}
		}
		event.preventDefault();
	};

	const endPointer = (event) => {
		if (!pointerActive) {
			return;
		}
		pointerActive = false;
		const deltaX = event.clientX - pointerStartX;
		viewport.classList.remove('caroussel__viewport--dragging');
		root.classList.remove('caroussel--dragging');
		if (!dragLocked) {
			dragLocked = false;
			return;
		}
		dragLocked = false;
		if (Math.abs(deltaX) <= 40) {
			return;
		}
		moveBy(deltaX < 0 ? 1 : -1);
	};

	const cancelPointer = () => {
		pointerActive = false;
		dragLocked = false;
		viewport.classList.remove('caroussel__viewport--dragging');
		root.classList.remove('caroussel--dragging');
	};

	viewport.addEventListener('pointerdown', onPointerDown);
	viewport.addEventListener('pointermove', onPointerMove);
	viewport.addEventListener('pointerup', endPointer);
	viewport.addEventListener('pointercancel', cancelPointer);
	viewport.addEventListener('pointerleave', cancelPointer);

	viewport.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			moveBy(-1);
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			moveBy(1);
		}
	});

	applyRestState();
	if (typeof ResizeObserver !== 'undefined') {
		cardResizeObserver = new ResizeObserver(() => {
			scheduleTrackMeasure();
		});
		slides.forEach((slide) => {
			const card = slide.querySelector('.caroussel__card');
			if (card instanceof HTMLElement) {
				cardResizeObserver.observe(card);
			}
		});
	}
	slides.forEach((slide) => {
		slide.querySelectorAll('img').forEach((image) => {
			if (!(image instanceof HTMLImageElement) || image.complete) {
				return;
			}
			const remeasure = () => {
				scheduleTrackMeasure();
			};
			image.addEventListener('load', remeasure, { once: true });
			image.addEventListener('error', remeasure, { once: true });
		});
	});
	window.addEventListener('resize', scheduleTrackMeasure);
	if (document.fonts?.ready) {
		document.fonts.ready.then(scheduleTrackMeasure).catch(() => {});
	}
	return true;
};

const sanitizeCloneSubtree = (root) => {
	if (!(root instanceof HTMLElement)) {
		return;
	}

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
	const elements = [root];
	while (walker.nextNode()) {
		const current = walker.currentNode;
		if (current instanceof HTMLElement) {
			elements.push(current);
		}
	}

	elements.forEach((element) => {
		if (element.hasAttribute('id')) {
			element.removeAttribute('id');
		}
		Array.from(element.attributes).forEach((attr) => {
			const name = attr.name;
			if (name.startsWith('data-') && !name.startsWith('data-caroussel')) {
				element.removeAttribute(name);
			}
		});
	});
};

const buildClones = (track, originals) => {
	const clonesBefore = originals.map((node) => {
		const clone = node.cloneNode(true);
		clone.dataset.carousselClone = 'true';
		clone.dataset.moduleClone = 'true';
		clone.setAttribute('aria-hidden', 'true');
		clone.setAttribute('inert', '');
		sanitizeCloneSubtree(clone);
		return clone;
	});
	const clonesAfter = originals.map((node) => {
		const clone = node.cloneNode(true);
		clone.dataset.carousselClone = 'true';
		clone.dataset.moduleClone = 'true';
		clone.setAttribute('aria-hidden', 'true');
		clone.setAttribute('inert', '');
		sanitizeCloneSubtree(clone);
		return clone;
	});

	clonesBefore.reverse().forEach((clone) => track.insertBefore(clone, track.firstChild));
	clonesAfter.forEach((clone) => track.appendChild(clone));
};

const measureStep = (slides) => {
	if (slides.length >= 2) {
		const first = slides[0].getBoundingClientRect();
		const second = slides[1].getBoundingClientRect();
		const step = second.left - first.left;
		if (Number.isFinite(step) && Math.abs(step) > 0.5) {
			return step;
		}
	}
	const fallback = slides[0]?.getBoundingClientRect();
	return fallback ? fallback.width : 0;
};

const setTrackTransform = (track, offset) => {
	track.style.transform = `translate3d(${offset}px, 0, 0)`;
};

const setExtendedSlideInteractivity = (slides, activeExtendedIndex, size) => {
	const logicalIndex = clampIndex(activeExtendedIndex - size, size);
	slides.forEach((slide) => {
		const isClone = slide.dataset.carousselClone === 'true';
		const matchesLogical = Number.parseInt(slide.dataset.carousselIndex || '0', 10) === logicalIndex;
		const isActive = !isClone && matchesLogical;
		slide.classList.toggle(ACTIVE_SLIDE_CLASS, isActive);
		if (isActive) {
			slide.removeAttribute('aria-hidden');
			slide.removeAttribute('inert');
			return;
		}
		slide.setAttribute('aria-hidden', 'true');
		slide.setAttribute('inert', '');
	});
};

const initCutElementsDisplay = (root, viewport, track, originalSlides) => {
	if (originalSlides.length < 2) {
		return false;
	}

	root.classList.remove('caroussel--animating', 'caroussel--animating-next', 'caroussel--animating-prev');
	root.dataset.carousselDisplayResolved = DISPLAY_CUT_ELEMENTS;

	buildClones(track, originalSlides);
	let slides = Array.from(track.querySelectorAll(SLIDE_SELECTOR));
	const size = originalSlides.length;

	let step = 0;
	let baseOffset = 0;
	let currentIndex = size;
	let offset = 0;
	let animationFrame = 0;
	let pointerActive = false;
	let pointerStartX = 0;
	let pointerStartY = 0;
	let pointerStartOffset = 0;
	let pointerSamples = [];
	let dragLocked = false;

	const cancelAnimation = () => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}
	};

	const recomputeLayout = () => {
		slides = Array.from(track.querySelectorAll(SLIDE_SELECTOR));
		step = measureStep(originalSlides);
		const viewportWidth = viewport.getBoundingClientRect().width;
		const slideWidth = originalSlides[0].getBoundingClientRect().width;
		baseOffset = (viewportWidth - slideWidth) / 2;
		offset = baseOffset - currentIndex * step;
		setTrackTransform(track, offset);
		setExtendedSlideInteractivity(slides, currentIndex, size);
	};

	const normalizeIndexAndOffset = () => {
		const cycle = step * size;
		if (cycle === 0) {
			return;
		}
		if (currentIndex < size) {
			currentIndex += size;
			offset -= cycle;
		}
		if (currentIndex >= size * 2) {
			currentIndex -= size;
			offset += cycle;
		}
		setTrackTransform(track, offset);
	};

	const snapToIndex = (targetIndex, options = {}) => {
		cancelAnimation();
		const immediate = Boolean(options.immediate) || prefersReducedMotion();
		const targetOffset = baseOffset - targetIndex * step;

		if (immediate || step === 0) {
			currentIndex = targetIndex;
			offset = targetOffset;
			setTrackTransform(track, offset);
			normalizeIndexAndOffset();
			setExtendedSlideInteractivity(slides, currentIndex, size);
			return;
		}

		const startOffset = offset;
		const delta = targetOffset - startOffset;
		const duration = 180;
		const startTime = performance.now();

		const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

		const tick = (now) => {
			const progress = Math.min(1, (now - startTime) / duration);
			offset = startOffset + delta * easeOutCubic(progress);
			setTrackTransform(track, offset);
			if (progress < 1) {
				animationFrame = requestAnimationFrame(tick);
				return;
			}
			animationFrame = 0;
			currentIndex = targetIndex;
			normalizeIndexAndOffset();
			setExtendedSlideInteractivity(slides, currentIndex, size);
		};

		animationFrame = requestAnimationFrame(tick);
	};

	const snapToNearest = () => {
		if (step === 0) {
			return;
		}
		const indexFloat = (baseOffset - offset) / step;
		const nearest = Math.round(indexFloat);
		snapToIndex(nearest);
	};

	const driftAndSnap = (velocityPxPerMs) => {
		cancelAnimation();
		if (prefersReducedMotion()) {
			snapToNearest();
			return;
		}

		let last = performance.now();
		let velocity = velocityPxPerMs;
		const stopVelocity = 0.02;
		const frictionPerMs = 0.995;
		const cycle = step * size;

		const tick = (now) => {
			const deltaTime = Math.min(48, now - last);
			last = now;
			offset += velocity * deltaTime;
			velocity *= Math.pow(frictionPerMs, deltaTime);

			if (cycle > 0 && step !== 0) {
				let indexFloat = (baseOffset - offset) / step;
				while (indexFloat < size * 0.5) {
					offset -= cycle;
					indexFloat += size;
				}
				while (indexFloat > size * 2.5) {
					offset += cycle;
					indexFloat -= size;
				}
			}

			setTrackTransform(track, offset);
			if (Math.abs(velocity) <= stopVelocity) {
				animationFrame = 0;
				snapToNearest();
				return;
			}
			animationFrame = requestAnimationFrame(tick);
		};

		animationFrame = requestAnimationFrame(tick);
	};

	const moveBy = (delta) => {
		if (size <= 1) {
			return;
		}
		snapToIndex(currentIndex + delta);
	};

	const controlSelector = viewport.id ? `[aria-controls="${viewport.id}"]` : '';
	const prevButtons = Array.from(root.querySelectorAll(`[data-caroussel-prev]${controlSelector}`));
	const nextButtons = Array.from(root.querySelectorAll(`[data-caroussel-next]${controlSelector}`));
	prevButtons.forEach((button) => button.addEventListener('click', () => moveBy(-1)));
	nextButtons.forEach((button) => button.addEventListener('click', () => moveBy(1)));

	const onPointerDown = (event) => {
		if (!event.isPrimary || shouldIgnorePointer(event.target)) {
			return;
		}
		pointerActive = true;
		dragLocked = false;
		pointerStartX = event.clientX;
		pointerStartY = event.clientY;
		pointerStartOffset = offset;
		pointerSamples = [{ x: event.clientX, t: performance.now() }];
		root.classList.remove('caroussel--dragging');
		cancelAnimation();
	};

	const onPointerMove = (event) => {
		if (!pointerActive) {
			return;
		}
		const deltaX = event.clientX - pointerStartX;
		const deltaY = event.clientY - pointerStartY;

		if (!dragLocked) {
			if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
				pointerActive = false;
				return;
			}
			if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
				dragLocked = true;
				viewport.classList.add('caroussel__viewport--dragging');
				root.classList.add('caroussel--dragging');
				try {
					viewport.setPointerCapture(event.pointerId);
				} catch {
					// ignore
				}
			} else {
				return;
			}
		}

		event.preventDefault();
		offset = pointerStartOffset + deltaX;
		const cycle = step * size;
		if (cycle > 0 && step !== 0) {
			let indexFloat = (baseOffset - offset) / step;
			while (indexFloat < size * 0.5) {
				offset -= cycle;
				indexFloat += size;
			}
			while (indexFloat > size * 2.5) {
				offset += cycle;
				indexFloat -= size;
			}
		}
		setTrackTransform(track, offset);
		pointerSamples.push({ x: event.clientX, t: performance.now() });
		if (pointerSamples.length > 6) {
			pointerSamples.shift();
		}
	};

	const resolveVelocity = () => {
		if (pointerSamples.length < 2) {
			return 0;
		}
		const last = pointerSamples[pointerSamples.length - 1];
		let first = pointerSamples[0];
		for (let index = pointerSamples.length - 2; index >= 0; index -= 1) {
			const sample = pointerSamples[index];
			if (last.t - sample.t > 50) {
				first = sample;
				break;
			}
			first = sample;
		}
		const deltaTime = last.t - first.t;
		if (deltaTime <= 0) {
			return 0;
		}
		const deltaX = last.x - first.x;
		return deltaX / deltaTime;
	};

	const endPointer = () => {
		if (!pointerActive) {
			return;
		}
		pointerActive = false;
		const locked = dragLocked;
		dragLocked = false;
		viewport.classList.remove('caroussel__viewport--dragging');
		root.classList.remove('caroussel--dragging');
		if (!locked) {
			return;
		}
		const velocity = resolveVelocity();
		if (Math.abs(velocity) < 0.02) {
			snapToNearest();
			return;
		}
		driftAndSnap(velocity);
	};

	viewport.addEventListener('pointerdown', onPointerDown);
	viewport.addEventListener('pointermove', onPointerMove);
	viewport.addEventListener('pointerup', endPointer);
	viewport.addEventListener('pointercancel', endPointer);
	viewport.addEventListener('pointerleave', endPointer);

	viewport.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			moveBy(-1);
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			moveBy(1);
		}
	});

	recomputeLayout();
	window.addEventListener('resize', () => {
		cancelAnimation();
		recomputeLayout();
	});

	return true;
};

const resolveSlides = (track) => {
	return Array.from(track.querySelectorAll(SLIDE_SELECTOR)).filter((node) => node.closest(TRACK_SELECTOR) === track);
};

const displayStrategies = {
	[DISPLAY_REVOLVER]: (root, context) => initRevolverDisplay(root, context.viewport, context.track, context.originalSlides),
	[DISPLAY_CUT_ELEMENTS]: (root, context) => initCutElementsDisplay(root, context.viewport, context.track, context.originalSlides),
};

const initCaroussel = (root) => {
	if (attachedRoots.has(root) || root.dataset.carousselReady === 'true') {
		return;
	}
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}
	if (shouldWaitForPageTeaserRandomShuffle(root)) {
		return;
	}

	const viewport = root.querySelector(VIEWPORT_SELECTOR);
	const track = root.querySelector(TRACK_SELECTOR);
	if (!(viewport instanceof HTMLElement) || !(track instanceof HTMLElement)) {
		return;
	}

	const originalSlides = resolveSlides(track);
	if (originalSlides.length < 2) {
		return;
	}

	applyAutoTone(root);
	const displayContext = {
		viewport,
		track,
		originalSlides,
	};

	const requestedDisplay = root.dataset.carousselDisplay === DISPLAY_CUT_ELEMENTS
		? DISPLAY_CUT_ELEMENTS
		: DISPLAY_REVOLVER;

	let initialized = false;
	const preferredStrategy = displayStrategies[requestedDisplay];
	if (typeof preferredStrategy === 'function') {
		initialized = preferredStrategy(root, displayContext);
	}
	if (!initialized) {
		root.classList.remove('caroussel--display-revolver');
		root.classList.add('caroussel--display-cut-elements');
		const fallbackStrategy = displayStrategies[DISPLAY_CUT_ELEMENTS];
		if (typeof fallbackStrategy === 'function') {
			initialized = fallbackStrategy(root, displayContext);
		}
	}

	if (!initialized) {
		return;
	}

	attachedRoots.add(root);
	root.dataset.carousselReady = 'true';
};

const run = () => {
	document.querySelectorAll(MODULE_SELECTOR).forEach((root) => initCaroussel(root));
};

document.addEventListener(PAGE_TEASER_READY_EVENT, run);

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
