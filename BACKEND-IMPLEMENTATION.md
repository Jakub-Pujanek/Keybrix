# BACKEND IMPLEMENTATION PLAN - KEYBRIX

## 1. Cel i zasady realizacji

Ten dokument zamienia specyfikacje z [BACKEND.md](BACKEND.md) na konkretny plan wdrozenia krok po kroku.

Plan jest zgodny z zasadami z [INSTRUCTIONS.md](INSTRUCTIONS.md):
1. Najpierw architektura i kontrakty, potem implementacja runtime, na koncu testy i hardening.
2. Granica odpowiedzialnosci:
- Main: logika domenowa i source of truth.
- Preload: cienki adapter IPC.
- Shared: schemy zod, typy, kanaly.
3. Kazda faza konczy sie bramka akceptacyjna i checklista testowa.

## 2. Definicja faz i kolejnosc

1. Faza 0: Przygotowanie i guardraile.
2. Faza A: Fundament danych i serwisow backend.
3. Faza B: IPC dla macros/stats/logs/system.
4. Faza C: Runtime makr + shortcut manager.
5. Faza D: Odchudzenie preload i usuniecie mock bridge.
6. Faza E: Jakosc, testy, obserwowalnosc, hardening.

## 3. Faza 0 - Przygotowanie i guardraile

### Cel

Przygotowac bezpieczne warunki do migracji backendu bez regresji funkcjonalnej.

### Kroki implementacyjne

1. Potwierdzic kontrakt jako source of truth w [src/shared/api.ts](src/shared/api.ts).
2. Oznaczyc w [src/preload/index.ts](src/preload/index.ts) sekcje mock runtime jako tymczasowe (TODO dla wyciecia po Fazie C/D).
3. Dodac plan migracji odpowiedzialnosci do [src/main/index.ts](src/main/index.ts):
- ktore kanaly `ipcMain.handle` beda przeniesione,
- ktore push-eventy beda emitowane z Main.
4. Ustalic polityke konfliktow shortcut (decyzja implementacyjna):
- wariant A: odrzucenie nowego makra z konfliktem,
- wariant B: przejecie shortcut przez nowe makro.
5. Ustalic polityke wspolbieznosci uruchomien makra:
- single-flight per macro (zalecane na start),
- global queue (opcjonalnie pozniej).

### Artefakty

1. Krótka notatka decyzyjna w [BACKEND-IMPLEMENTATION.md](BACKEND-IMPLEMENTATION.md) (sekcja 12).
2. Lista TODO z odniesieniami do modulow Main i Preload.

### Bramka akceptacyjna

1. Jasne decyzje dla konfliktu shortcut i concurrency.
2. Brak zmian funkcjonalnych na UI na tym etapie.

## 4. Faza A - Fundament danych i serwisow backend

### Cel

Zbudowac trwała warstwe danych i podstawowe serwisy domenowe w Main.

### Zakres plikow

1. [src/main/store/index.ts](src/main/store/index.ts)
2. Nowe moduly w [src/main/services](src/main/services) (np. `macro.repository.ts`, `logs.service.ts`, `stats.service.ts`).
3. Ewentualne wsparcie migracji w [src/main/services/settings.service.ts](src/main/services/settings.service.ts).

### Kroki implementacyjne

1. Zastapic no-op store realnym storage backendowym:
- schemaVersion,
- macros.byId,
- macros.order,
- logs.buffer,
- stats.counters.
2. Dodac migracje wersji danych:
- uzupelnianie brakujacych pol,
- migracja starszych `blocksJson`.
3. Zaimplementowac `MacroRepository`:
- `getAll`, `getById`, `save`, `delete`, `toggleActive`,
- stabilne sortowanie,
- spojnosc `byId` i `order`.
4. Zaimplementowac `LogsService`:
- append,
- getRecent(limit),
- retencja (staly limit bufora).
5. Zaimplementowac `StatsService`:
- counters (runs success/fail, timeSaved),
- read-model pod `stats.get`.
6. Dodac walidacje zod na granicy wejscia do serwisow (minimum dla mutacji).

### Bramka akceptacyjna

1. Dane makr/logow/stats sa trwale po restarcie aplikacji.
2. Brak danych runtime w stanie preload.
3. Serwisy przechodza testy jednostkowe.

## 5. Faza B - IPC: macros, logs, stats, system

### Cel

Przeniesc obsluge kontraktow API z mock preload do realnych handlerow Main.

### Zakres plikow

1. [src/main/index.ts](src/main/index.ts)
2. Nowy modul kontrolera IPC w Main (np. [src/main/ipc](src/main/ipc)).
3. [src/preload/index.ts](src/preload/index.ts) (tylko most, bez logiki).

### Kroki implementacyjne

1. Dodac/uzupelnic `ipcMain.handle` dla:
- `macros.getAll`,
- `macros.getById`,
- `macros.save`,
- `macros.delete`,
- `macros.toggle`,
- `macros.run`,
- `stats.get`,
- `logs.getRecent`,
- `keyboard.recordShortcut` (co najmniej walidacja + telemetry log).
2. Dodac push eventy z Main:
- `logs.new-log`,
- `system.statusUpdate`,
- `system.macroStatusChanged`.
3. Utrzymac walidacje payloadow:
- input walidowany przed logika domenowa,
- output walidowany przed odeslaniem do renderer.
4. Zapewnic cleanup listenerow:
- brak wyciekow subskrypcji przy zamykaniu okna.

### Bramka akceptacyjna

1. Kazda metoda z kontraktu ma dzialajacy handler po stronie Main.
2. Renderer pobiera dane przez `window.api` bez mock-state.
3. Push-eventy dochodza do store'ow renderer stabilnie.

## 6. Faza C - Runtime makr i ShortcutManager

### Cel

Uruchamiac makra realnie, z poszanowaniem settings i zasad niezawodnosci.

### Zakres plikow

1. [src/main/macro-runner/index.ts](src/main/macro-runner/index.ts)
2. [src/main/keyboard/index.ts](src/main/keyboard/index.ts)
3. [src/main/index.ts](src/main/index.ts)
4. Serwisy z Fazy A.

### Kroki implementacyjne

1. Zaimplementowac parser runtime komend:
- mapowanie `blocksJson` -> lista komend wykonawczych,
- walidacja niepoprawnych komend i log ERR.
2. Zaimplementowac executor:
- komendy: PRESS_KEY, TYPE_TEXT, MOUSE_CLICK, WAIT, REPEAT, INFINITE_LOOP,
- delay policy: WAIT ma wlasny czas, reszta bierze `delayMs`,
- stop policy: `stopOnError` true/false,
- cancellation token.
3. Dodac menedzer uruchomien:
- single-flight per macro,
- mapowanie aktywnych runow,
- gwarantowane przejscie statusu do IDLE po zakonczeniu.
4. Spiac runtime z `globalMaster`:
- `globalMaster=false` blokuje nowe uruchomienia,
- wymusza zatrzymanie aktywnych runow.
5. Zaimplementowac `ShortcutManager`:
- register/unregister dla aktywnych makr,
- re-register po `macros.save` i `macros.toggle`,
- cleanup przy quit.
6. Dodac integracje notyfikacji:
- emit tylko gdy `notifyOnMacroRun=true`,
- rate limiting antyspam.

### Bramka akceptacyjna

1. `macros.run` wykonuje realny runtime i emituje logi/statusy.
2. Global shortcut uruchamia przypisane makra.
3. Zmiana settings natychmiast wplywa na runtime.

## 7. Faza D - Usuniecie mock bridge z preload

### Cel

Zostawic w preload jedynie bezpieczny adapter contextBridge + IPC.

### Zakres plikow

1. [src/preload/index.ts](src/preload/index.ts)

### Kroki implementacyjne

1. Usunac in-memory kolekcje danych makr/logow/stats z preload.
2. Usunac timery symulujace status i logi.
3. Zostawic czyste mapowanie:
- invoke do `ipcRenderer.invoke`,
- subscribe/unsubscribe do push channeli.
4. Zachowac walidacje graniczna payloadow (in/out).
5. Potwierdzic cleanup subskrypcji i brak wiszacych listenerow.

### Bramka akceptacyjna

1. Preload nie zawiera logiki domenowej.
2. Wszystkie dane i eventy pochodza z Main.

## 8. Faza E - Jakosc, testy, obserwowalnosc

### Cel

Domknac niezawodnosc backendu i krytyczne scenariusze awarii.

### Kroki implementacyjne

1. Testy jednostkowe (Vitest):
- `MacroRepository`,
- `LogsService`,
- `StatsService`,
- `MacroRunner`,
- `ShortcutManager`,
- side effecty `SettingsService`.
2. Testy integracyjne IPC:
- invoke `macros.*`, `stats.get`, `logs.getRecent`,
- push `logs.new-log`, `system.statusUpdate`, `system.macroStatusChanged`.
3. Smoke E2E przeplywow:
- create -> save -> toggle -> run -> log,
- globalMaster OFF blokuje run,
- restart zachowuje stan.
4. Obserwowalnosc:
- strukturalne logi backendu,
- correlation id dla run,
- audit trail dla settings i run-block reason.
5. Hardening edge cases:
- konflikty shortcut,
- szybkie wielokrotne klikniecie Run,
- usuwanie makra w trakcie wykonania,
- uszkodzony payload po migracji.

### Bramka akceptacyjna

1. Przechodza: `pnpm run typecheck`, `pnpm run lint`, `pnpm vitest run`.
2. Brak regresji w settings i istniejacych ekranach renderer.
3. Definition of Done z [BACKEND.md](BACKEND.md) jest spelnione.

## 9. Rozpiska techniczna krok po kroku (task list)

1. Utworzyc `MainStore` i schemat persisted danych.
2. Dodac migracje `schemaVersion`.
3. Zaimplementowac `MacroRepository` i testy CRUD.
4. Zaimplementowac `LogsService` i retencje.
5. Zaimplementowac `StatsService` + agregacje.
6. Dodac handlers `macros.getAll/getById/save/delete/toggle`.
7. Dodac handler `stats.get`.
8. Dodac handler `logs.getRecent`.
9. Dodac push `logs.new-log`.
10. Dodac `SystemHealthService` i push `system.statusUpdate`.
11. Zaimplementowac parser runtime komend.
12. Zaimplementowac executor z cancellation token.
13. Dodac `macros.run` z single-flight.
14. Zaimplementowac `ShortcutManager` i integracje `globalShortcut`.
15. Spiac runtime z settings (`globalMaster`, `delayMs`, `stopOnError`).
16. Spiac runtime z notyfikacjami (`notifyOnMacroRun` + rate limiting).
17. Dodac push `system.macroStatusChanged` z runtime.
18. Uproscic preload do adaptera IPC i cleanup listenerow.
19. Dodac testy IPC integration.
20. Dodac smoke E2E oraz hardening scenariuszy awarii.

## 10. Ryzyka i plan redukcji ryzyka

1. Ryzyko: regresja settings po podpieciu runtime.
- Mitigacja: kontraktowe testy integracyjne `settings.update` + runtime side effects.
2. Ryzyko: race condition przy szybkim uruchamianiu makra.
- Mitigacja: single-flight lock per macro + testy konkurencyjne.
3. Ryzyko: wycieki listenerow IPC.
- Mitigacja: scentralizowany helper subscribe/unsubscribe + test cleanup.
4. Ryzyko: uszkodzone stare `blocksJson`.
- Mitigacja: migrator + fallback parser + log WARN/ERR.

## 11. Kryteria gotowosci do mergowania (per faza)

1. Zmienione API jest najpierw zdefiniowane w [src/shared/api.ts](src/shared/api.ts) (jesli rozszerzamy kontrakt).
2. Implementacja w Main ma walidacje i typy bez `any`.
3. Preload zawiera tylko adapter i walidacje graniczna.
4. Testy dla nowych serwisow i przeplywow sa dodane.
5. Lint/typecheck/test przechodza przed zamknieciem fazy.

## 12. Decyzje implementacyjne do zamrozenia przed startem kodowania

1. Konflikty shortcut: domyslnie odrzucaj nowy konflikt z bledem domenowym (bez cichego przejmowania).
2. Concurrency runtime: single-flight per macro na pierwsza iteracje.
3. Retencja logow: stale N=200 na starcie.
4. Health check: interwal 5s + debounce zmiany statusu 2 kolejne pomiary.
5. Persistencja telemetry runtime: counters stale, logi rotowane po limicie.

## 13. Minimalny harmonogram wykonania

1. Sprint 1: Faza 0 + Faza A.
2. Sprint 2: Faza B.
3. Sprint 3: Faza C.
4. Sprint 4: Faza D + Faza E.

Plan mozna realizowac inkrementalnie, ale tylko przy zachowaniu zasady: zadna nowa funkcja runtime nie zostaje finalnie w preload.

## 14. Status realizacji Fazy 0

Zrealizowane artefakty przygotowawcze (bez zmian zachowania aplikacji):

1. Dodano guardraile migracji IPC i odpowiedzialnosci Main w [src/main/index.ts](src/main/index.ts).
2. Dodano notatke deprecacji mock runtime w [src/preload/index.ts](src/preload/index.ts).
3. Dodano docelowe seamy implementacyjne dla Fazy A/C:
- [src/main/store/index.ts](src/main/store/index.ts),
- [src/main/macro-runner/index.ts](src/main/macro-runner/index.ts),
- [src/main/keyboard/index.ts](src/main/keyboard/index.ts).

Decyzje zamrozone dla implementacji:

1. Konflikty shortcut: odrzucenie konfliktu (bez auto-przejecia).
2. Concurrency runtime: single-flight per macro.
3. Health check: interwal 5s + debounce 2 pomiary.
4. keyboard.recordShortcut: walidacja + rezerwacja shortcutu.
