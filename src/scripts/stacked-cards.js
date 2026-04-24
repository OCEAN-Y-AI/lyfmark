const MODULE_SELECTOR = '[data-stacked-cards]';
const VIEWPORT_SELECTOR = '[data-stacked-cards-viewport]';
const ITEM_SELECTOR = '[data-stacked-cards-item]';
const CARD_SELECTOR = '.stacked-cards__card';
const CARD_BODY_SELECTOR = '.stacked-cards__card-body';
const ACTIVE_ITEM_CLASS = 'stacked-cards__item--active';
const HIDDEN_ITEM_CLASS = 'stacked-cards__item--hidden';
const LAST_LINK_BODY_CLASS = 'stacked-cards__card-body--last-link';
const CARD_HEIGHT_VAR = '--stacked-cards-card-fixed-height';
const AUTO_TONE_CLASS = 'stacked-cards--tone-auto';
const DARK_TONE_CLASS = 'stacked-cards--tone-dark';
const LIGHT_TONE_CLASS = 'stacked-cards--tone-light';

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
	root.setAttribute('data-stacked-cards-resolved-tone', tone);
};

const bodyHasTailLink = (body) => {
	if (!(body instanceof HTMLElement)) {
		return false;
	}
	const lastElement = body.lastElementChild;
	if (!(lastElement instanceof HTMLElement)) {
		return false;
	}
	return Boolean(lastElement.querySelector('a[href]'));
};

const applyTailLinkClass = (root) => {
	const bodies = Array.from(root.querySelectorAll(CARD_BODY_SELECTOR));
	bodies.forEach((body) => {
		body.classList.toggle(LAST_LINK_BODY_CLASS, bodyHasTailLink(body));
	});
};

const applyUniformCardHeight = (root, cards) => {
	if (!(root instanceof HTMLElement) || cards.length === 0) {
		return;
	}
	root.style.removeProperty(CARD_HEIGHT_VAR);
	let maxHeight = 0;
	cards.forEach((card) => {
		const measured = card instanceof HTMLElement ? card.offsetHeight : 0;
		if (measured > maxHeight) {
			maxHeight = measured;
		}
	});
	if (maxHeight > 0) {
		root.style.setProperty(CARD_HEIGHT_VAR, `${Math.ceil(maxHeight)}px`);
	}
};

const clampIndex = (value, size) => {
	if (size === 0) {
		return 0;
	}
	return ((value % size) + size) % size;
};

const setItemState = (item, offset) => {
	const isActive = offset === 0;
	const isVisible = offset <= 2;
	item.dataset.stackedCardsOffset = String(offset);
	item.classList.toggle(ACTIVE_ITEM_CLASS, isActive);
	item.classList.toggle(HIDDEN_ITEM_CLASS, !isVisible);
	item.setAttribute('aria-hidden', isActive ? 'false' : 'true');
	if (isActive) {
		item.removeAttribute('inert');
		return;
	}
	item.setAttribute('inert', '');
};

const initStackedCards = (root) => {
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}
	applyAutoTone(root);
	if (root.dataset.stackedCardsReady === 'true') {
		return;
	}
	const viewport = root.querySelector(VIEWPORT_SELECTOR);
	if (!(viewport instanceof HTMLElement)) {
		return;
	}
	const cards = Array.from(root.querySelectorAll(CARD_SELECTOR));
	const items = Array.from(root.querySelectorAll(ITEM_SELECTOR));
	if (items.length === 0 || cards.length === 0) {
		return;
	}

	root.dataset.stackedCardsReady = 'true';
	const size = items.length;
	let activeIndex = items.findIndex((item) => item.classList.contains(ACTIVE_ITEM_CLASS));
	if (activeIndex < 0) {
		activeIndex = 0;
	}

	const applyState = () => {
		items.forEach((item, index) => {
			const offset = clampIndex(index - activeIndex, size);
			setItemState(item, offset);
		});
	};

	applyTailLinkClass(root);
	let measureFrame = 0;
	const scheduleCardMeasure = () => {
		if (measureFrame) {
			cancelAnimationFrame(measureFrame);
		}
		measureFrame = requestAnimationFrame(() => {
			measureFrame = 0;
			applyUniformCardHeight(root, cards);
		});
	};

	const moveBy = (delta) => {
		if (size <= 1) {
			return;
		}
		activeIndex = clampIndex(activeIndex + delta, size);
		applyState();
	};

	const controlSelector = viewport.id ? `[aria-controls="${viewport.id}"]` : '';
	const prevButtons = Array.from(root.querySelectorAll(`[data-stacked-cards-prev]${controlSelector}`));
	const nextButtons = Array.from(root.querySelectorAll(`[data-stacked-cards-next]${controlSelector}`));
	prevButtons.forEach((button) => button.addEventListener('click', () => moveBy(-1)));
	nextButtons.forEach((button) => button.addEventListener('click', () => moveBy(1)));

	viewport.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			moveBy(-1);
		}
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			moveBy(1);
		}
		if (event.key === 'Home') {
			event.preventDefault();
			activeIndex = 0;
			applyState();
		}
		if (event.key === 'End') {
			event.preventDefault();
			activeIndex = Math.max(size - 1, 0);
			applyState();
		}
	});

	window.addEventListener('resize', scheduleCardMeasure);
	if (document.fonts?.ready) {
		document.fonts.ready.then(scheduleCardMeasure).catch(() => {});
	}

	applyState();
	scheduleCardMeasure();
};

const run = () => {
	const modules = document.querySelectorAll(MODULE_SELECTOR);
	modules.forEach((module) => initStackedCards(module));
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
