export class ShortcutManager {
  dispose(): void {
    // Phase C target:
    // - register/unregister global shortcuts per active macro
    // - reject collisions by policy (do not auto-take over)
    // - cleanup all registrations on app shutdown
  }
}
