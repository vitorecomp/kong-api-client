import type { PluginConfigs, PluginName, PluginScopeName } from '../../src/generated/plugins.js';
import type { LiveTarget } from './live.js';
import {
  PLUGIN_EXAMPLES,
  type PluginExample,
  type PluginExampleOverride,
  type PluginExamplesMap,
  type PluginExampleUpdate,
} from './plugin-examples.js';

/** Small config update specification for a plugin fixture. */
export type PluginFixtureUpdate<N extends PluginName> = PluginExampleUpdate<N>;

/** Target-specific overrides for a plugin fixture when Kong 3.9 and 3.14 differ. */
export type PluginFixtureOverride<N extends PluginName> = PluginExampleOverride<N>;

/** Validated fixture describing a minimal working configuration for plugin `N`. */
export type PluginFixture<N extends PluginName> = PluginExample<N>;

/** Exhaustive map of fixtures keyed by every first-class `PluginName`. */
export type PluginFixturesMap = PluginExamplesMap;

/** Resolved fixture for a specific live target. */
export interface ResolvedPluginFixture<N extends PluginName> {
  config: PluginConfigs[N];
  scope: PluginScopeName;
  update: PluginFixtureUpdate<N>;
}

/** Minimal valid configurations and update patches for all 45 first-class Kong plugins. */
export const PLUGIN_FIXTURES: PluginFixturesMap = PLUGIN_EXAMPLES;

/** Returns the resolved fixture for `name` on `target`, applying `only` overrides if present. */
export function resolvePluginFixture<N extends PluginName>(
  name: N,
  target: LiveTarget,
): ResolvedPluginFixture<N> {
  const base = PLUGIN_FIXTURES[name];
  const override = base.only?.[target];
  return {
    config: override?.config ?? base.config,
    scope: base.scope,
    update: override?.update ?? base.update,
  };
}
