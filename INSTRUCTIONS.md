# INSTRUCTIONS for AI contributors in Keybrix

Ten plik jest źródłem prawdy dla pracy AI w tym repo.
Cel: każda zmiana ma być zgodna z aktualną architekturą, testowalna i łatwa do utrzymania.

## 1. Aktualna architektura projektu

### main (Electron main process)
- Plik wejściowy: src/main/index.ts.
- Odpowiada za lifecycle aplikacji i okno.
- Aktualnie nie ma pełnej warstwy backend IPC dla dashboardu.

### preload
- Plik: src/preload/index.ts.
- Wystawia window.electron oraz window.api.
- window.api jest obecnie oparty o mock bridge:
  - czyta dane z src/main/store/mockData.ts,
  - waliduje payloady i dane wyjściowe przez schemy z src/shared/api.ts,
  - symuluje realtime przez onNewLog, onStatusUpdate, onMacroStatusChange,
  - pilnuje cleanup timerow/listenerow.

### shared
- Plik kontraktu: src/shared/api.ts.
- Zawiera schemy zod, typy oraz KeybrixApi i IPC_CHANNELS.
- Kazda nowa metoda API ma byc najpierw opisana tutaj.

### renderer (React + Tailwind)
- Aktualna struktura:
  - src/renderer/src/components/layout
  - src/renderer/src/components/primitives
  - src/renderer/src/components/composites
  - src/renderer/src/components/screens
  - src/renderer/src/store
- Root:
  - src/renderer/src/App.tsx
  - src/renderer/src/main.tsx
- Globalne style:
  - src/renderer/src/assets/main.css

## 2. Zasady UI
- Uzywaj Tailwind utility classes.
- Nie dodawaj nowych globalnych plikow CSS.
- Dopuszczalny global CSS to tylko src/renderer/src/assets/main.css.
- Unikaj inline style. Jezeli naprawde konieczne, dodaj krotki komentarz uzasadniajacy.
- Komponenty buduj warstwowo:
  - primitives: najmniejsze elementy UI,
  - composites: elementy zlozone,
  - screens: kompozycja sekcji ekranu,
  - layout: shell aplikacji (sidebar, header, kontener).

## 3. API, typy i walidacja
- Zmiany kontraktu zaczynaj od src/shared/api.ts.
- Dla nowych danych:
  - dodaj schema zod,
  - dodaj type,
  - zaktualizuj KeybrixApi,
  - dopiero potem implementacja w preload/main.
- Waliduj inputy metod mutujacych (save/toggle itd.).
- Nie uzywaj any bez bardzo mocnego powodu.

## 4. Store i przeplyw danych
- Aktualne store'y renderer:
  - app.store.ts,
  - macro.store.ts,
  - activity.store.ts,
  - editor.store.ts,
  - ui.store.ts.
- Store czyta dane przez window.api.
- Realtime subskrypcje musza miec cleanup zwracany z useEffect.

## 5. Testy
- Framework: Vitest + React Testing Library.
- Setup: src/setupTests.ts.
- Typy testowe: src/renderer/src/env.d.ts.
- Test UI dashboardu: src/renderer/src/App.test.tsx.
- Przy nowych feature'ach UI dodawaj testy renderowania i przeplywu danych.
- Testy realtime nie powinny wisiec; preferuj jawne emitowanie callbackow zamiast kruchych timerow w testach.

## 6. Lint, format, typecheck
Uruchamiaj przed oddaniem zmian:
- pnpm run typecheck
- pnpm run lint
- pnpm run test -- --run

Formatowanie:
- pnpm run format

W projekcie aktywna jest zasada explicit-function-return-type, wiec funkcje komponentow i helperow typuj jawnie.

## 7. Tailwind i PostCSS
- Tailwind v4 jest skonfigurowany przez PostCSS plugin @tailwindcss/postcss.
- Konfiguracje:
  - tailwind.config.js
  - postcss.config.cjs
- Nie cofaj konfiguracji do starego wpisu tailwindcss jako pluginu PostCSS.

## 8. Konwencje nazw i lokalizacji
- Ekrany: *Screen.tsx w components/screens.
- Shell/layout: components/layout.
- UI base: components/primitives.
- UI zlozone: components/composites.
- Store: src/renderer/src/store.
- Kontrakt API i typy domenowe: src/shared/api.ts.

## 9. Checklist przed PR/oddaniem
- Kod kompiluje sie bez bledow typecheck.
- Lint przechodzi.
- Testy przechodza bez timeoutow i warningow act.
- Zmiany sa spojne z aktualna struktura components/layout-primitives-composites-screens.
- Przy zmianie API: shared -> preload -> renderer stores/components.

## 10. Czego nie robic
- Nie przebudowuj architektury folderow bez uzgodnienia.
- Nie przenos logiki API poza shared/preload/main bez potrzeby.
- Nie zostawiaj listenerow/timerow bez cleanup.
- Nie dodawaj obejsc bez walidacji typow i testu.

---
Najpierw architektura, potem wyglad, potem testy.
