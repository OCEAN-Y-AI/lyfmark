const MODULE_SELECTOR = '[data-accordion-module]';
const INTERACTIVE_CLASS = 'accordion-module--interactive';
const ACTIVE_TRIGGER_CLASS = 'accordion-module__trigger--active';

const setExpanded = (trigger, panel, isExpanded) => {
	trigger.classList.toggle(ACTIVE_TRIGGER_CLASS, isExpanded);
	trigger.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
	panel.toggleAttribute('hidden', !isExpanded);
};

const resolvePanel = (root, trigger) => {
	const panelId = trigger.getAttribute('aria-controls');
	if (!panelId) {
		return null;
	}
	const panel = document.getElementById(panelId);
	if (!panel || !root.contains(panel)) {
		return null;
	}
	return panel;
};

const initAccordionModule = (root) => {
	if (root.closest('[data-module-clone="true"]')) {
		return;
	}
	if (root.dataset.accordionReady === 'true') {
		return;
	}
	const triggers = Array.from(root.querySelectorAll('[data-accordion-trigger]'));
	if (triggers.length === 0) {
		return;
	}
	const pairs = triggers
		.map((trigger) => {
			const panel = resolvePanel(root, trigger);
			if (!panel) {
				return null;
			}
			return { trigger, panel };
		})
		.filter(Boolean);
	if (pairs.length === 0) {
		return;
	}
	root.dataset.accordionReady = 'true';
	root.classList.add(INTERACTIVE_CLASS);

	pairs.forEach((pair) => {
		setExpanded(pair.trigger, pair.panel, false);
		pair.trigger.addEventListener('click', (event) => {
			event.preventDefault();
			const isExpanded = pair.trigger.getAttribute('aria-expanded') === 'true';
			setExpanded(pair.trigger, pair.panel, !isExpanded);
		});
	});
};

const run = () => {
	const modules = document.querySelectorAll(MODULE_SELECTOR);
	modules.forEach((module) => initAccordionModule(module));
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
	run();
}
