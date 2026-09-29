import { browserPlatform } from './browser'
import { tauriPlatform } from './tauri'
import type { Platform } from './types'

export const platform: Platform = '__TAURI_INTERNALS__' in window ? tauriPlatform : browserPlatform
