import type { DirectiveModule } from "../../remark/types"
import { accentRuleModule } from "../modules/accent-rule/module"
import { accordionModule } from "../modules/accordion/module"
import { alignModule } from "../modules/align/module"
import { anchorModule } from "../modules/anchor/module"
import { backgroundColorModule } from "../modules/background-color/module"
import { backgroundImageModule } from "../modules/background-image/module"
import { backgroundWaveModule } from "../modules/background-wave/module"
import { carousselModule } from "../modules/caroussel/module"
import { contactFormModule } from "../modules/contact-form/module"
import { contentBlockModule } from "../modules/content-block/module"
import { formModule } from "../modules/form/module"
import { highlightCardModule } from "../modules/highlight-card/module"
import { linkModule } from "../modules/link/module"
import { listModule } from "../modules/list/module"
import { pageTeaserModule } from "../modules/page-teaser/module"
import { pictureAndTextModule } from "../modules/picture-and-text/module"
import { quickNavModule } from "../modules/quick-nav/module"
import { rightModule } from "../modules/right/module"
import { spaceModule } from "../modules/space/module"
import { splashScreenModule } from "../modules/splash-screen/module"
import { splitModule } from "../modules/split/module"
import { stackedCardsModule } from "../modules/stacked-cards/module"
import { tabsModule } from "../modules/tabs/module"
import { textOverPictureModule } from "../modules/text-over-picture/module"
import { thumbScrollModule } from "../modules/thumb-scroll/module"
import { typoModule } from "../modules/typo/module"

/**
 * Canonical list of built-in directive modules in deterministic registration order.
 */
export const builtInDirectiveModules: readonly DirectiveModule[] = [
	highlightCardModule,
	pictureAndTextModule,
	textOverPictureModule,
	linkModule,
	contentBlockModule,
	splitModule,
	rightModule,
	spaceModule,
	backgroundColorModule,
	backgroundImageModule,
	backgroundWaveModule,
	contactFormModule,
	thumbScrollModule,
	tabsModule,
	carousselModule,
	accordionModule,
	pageTeaserModule,
	splashScreenModule,
	typoModule,
	accentRuleModule,
	quickNavModule,
	alignModule,
	anchorModule,
	listModule,
	formModule,
	stackedCardsModule,
]
