const DESKTOP_QUERY = "(min-width: 73.8125rem)";
const MOBILE_VIEW_MAIN = "main";
const MOBILE_VIEW_SUBMENU = "submenu";
const MOBILE_VIEW_SECTION = "section";

const setupManualMenu = (menu) => {
	if (!(menu instanceof HTMLElement)) {
		return;
	}

	const toggle = menu.querySelector("[data-manual-menu-toggle]");
	const panel = menu.querySelector("[data-manual-menu-panel]");
	if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
		return;
	}

	const desktopQuery = window.matchMedia(DESKTOP_QUERY);
	const detailsItems = Array.from(menu.querySelectorAll("[data-manual-menu-details]")).filter((node) => node instanceof HTMLDetailsElement);
	const menuItems = Array.from(menu.querySelectorAll(".manual-menu__top-item[data-manual-menu-item-id]")).filter((node) => node instanceof HTMLElement);
	const setMobileView = (view) => {
		menu.setAttribute("data-mobile-view", view);
	};
	const setActiveTopItem = (itemId) => {
		for (const item of menuItems) {
			const isActive = itemId !== null && item.getAttribute("data-manual-menu-item-id") === itemId;
			item.setAttribute("data-manual-menu-item-active", isActive ? "true" : "false");
		}
	};
	const getActiveMobileTopItem = () => {
		return menuItems.find((item) => item.getAttribute("data-manual-menu-item-active") === "true") ?? null;
	};
	const findTopItem = (node) => {
		if (!(node instanceof Element)) {
			return null;
		}
		const topItem = node.closest(".manual-menu__top-item[data-manual-menu-item-id]");
		return topItem instanceof HTMLElement ? topItem : null;
	};
	const getMobileSections = (topItem) => {
		if (!(topItem instanceof HTMLElement)) {
			return [];
		}
		return Array.from(topItem.querySelectorAll(".manual-menu__panel-content > [data-manual-menu-section-id]")).filter(
			(node) => node instanceof HTMLElement,
		);
	};
	const resetMobileSectionState = (topItem) => {
		if (!(topItem instanceof HTMLElement)) {
			return;
		}
		topItem.removeAttribute("data-manual-menu-section-active");
		for (const section of getMobileSections(topItem)) {
			section.classList.remove("manual-menu__section--mobile-active");
			section.classList.remove("manual-menu__section--mobile-hidden");
		}
	};
	const resetAllMobileSectionStates = () => {
		for (const item of menuItems) {
			resetMobileSectionState(item);
		}
	};
	const openMobileSectionView = (topItem, sectionId) => {
		if (!(topItem instanceof HTMLElement) || typeof sectionId !== "string" || sectionId.length === 0) {
			return;
		}
		const sections = getMobileSections(topItem);
		if (sections.length === 0) {
			return;
		}

		const topItemId = topItem.getAttribute("data-manual-menu-item-id");
		if (!topItemId) {
			return;
		}

		for (const item of menuItems) {
			if (item === topItem) {
				continue;
			}
			resetMobileSectionState(item);
		}
		setActiveTopItem(topItemId);

		topItem.setAttribute("data-manual-menu-section-active", sectionId);
		for (const section of sections) {
			const isActive = section.getAttribute("data-manual-menu-section-id") === sectionId;
			section.classList.toggle("manual-menu__section--mobile-active", isActive);
			section.classList.toggle("manual-menu__section--mobile-hidden", !isActive);
		}

		setMobileView(MOBILE_VIEW_SECTION);
	};
	const closeMobileSectionView = (topItem) => {
		if (!(topItem instanceof HTMLElement)) {
			resetAllMobileSectionStates();
			setActiveTopItem(null);
			setMobileView(MOBILE_VIEW_MAIN);
			return;
		}
		const topItemId = topItem.getAttribute("data-manual-menu-item-id");
		resetMobileSectionState(topItem);
		if (topItemId) {
			setActiveTopItem(topItemId);
			setMobileView(MOBILE_VIEW_SUBMENU);
			return;
		}
		setMobileView(MOBILE_VIEW_MAIN);
	};

	const setMobileMainView = () => {
		resetAllMobileSectionStates();
		setActiveTopItem(null);
		setMobileView(MOBILE_VIEW_MAIN);
	};

	const setMobileSubmenuView = (itemId) => {
		resetAllMobileSectionStates();
		setActiveTopItem(itemId);
		setMobileView(MOBILE_VIEW_SUBMENU);
	};

	const closeOtherDetails = (activeDetails) => {
		for (const details of detailsItems) {
			if (details === activeDetails) {
				continue;
			}
			details.open = false;
		}
	};

	const closeAllDetails = () => {
		for (const details of detailsItems) {
			details.open = false;
		}
	};

	const closeMenu = () => {
		menu.setAttribute("data-open", "false");
		toggle.setAttribute("aria-expanded", "false");
		closeAllDetails();
		setMobileMainView();
	};

	const openMenu = () => {
		menu.setAttribute("data-open", "true");
		toggle.setAttribute("aria-expanded", "true");
		if (!desktopQuery.matches) {
			setMobileMainView();
		}
	};

	const openMobileSubmenu = (details) => {
		closeOtherDetails(details);
		details.open = true;
		const itemId = details.getAttribute("data-manual-menu-item-id");
		if (itemId) {
			setMobileSubmenuView(itemId);
		}
	};

	const backToMainMenu = () => {
		closeAllDetails();
		setMobileMainView();
	};

	const toggleMenu = () => {
		if (menu.getAttribute("data-open") === "true") {
			closeMenu();
			return;
		}
		openMenu();
	};

	toggle.addEventListener("click", () => {
		toggleMenu();
	});

	for (const details of detailsItems) {
		const summary = details.querySelector("[data-manual-menu-summary]");
		if (summary instanceof HTMLElement) {
			summary.addEventListener("click", (event) => {
				if (!desktopQuery.matches) {
					event.preventDefault();
					openMobileSubmenu(details);
				}
			});
		}

		details.addEventListener("toggle", () => {
			if (!details.open) {
				return;
			}
			closeOtherDetails(details);
			if (!desktopQuery.matches) {
				const itemId = details.getAttribute("data-manual-menu-item-id");
				if (itemId) {
					setMobileSubmenuView(itemId);
				}
			}
		});
	}

	menu.addEventListener("keydown", (event) => {
		if (!(event instanceof KeyboardEvent)) {
			return;
		}
		if (event.key !== "Escape") {
			return;
		}
		if (!desktopQuery.matches && menu.getAttribute("data-mobile-view") === MOBILE_VIEW_SECTION) {
			const activeTopItem = getActiveMobileTopItem();
			event.preventDefault();
			closeMobileSectionView(activeTopItem);
			return;
		}
		if (!desktopQuery.matches && menu.getAttribute("data-mobile-view") === MOBILE_VIEW_SUBMENU) {
			event.preventDefault();
			backToMainMenu();
			return;
		}
		closeMenu();
		toggle.focus();
	});

	document.addEventListener("click", (event) => {
		if (!(event.target instanceof Node)) {
			return;
		}
		if (menu.contains(event.target)) {
			return;
		}
		closeMenu();
	});

	panel.addEventListener("click", (event) => {
		if (!(event.target instanceof HTMLElement)) {
			return;
		}
		const sectionOpenButton = event.target.closest("[data-manual-menu-section-open]");
		if (sectionOpenButton && !desktopQuery.matches) {
			event.preventDefault();
			const topItem = findTopItem(sectionOpenButton);
			const sectionId = sectionOpenButton.getAttribute("data-manual-menu-section-id");
			openMobileSectionView(topItem, sectionId);
			return;
		}
		const sectionBackButton = event.target.closest("[data-manual-menu-section-back]");
		if (sectionBackButton && !desktopQuery.matches) {
			event.preventDefault();
			const topItem = findTopItem(sectionBackButton);
			closeMobileSectionView(topItem);
			return;
		}
		const backButton = event.target.closest("[data-manual-menu-back]");
		if (backButton && !desktopQuery.matches) {
			event.preventDefault();
			backToMainMenu();
			return;
		}
		const linkTarget = event.target.closest("a");
		if (!linkTarget) {
			return;
		}
		if (desktopQuery.matches) {
			return;
		}
		closeMenu();
	});

	const onDesktopChange = (event) => {
		closeAllDetails();
		setMobileMainView();
		if (event.matches) {
			menu.setAttribute("data-open", "false");
			toggle.setAttribute("aria-expanded", "false");
		}
	};

	if (typeof desktopQuery.addEventListener === "function") {
		desktopQuery.addEventListener("change", onDesktopChange);
	} else if (typeof desktopQuery.addListener === "function") {
		desktopQuery.addListener(onDesktopChange);
	}

	setMobileMainView();
};

document.querySelectorAll("[data-manual-menu]").forEach((menu) => {
	setupManualMenu(menu);
});
