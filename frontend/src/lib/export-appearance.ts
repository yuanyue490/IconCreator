export const EXPORT_SIZE_PRESETS = [16, 20, 24, 32, 40, 48, 64] as const;

export function isPresetSize(n: number): n is (typeof EXPORT_SIZE_PRESETS)[number] {
  return (EXPORT_SIZE_PRESETS as readonly number[]).includes(n);
}
