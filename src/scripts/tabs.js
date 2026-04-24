const MODULE_SELECTOR = '[data-tabs-module]';
const ACTIVE_TAB_CLASS = 'tabs-module__tab--active';
const INACTIVE_TAB_OUTLINE_CLASS = 'ui-button--outline';
const ACTIVE_PANEL_CLASS = 'tabs-module__panel--active';
const INTERACTIVE_CLASS = 'tabs-module--interactive';

const clampIndex = (value, size) => {
	if (size === 0) {
		return 0;
	}
	return ((value % size) + size) % size;
};

const setPanelState = (panels, activeIndex) => {
	panels.forEach((panel, index) => {
		const isActive = index === activeIndex;
		panel.classList.toggle(ACTIVE_PANEL_CLASS, isActive);
		panel.toggleAttribute('hidden', !isActive);
	});
};

const setTabState = (tabs, activeIndex) => {
	tabs.forEach((tab, index) => {
		const isActive = index === activeIndex;
		tab.classList.toggle(ACTIVE_TAB_CLASS, isActive);
		tab.classList.toggle(INACTIVE_TAB_OUTLINE_CLASS, !isActive);
		tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
		tab.setAttribute('tabindex', isActive ? '0' : '-1');
	});
};

const setupKeyboardNavigation = (tabs, activate) => {
	const focusTab = (index) => {
		const target = tabs[index];
		if (target) {
			target.focus();
		}
	};

	tabs.forEach((tab, index) => {
		tab.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				event.preventDefault();
				const nextIndex = clampIndex(index - 1, tabs.length);
				activate(nextIndex);
				focusTab(nextIndex);
			}
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				event.preventDefault();
				const nextIndex = clampIndex(index + 1, tabs.length);
				activate(nextIndex);
				focusTab(nextIndex);
			}
			if (event.key === 'Home') {
				event.preventDefault();
				activate(0);
				focusTab(0);
			}
			if (event.key === 'End') {
				event.preventDefault();
				const lastIndex = tabs.length - 1;
				activate(lastIndex);
				focusTab(lastIndex);
			}
		});
	});
};

const initTabsModule = (root) => {
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}
	if (root.dataset.tabsReady === 'true') {
		return;
	}
	const tabs = Array.from(root.querySelectorAll('[data-tabs-trigger]'));
	const panels = Array.from(root.querySelectorAll('[data-tabs-panel]'));
	if (tabs.length === 0 || panels.length === 0 || tabs.length !== panels.length) {
		return;
	}
	root.dataset.tabsReady = 'true';
	root.classList.add(INTERACTIVE_CLASS);
	let activeIndex = tabs.findIndex((tab) => tab.classList.contains(ACTIVE_TAB_CLASS));
	if (activeIndex < 0) {
		activeIndex = 0;
	}
	const activate = (index) => {
		if (tabs.length === 0) {
			return;
		}
		const safeIndex = clampIndex(index, tabs.length);
		activeIndex = safeIndex;
		setTabState(tabs, safeIndex);
		setPanelState(panels, safeIndex);
	};

	tabs.forEach((tab, index) => {
		tab.addEventListener('click', (event) => {
			event.preventDefault();
			activate(index);
		});
	});

	setupKeyboardNavigation(tabs, activate);
	activate(activeIndex);
};

const run = () => {
	const modules = document.querySelectorAll(MODULE_SELECTOR);
	modules.forEach((module) => initTabsModule(module));
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
