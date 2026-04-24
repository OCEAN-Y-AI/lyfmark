const MODULE_SELECTOR = '[data-page-teaser]';
const GRID_SELECTOR = '[data-page-teaser-grid]';
const ITEM_SELECTOR = '[data-page-teaser-item]';
const CARD_SELECTOR = ':scope > .page-teaser__card';
const CARD_BODY_SELECTOR = ':scope > .page-teaser__card-body';
const CARD_MEDIA_SELECTOR = ':scope > .page-teaser__card-media';
const FEATURED_CLASS = 'page-teaser__item--featured';
const CARD_WITH_MEDIA_CLASS = 'page-teaser__card--with-media';
const CARD_AUTHOR_CLASS = 'page-teaser__card--author';
const CARD_MEDIA_AUTHOR_CLASS = 'page-teaser__card-media--author';
const FIXED_POSITION_CLASS_PREFIX = 'page-teaser__item--fixed-pos-';
const STACKED_DISPLAY = 'stacked-cards';
const REVOLVER_DISPLAY = 'revolver-caroussel';
const PAGE_TEASER_READY_EVENT = 'page-teaser:ready';
const STACKED_ACTIVE_CLASS = 'stacked-cards__item--active';
const STACKED_HIDDEN_CLASS = 'stacked-cards__item--hidden';
const REVOLVER_TEXT_BLOCK_SELECTOR = '.page-teaser__revolver-card-main';

const attachedRoots = new WeakSet();

const shuffle = (items) => {
	const result = [...items];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}
	return result;
};

const fixedPosition = (item) => {
	const className = Array.from(item.classList).find((token) => token.startsWith(FIXED_POSITION_CLASS_PREFIX));
	if (!className) {
		return null;
	}
	const parsed = Number.parseInt(className.slice(FIXED_POSITION_CLASS_PREFIX.length), 10);
	if (!Number.isInteger(parsed) || parsed < 1) {
		return null;
	}
	return parsed;
};

const shuffleWithFixedPositions = (items) => {
	const positioned = new Array(items.length).fill(null);
	const movable = [];
	items.forEach((item) => {
		const fixed = fixedPosition(item);
		if (!fixed) {
			movable.push(item);
			return;
		}
		const targetIndex = fixed - 1;
		if (targetIndex < 0 || targetIndex >= items.length || positioned[targetIndex] !== null) {
			movable.push(item);
			return;
		}
		positioned[targetIndex] = item;
	});
	const shuffledMovable = shuffle(movable);
	let movableIndex = 0;
	for (let index = 0; index < positioned.length; index += 1) {
		if (positioned[index] !== null) {
			continue;
		}
		positioned[index] = shuffledMovable[movableIndex] ?? null;
		movableIndex += 1;
	}
	return positioned.filter((item) => item !== null);
};

const itemMediaMeta = (item) => {
	const card = item.querySelector(CARD_SELECTOR);
	const media = card instanceof HTMLElement ? card.querySelector(CARD_MEDIA_SELECTOR) : null;
	const image = media instanceof HTMLElement ? media.querySelector(':scope > img') : null;
	const fallbackSrc = image instanceof HTMLImageElement ? (image.getAttribute('src') ?? '') : '';
	const fallbackAlt = image instanceof HTMLImageElement ? (image.getAttribute('alt') ?? '') : '';
	const hasFeaturedClass = card instanceof HTMLElement && card.classList.contains(CARD_WITH_MEDIA_CLASS);
	const hasAuthorClass = card instanceof HTMLElement && card.classList.contains(CARD_AUTHOR_CLASS);
	return {
		thumbnailSrc: item.dataset.pageTeaserThumbnailSrc ?? (hasFeaturedClass ? fallbackSrc : ''),
		thumbnailAlt: item.dataset.pageTeaserThumbnailAlt ?? (hasFeaturedClass ? fallbackAlt : ''),
		authorSrc: item.dataset.pageTeaserAuthorSrc ?? (hasAuthorClass ? fallbackSrc : ''),
		authorAlt: item.dataset.pageTeaserAuthorAlt ?? (hasAuthorClass ? fallbackAlt : ''),
	};
};

const removeCardMedia = (card) => {
	const media = card.querySelector(CARD_MEDIA_SELECTOR);
	if (media instanceof HTMLElement) {
		media.remove();
	}
};

const ensureCardMedia = (card) => {
	let media = card.querySelector(CARD_MEDIA_SELECTOR);
	if (!(media instanceof HTMLElement)) {
		media = document.createElement('figure');
		const body = card.querySelector(CARD_BODY_SELECTOR);
		if (body instanceof HTMLElement) {
			card.insertBefore(media, body);
		} else {
			card.prepend(media);
		}
	}
	media.classList.add('page-teaser__card-media');

	let image = media.querySelector(':scope > img');
	if (!(image instanceof HTMLImageElement)) {
		image = document.createElement('img');
		image.loading = 'lazy';
		image.decoding = 'async';
		image.draggable = false;
		media.textContent = '';
		media.appendChild(image);
	}

	return { media, image };
};

const applyFeaturedCardState = (item) => {
	const card = item.querySelector(CARD_SELECTOR);
	if (!(card instanceof HTMLElement)) {
		return;
	}
	const mediaMeta = itemMediaMeta(item);
	const featuredSource = mediaMeta.thumbnailSrc || mediaMeta.authorSrc;
	const featuredAlt = mediaMeta.thumbnailSrc
		? (mediaMeta.thumbnailAlt || '')
		: (mediaMeta.authorAlt || '');

	card.classList.remove(CARD_AUTHOR_CLASS);
	if (!featuredSource) {
		card.classList.remove(CARD_WITH_MEDIA_CLASS);
		removeCardMedia(card);
		return;
	}

	card.classList.add(CARD_WITH_MEDIA_CLASS);
	const { media, image } = ensureCardMedia(card);
	media.classList.remove(CARD_MEDIA_AUTHOR_CLASS);
	image.src = featuredSource;
	image.alt = featuredAlt;
};

const applyNonFeaturedCardState = (item) => {
	const card = item.querySelector(CARD_SELECTOR);
	if (!(card instanceof HTMLElement)) {
		return;
	}
	const mediaMeta = itemMediaMeta(item);
	card.classList.remove(CARD_WITH_MEDIA_CLASS);

	if (!mediaMeta.authorSrc) {
		card.classList.remove(CARD_AUTHOR_CLASS);
		removeCardMedia(card);
		return;
	}

	card.classList.add(CARD_AUTHOR_CLASS);
	const { media, image } = ensureCardMedia(card);
	media.classList.add(CARD_MEDIA_AUTHOR_CLASS);
	image.src = mediaMeta.authorSrc;
	image.alt = mediaMeta.authorAlt || '';
};

const updateFeaturedState = (root, items) => {
	if (root.dataset.pageTeaserDisplay !== 'cards') {
		return;
	}
	items.forEach((item, index) => {
		item.classList.toggle(FEATURED_CLASS, index === 0);
		if (index === 0) {
			applyFeaturedCardState(item);
			return;
		}
		applyNonFeaturedCardState(item);
	});
};

const updateStackedState = (root, items) => {
	if (root.dataset.pageTeaserDisplay !== STACKED_DISPLAY) {
		return;
	}
	items.forEach((item, index) => {
		const isActive = index === 0;
		const isVisible = index <= 2;
		item.classList.toggle(STACKED_ACTIVE_CLASS, isActive);
		item.classList.toggle(STACKED_HIDDEN_CLASS, !isVisible);
		item.dataset.stackedCardsOffset = String(index);
		item.setAttribute('aria-hidden', isActive ? 'false' : 'true');
		if (isActive) {
			item.removeAttribute('inert');
			return;
		}
		item.setAttribute('inert', '');
	});
};

const updateRevolverContentHeight = (root) => {
	if (root.dataset.pageTeaserDisplay !== REVOLVER_DISPLAY) {
		return;
	}
	root.style.removeProperty('--page-teaser-revolver-content-height');
	let maxHeight = 0;
	root.querySelectorAll(REVOLVER_TEXT_BLOCK_SELECTOR).forEach((block) => {
		if (block instanceof HTMLElement) {
			maxHeight = Math.max(maxHeight, block.offsetHeight);
		}
	});
	if (maxHeight > 0) {
		root.style.setProperty('--page-teaser-revolver-content-height', `${Math.ceil(maxHeight)}px`);
	}
};

const initTeaser = (root) => {
	if (attachedRoots.has(root) || root.dataset.pageTeaserReady === 'true') {
		return;
	}
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}

	const grid = root.querySelector(GRID_SELECTOR);
	if (!(grid instanceof HTMLElement)) {
		return;
	}

	const items = Array.from(grid.querySelectorAll(':scope > *')).filter((item) => item.matches(ITEM_SELECTOR));
	if (items.length === 0) {
		return;
	}

	if (root.dataset.pageTeaserOrder === 'random' && items.length > 1) {
		const shuffledItems = shuffleWithFixedPositions(items);
		shuffledItems.forEach((item) => {
			grid.appendChild(item);
		});
		updateFeaturedState(root, shuffledItems);
		updateStackedState(root, shuffledItems);
	} else {
		updateFeaturedState(root, items);
		updateStackedState(root, items);
	}
	updateRevolverContentHeight(root);
	window.addEventListener('resize', () => updateRevolverContentHeight(root));
	if (document.fonts?.ready) {
		document.fonts.ready.then(() => updateRevolverContentHeight(root)).catch(() => {});
	}

	attachedRoots.add(root);
	root.dataset.pageTeaserReady = 'true';
	if (root.dataset.pageTeaserDisplay === REVOLVER_DISPLAY && root.dataset.pageTeaserOrder === 'random') {
		document.dispatchEvent(new Event(PAGE_TEASER_READY_EVENT));
	}
};

const run = () => {
	const modules = document.querySelectorAll(MODULE_SELECTOR);
	modules.forEach((root) => initTeaser(root));
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
