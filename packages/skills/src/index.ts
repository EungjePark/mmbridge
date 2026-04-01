export type {
  SkillManifest,
  SkillToolDef,
  SkillHookDef,
  SkillCommandDef,
  LoadedSkill,
} from './types.js';

export { SkillLoader } from './loader.js';

export { HookRegistry } from './hook-registry.js';
export type { HookEvent } from './hook-registry.js';

export { scaffoldSkill } from './scaffold.js';
