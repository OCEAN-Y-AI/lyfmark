const MODULE_SELECTOR = '[data-splash-screen]';
const ACTIVE_CLASS = 'splash-screen--active';
const EXITING_CLASS = 'splash-screen--exiting';
const ACTIVE_BODY_CLASS = 'splash-screen-visible';
const CONTENT_ENTERING_BODY_CLASS = 'splash-screen-content-entering';
const STORAGE_KEY_PREFIX = 'splash-screen:';
const DEFAULT_REPEAT_MINUTES = 23 * 60;
const BODY_ENTER_DURATION_VAR = '--splash-screen-enter-duration';
const OVERLAY_EXIT_DURATION_VAR = '--splash-screen-overlay-exit-duration';

const attachedRoots = new WeakSet();
let bodyEnterTimerId = 0;

const parseDuration = (value, fallback) => {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return fallback;
	}
	return parsed;
};

const allowsTimerDismiss = (mode) => mode === 'timer' || mode === 'timer-or-click';
const allowsClickDismiss = (mode) => mode === 'click' || mode === 'timer-or-click';

const parseRepeatMinutes = (value) => {
	if (value === undefined) {
		return null;
	}
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_REPEAT_MINUTES;
	}
	return parsed;
};

const repeatConfigSignature = (repeatMinutes) => {
	if (repeatMinutes === null) {
		return 'once';
	}
	return `minutes:${repeatMinutes}`;
};

const resolveStorageKey = (root, index) => {
	const label = root.getAttribute('aria-label') ?? '';
	return `${STORAGE_KEY_PREFIX}${window.location.pathname}:${index}:${label}`;
};

const clearSplashState = (storageKey) => {
	try {
		window.localStorage.removeItem(storageKey);
	} catch (_) {
		// Ignore storage errors.
	}
};

const readSplashState = (storageKey) => {
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) {
			return null;
		}

		// Legacy format: plain timestamp.
		const legacyTimestamp = Number.parseInt(raw, 10);
		if (Number.isFinite(legacyTimestamp)) {
			return { shownAt: legacyTimestamp, signature: null };
		}

		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') {
			return null;
		}
		const shownAt = Number.parseInt(String(parsed.shownAt ?? ''), 10);
		if (!Number.isFinite(shownAt)) {
			return null;
		}
		const signature = typeof parsed.signature === 'string' ? parsed.signature : null;
		return { shownAt, signature };
	} catch (_) {
		return null;
	}
};

const writeSplashState = (storageKey, state) => {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(state));
	} catch (_) {
		// Ignore storage errors so splash logic still works without persistence.
	}
};

const shouldShowSplash = (lastShownAt, repeatMinutes) => {
	if (repeatMinutes === null) {
		return lastShownAt === null;
	}
	if (repeatMinutes <= 0) {
		return true;
	}
	if (lastShownAt === null) {
		return true;
	}
	const repeatWindowMs = repeatMinutes * 60 * 1000;
	return Date.now() - lastShownAt >= repeatWindowMs;
};

const clearBodyEnterTransition = () => {
	if (bodyEnterTimerId) {
		window.clearTimeout(bodyEnterTimerId);
		bodyEnterTimerId = 0;
	}
	document.body.classList.remove(CONTENT_ENTERING_BODY_CLASS);
	document.body.style.removeProperty(BODY_ENTER_DURATION_VAR);
};

const runBodyEnterTransition = (durationMs) => {
	if (durationMs <= 0) {
		clearBodyEnterTransition();
		return;
	}
	if (document.body.classList.contains(ACTIVE_BODY_CLASS)) {
		return;
	}
	clearBodyEnterTransition();
	document.body.style.setProperty(BODY_ENTER_DURATION_VAR, `${durationMs}ms`);
	document.body.classList.add(CONTENT_ENTERING_BODY_CLASS);
	bodyEnterTimerId = window.setTimeout(() => {
		document.body.classList.remove(CONTENT_ENTERING_BODY_CLASS);
		document.body.style.removeProperty(BODY_ENTER_DURATION_VAR);
		bodyEnterTimerId = 0;
	}, durationMs + 34);
};

const refreshBodyState = () => {
	const hasVisibleSplash = Array.from(document.querySelectorAll(MODULE_SELECTOR)).some(
		(root) => !root.hasAttribute('hidden'),
	);
	document.body.classList.toggle(ACTIVE_BODY_CLASS, hasVisibleSplash);
	if (hasVisibleSplash) {
		clearBodyEnterTransition();
	}
};

const runFadeOutExit = (root, durationMs, onComplete) => {
	const overlayDurationMs = Math.floor(durationMs / 2);
	const contentEnterDurationMs = Math.max(durationMs - overlayDurationMs, 0);
	root.style.setProperty(OVERLAY_EXIT_DURATION_VAR, `${overlayDurationMs}ms`);
	root.classList.add(EXITING_CLASS, 'splash-screen--exit-fade-out');
	const timeoutId = window.setTimeout(() => {
		onComplete(contentEnterDurationMs);
	}, overlayDurationMs + 34);
	return () => {
		window.clearTimeout(timeoutId);
		root.style.removeProperty(OVERLAY_EXIT_DURATION_VAR);
	};
};

const exitAnimationHandlers = {
	'fade-out': runFadeOutExit,
};

const resolveExitAnimation = (name) => {
	if (name in exitAnimationHandlers) {
		return exitAnimationHandlers[name];
	}
	return runFadeOutExit;
};

const isInteractiveTarget = (target) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return Boolean(target.closest('a, button, input, textarea, select, summary, [role="button"], [data-splash-interactive="true"]'));
};

const isDismissTrigger = (target) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return Boolean(target.closest('[data-splash-dismiss]'));
};

const initSplashScreen = (root, index) => {
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}
	if (attachedRoots.has(root) || root.dataset.splashReady === 'true') {
		return;
	}

	const dismissMode = root.dataset.splashDismissMode ?? 'timer-or-click';
	const displayDuration = parseDuration(root.dataset.splashDuration, 2600);
	const exitDuration = parseDuration(root.dataset.splashExitDuration, 520);
	const exitAnimationName = root.dataset.splashExitAnimation ?? 'fade-out';
	const repeatMinutes = parseRepeatMinutes(root.dataset.splashRepeatMinutes);
	const currentSignature = repeatConfigSignature(repeatMinutes);
	const storageKey = resolveStorageKey(root, index);
	let splashState = readSplashState(storageKey);
	if (splashState && splashState.signature !== currentSignature) {
		clearSplashState(storageKey);
		splashState = null;
	}
	const lastShownAt = splashState ? splashState.shownAt : null;
	const shouldDismissByTimer = allowsTimerDismiss(dismissMode);
	const shouldDismissByClick = allowsClickDismiss(dismissMode);
	const exitAnimation = resolveExitAnimation(exitAnimationName);

	if (!shouldShowSplash(lastShownAt, repeatMinutes)) {
		root.remove();
		refreshBodyState();
		return;
	}
	if (root.parentElement !== document.body) {
		document.body.append(root);
	}
	writeSplashState(storageKey, { shownAt: Date.now(), signature: currentSignature });
	clearBodyEnterTransition();

	let timerId = 0;
	let isClosing = false;
	let clearExitTimer = () => {};

	const cleanup = () => {
		if (timerId) {
			window.clearTimeout(timerId);
			timerId = 0;
		}
		clearExitTimer();
	};

	const finish = (contentEnterDurationMs = 0) => {
		cleanup();
		root.remove();
		refreshBodyState();
		runBodyEnterTransition(contentEnterDurationMs);
	};

	const close = () => {
		if (isClosing) {
			return;
		}
		isClosing = true;
		root.classList.remove(ACTIVE_CLASS);
		root.setAttribute('aria-hidden', 'true');
		clearExitTimer = exitAnimation(root, exitDuration, finish);
	};

	if (shouldDismissByClick) {
		root.addEventListener('click', (event) => {
			if (event.defaultPrevented) {
				return;
			}
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				close();
				return;
			}
			if (isDismissTrigger(target)) {
				event.preventDefault();
				close();
				return;
			}
			if (isInteractiveTarget(target)) {
				return;
			}
			close();
		});

		root.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') {
				return;
			}
			event.preventDefault();
			close();
		});
	}

	if (shouldDismissByTimer) {
		timerId = window.setTimeout(() => {
			close();
		}, displayDuration);
	}

	root.dataset.splashReady = 'true';
	root.hidden = false;
	root.setAttribute('aria-hidden', 'false');
	document.body.classList.add(ACTIVE_BODY_CLASS);
	attachedRoots.add(root);

	requestAnimationFrame(() => {
		root.classList.add(ACTIVE_CLASS);
	});
};

const run = () => {
	const modules = document.querySelectorAll(MODULE_SELECTOR);
	modules.forEach((module, index) => initSplashScreen(module, index));
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
