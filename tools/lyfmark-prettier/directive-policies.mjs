import {
  BUILTIN_DIRECTIVE_POLICIES,
  EMPTY_DIRECTIVE_POLICY,
} from "./constants.mjs";
import { getContentBlockDefinitions } from "./content-blocks.mjs";

/**
 * Builds a per-run directive policy resolver used by formatter passes.
 * Contract:
 * - Policy behavior is internal and code-owned.
 * - Content block shortcuts are self-closing unless their frontmatter declares `children`.
 *
 * @param {{filepath?: string}} options
 */
export const createDirectivePolicyResolver = (options = {}) => {
  const contentBlockDefinitions = getContentBlockDefinitions(options?.filepath);
  const policyCache = new Map();

  /**
   * Resolves effective policy for one directive name.
   *
   * @param {string} directiveName
   * @returns {{selfClosing: boolean, groupWithNextSameDirective: boolean, keepCloseOpenCompactWithSameDirective: boolean, swallowImmediateClose: boolean}}
   */
  const resolvePolicy = (directiveName) => {
    if (
      typeof directiveName !== "string" ||
      directiveName.trim().length === 0
    ) {
      return EMPTY_DIRECTIVE_POLICY;
    }
    const normalizedName = directiveName.trim().toLowerCase();
    const cached = policyCache.get(normalizedName);
    if (cached) {
      return cached;
    }

    const builtinPolicy =
      BUILTIN_DIRECTIVE_POLICIES[normalizedName] ?? EMPTY_DIRECTIVE_POLICY;
    let resolvedPolicy = builtinPolicy;
    const contentBlockDefinition = contentBlockDefinitions.get(normalizedName);
    if (contentBlockDefinition) {
      resolvedPolicy = Object.freeze({
        ...resolvedPolicy,
        selfClosing: !contentBlockDefinition.hasChildren,
      });
    }

    policyCache.set(normalizedName, resolvedPolicy);
    return resolvedPolicy;
  };

  return {
    resolvePolicy,
    isSelfClosingDirective: (directiveName) =>
      resolvePolicy(directiveName).selfClosing,
    shouldGroupWithNextSameDirective: (directiveName) =>
      resolvePolicy(directiveName).groupWithNextSameDirective,
    shouldKeepCloseOpenCompactWithSameDirective: (directiveName) =>
      resolvePolicy(directiveName).keepCloseOpenCompactWithSameDirective,
    shouldSwallowImmediateClose: (directiveName) =>
      resolvePolicy(directiveName).swallowImmediateClose,
  };
};
