# Dokumentacja API Projektu Keybrix

Architektura aplikacji Keybrix oparta jest na frameworku Electron z odizolowanym procesem Main (Backend) oraz Renderer (Frontend - UI).
API opisane w tym dokumencie to przede wszystkim **Inter-Process Communication (IPC)**, udostępniane dla UI (React) poprzez tzw. `Context Bridge` w pliku `preload`, oraz podstawowe modele danych.

---

## 1. Domain Models (Typy Danych)

Główne modele współdzielone między procesami.

```typescript
// Status makra wyświetlany na żywo w Dashboardzie
export type MacroStatus = 'RUNNING' | 'IDLE' | 'ACTIVE' | 'PAUSED'

// Poziom logowania dla konsoli "Recent Activity Logs"
export type LogLevel = 'RUN' | 'TRIG' | 'INFO' | 'WARN' | 'ERR'

export interface Macro {
  id: string // UUID makra
  name: string // Nazwa nadana przez użytkownika
  description?: string // Opcjonalny opis
  shortcut: string // Przypisany skrót klawiszowy np. "CTRL+SHIFT+C", pusty jeśli tylko ręczne
  isActive: boolean // Czy na ten moment działa nasłuchiwanie w tle (Toggle switch)
  status: MacroStatus // 'ACTIVE' jeśli gotowe do startu, 'RUNNING' jeśli obecnie coś klika
  blocksJson: Record<string, any> // Zserializowany workspace Blockly do JSONa
}

export interface ActivityLog {
  id: string
  timestamp: string // Oczekiwany format "[HH:MM:SS]"
  level: LogLevel
  message: string
}

export interface DashboardStats {
  totalAutomations: number
  timeSavedMinutes: number // np. 720 (po przeliczeniu 12h)
  successRate: number // np. 99.8 (%)
  activeNow: number // Ilość makr ze statusem 'RUNNING' lub 'ACTIVE'
}
```

---

## 2. API Mostu Preload (`window.api`)

Frontend (React) **nigdy** nie wywołuje modułów systemowych bezpośrednio. Oczekuje obiektu `window.api` naszpikowanego funkcjami, które komunikują się z Backendem poprzez kanały IPC.

### 2.1 Namespace: `window.api.macros`

Interfejs odpowiedzialny za zarządzanie skryptami makr (CRUD i wykonywanie).

- `getAll(): Promise<Macro[]>`
  - **Opis**: Pobiera wszystkie dostępne makra z bazy lokalnej (`electron-store`).
  - **IPC Channel**: `invoke('macros:get-all')`
- `getById(id: string): Promise<Macro | null>`
  - **Opis**: Pobiera konkretne makro (przydatne do wczytania w widoku edytora).
  - **IPC Channel**: `invoke('macros:get-by-id', id)`
- `save(macro: Partial<Macro>): Promise<Macro>`
  - **Opis**: Tworzy nowe makro (jeśli brak id) lub nadpisuje obecne. W tle main process musi przerejestrować globalny skrót (`globalShortcut`).
  - **IPC Channel**: `invoke('macros:save', macro)`
- `delete(id: string): Promise<boolean>`
  - **Opis**: Kasuje wskazane makro i jego skrót klawiszowy i plik.
  - **IPC Channel**: `invoke('macros:delete', id)`
- `toggle(id: string, isActive: boolean): Promise<boolean>`
  - **Opis**: Zmienia stan włącznika danego makra w dashboardzie (wyrejestrowanie/rejestracja nasłuchu `globalShortcut`).
  - **IPC Channel**: `invoke('macros:toggle', { id, isActive })`
- `runManually(id: string): Promise<void>`
  - **Opis**: Wymusza odpalenie makra z poziomu UI (przycisk Play na karcie), tak samo jakby uaktywnił go skrót.
  - **IPC Channel**: `invoke('macros:run', id)`

### 2.2 Namespace: `window.api.stats`

Informacje zbiorcze podsumowujące pracę dashboardu.

- `getDashboardStats(): Promise<DashboardStats>`
  - **Opis**: Oblicza podstawowe liczniki pracy do headera.
  - **IPC Channel**: `invoke('stats:get')`

### 2.3 Namespace: `window.api.logs`

Obsługa konsoli logów tekstowych widocznej na dole dashboardu.

- `getRecent(): Promise<ActivityLog[]>`
  - **Opis**: Pobiera wstecznie np. 50-100 ostatnich logów ze zbuforowanej listy na backendzie przy starcie apki.
  - **IPC Channel**: `invoke('logs:get-recent')`
- `onNewLog(callback: (log: ActivityLog) => void): () => void`
  - **Opis**: Subskrypcja nasłuchująca na wypychane w czasie rzeczywistym logi (Push z Backend -> Frontend). W odpowiedzi zwracana jest funkcja do usuwania "listenera" (`ipcRenderer.removeListener`).
  - **IPC Channel**: `on('logs:new-log')`

### 2.4 Namespace: `window.api.system`

Zdrowie i status środowiska Node.js (Electron)

- `onStatusUpdate(callback: (status: 'OPTIMAL' | 'DEGRADED') => void): () => void`
  - **Opis**: Push z systemu przekazujący informację "System Optimal" bądź status o zajętej pamięci.
  - **IPC Channel**: `on('system:status-update')`
- `onMacroStatusChange(callback: (id: string, newStatus: MacroStatus) => void): () => void`
  - **Opis**: Push z systemu powiadamiający Frontend, że dane makro np. właśnie w tym momencie odpalane jest ze skrótu sprzętowego (zmienia graficzny stan karty na "RUNNING").
  - **IPC Channel**: `on('system:macro-status-changed')`

---

## 3. Moduły Backendowe (`src/main/`)

Po stronie Electrona funkcje odbierane na IPC będą mapowane na wewnętrzne moduły.

### 3.1 Kontroler Bazy `store/index.ts`

Wykorzystuje `electron-store`.

- Schemat zapisu:
  `macros`: Słownik `{ [uuid]: Macro }`
  `stats.timeSaved`: liczba
  `stats.totalRuns`: liczba

### 3.2 Menadżer Skrótów `keyboard/index.ts`

Moduł odpowiedzialny za cykl życia włączeń i wyłączeń.

- `registerAllActive(macros[])` – Rejestruje skróty z bazy w API `globalShortcut` z Electrona.
- _Callback skrótu_: Wrzuca zdarzenie w `macro-runner` (np. emituje `RunRequested`);

### 3.3 Engine Wykonawczy `macro-runner/index.ts`

Używa `@nut-tree-fork/nut-js` jako siły roboczej. Jego rdzenie to:
Pobiera obiekt JSON z Blockly (np. `Macro.blocksJson`), przekształca go w pamięci na abstrakcyjne drzewo operacji (AST) lub korzysta z jakiegoś parsera zdefiniowanego po swojemu dla node.js.
Dostępne instrukcje, które musi przetłumaczyć na `nut.js`:

- `MOUSE_MOVE_TO(x, y)` -> `await mouse.setPosition(new Point(x,y))`
- `MOUSE_CLICK(btn)` -> `await mouse.click(Button.LEFT)`
- `KEYBOARD_TYPE(text)` -> `await keyboard.type("tekst")`
- `KEYBOARD_PRESS(key)` -> `await keyboard.pressKey(Key.Enter)`
- `DELAY(ms)` -> `await new Promise(r => setTimeout(r, ms))`
- Zgłasza IPC do frontendu na temat rozpoczęcia biegu (w celu weryfikacji ikonek statusu w UI) i zakończenia biegu. Generuje `ActivityLog` za pomocą Serwisu logów.
