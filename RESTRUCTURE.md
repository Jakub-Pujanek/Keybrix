# RESTRUCTURE PLAN - FILE-BASED MACROS + FILE-BASED BLOCKS

## 1. Cel

Przebudowac backend i edytor tak, aby:
1. Kazde makro bylo osobnym plikiem JSON.
2. Definicje blokow byly ladowane z plikow (registry), a nie hardkodowane w UI.
3. "My First Macro" zawsze istnialo jako pelne makro startowe.
4. Pozostale mocki zostaly usuniete.
5. Rozwiazanie bylo stabilne na Linux, Windows i macOS.

## 2. Zasady architektury

1. Main process pozostaje source of truth.
2. Preload pozostaje cienkim bridge IPC.
3. Shared trzyma kontrakt i schemy.
4. Renderer nie trzyma logiki wykonawczej backendowej.
5. Makra sa danymi (JSON), runtime wykonuje je przez mapowanie do nut-js.

## 3. Docelowy model danych

1. Katalog danych usera: `app.getPath('userData')`.
2. Katalog makr: `userData/macros/`.
3. Jeden plik na makro: `slug.json`.
4. Kazdy plik makra ma stabilne `id` w tresci.
5. Nazwa makra (`name`) jest edytowalna i trzymana w pliku.
6. Nazwa pliku to slug z `name`, z obsluga kolizji (`-2`, `-3`, ...).
7. Indeks makr: `userData/macros/index.json`.
8. `index.json` trzyma minimum: `id`, `slug`, `fileName`, `updatedAt`.

## 4. Docelowy model blokow

1. Shared: kontrakt bloku i schema payloadu.
2. Main: wykonawcza definicja bloku i kompilacja do runtime planu.
3. Renderer: definicja prezentacyjna bloku (etykieta, ikona, formularz).
4. Registry blokow ladowane z plikow, nie hardkodowane w komponentach.

## 5. Fazy wdrozenia

### Faza 0 - Przygotowanie i decyzje

1. Zamrozic format pliku makra v1 (`id`, `name`, `shortcut`, `isActive`, `status`, `blocksJson`, `createdAt`, `updatedAt`).
2. Zamrozic reguly slugify i kolizji.
3. Zamrozic polityke rename: zmiana `name` aktualizuje slug i nazwe pliku.
4. Dodac dokument decyzji technicznych i checklisty rollback.

Brama akceptacyjna:
1. Uzgodniony format plikow i indeksu.
2. Jasna polityka ID vs slug.

Status:
1. Completed (artefakt: RESTRUCTURE-PHASE0.md).

### Faza 1 - Warstwa storage makr w plikach

1. Dodac nowy serwis `macro-files.store` w Main.
2. Operacje: `list`, `readById`, `create`, `update`, `rename`, `delete`.
3. Operacje maja byc atomowe (tmp file + rename).
4. Dla update i rename aktualizowac `index.json`.
5. Dodac recovery: odbudowa indexu z katalogu `macros/` gdy index jest uszkodzony.

Brama akceptacyjna:
1. CRUD makr dziala bez `main.json` jako glownego nosnika makr.
2. Kolizje slugow obslugiwane poprawnie.

Status:
1. Completed (implementacja: `src/main/store/macro-files.store.ts`, testy: `src/main/store/macro-files.store.test.ts`).

### Faza 2 - Migracja z obecnego `main.json`

1. Przy starcie wykryc stare makra w `mainStore.state.macros`.
2. Przeniesc je do `macros/*.json` i zbudowac `index.json`.
3. Oznaczyc schemaVersion migracji.
4. Zachowac logs/stats/audit w obecnym store na ten etap.
5. Po migracji wyczyscic `state.macros` lub zostawic tylko marker migracji.

Brama akceptacyjna:
1. Dane makr nie gina po migracji.
2. Dashboard i Editor czytaja makra z nowych plikow.

Status:
1. Completed (implementacja: `src/main/services/macro-migration.service.ts`, testy: `src/main/services/macro-migration.service.test.ts`).

### Faza 3 - My First Macro jako pelne makro startowe

1. Dodac mechanizm ensure-by-id: jesli brak `macro-my-first`, utworz je.
2. Makro ma pelny `blocksJson` (realne bloki i parametry).
3. Ensure uruchamia sie po migracji i przy nowych instalacjach.
4. Ensure nie nadpisuje istniejacego makra usera.

Brama akceptacyjna:
1. "My First Macro" istnieje po starcie aplikacji.
2. Makro da sie otworzyc i uruchomic.

Status:
1. Completed (implementacja: `src/main/services/macro-seed.service.ts`, testy: `src/main/services/macro-seed.service.test.ts`).

### Faza 4 - Bloki do plikow i registry

1. Dodac katalog registry blokow, np. `src/shared/block-registry/`.
2. Kazdy blok ma plik z metadata i schema payloadu.
3. Main ma mapowanie `blockType -> execute/compile` w osobnym module registry.
4. Renderer panel biblioteki blokow czyta definicje z registry.
5. Usunac hardkod listy blokow z komponentu biblioteki.

Brama akceptacyjna:
1. Dodanie nowego bloku wymaga dopisania pliku definicji, bez edycji wielu miejsc.
2. Editor i runtime sa spójne schema-first.

Status:
1. Completed (implementacja: `src/shared/block-registry/**`, `src/main/macro-runner/block-runtime.registry.ts`, `src/renderer/src/components/composites/editor/BlocksLibraryPanel.tsx`).

### Faza 5 - Cleanup mockow

1. Usunac pozostale mock dane runtime i komentarze tymczasowe.
2. Usunac nieuzywane sciezki testowe, ktore udaja backend.
3. Sprawdzic `src/**` pod frazy: `mockData`, `MOCK_`, `mock runtime`, `mock bridge`.

Brama akceptacyjna:
1. Brak mock logiki domenowej w runtime codepath.
2. Testy korzystaja z kontrolowanych mockow tylko w unitach.

Status:
1. Completed (cleanup: usuniete pozostalosci `mock` poza testami, kontrolowane mocki pozostawione w unit testach).

### Faza 6 - Testy i hardening

1. Unit: storage plikowe (create/update/rename/delete/collision).
2. Unit: migracja z main.json do plikow makr.
3. Unit: ensure My First Macro.
4. Integration: IPC macros.* na nowym storage.
5. Integration: rename makra aktualizuje nazwe pliku i nadal otwiera poprawne makro po ID.
6. Smoke: create -> save -> dashboard -> edit -> run -> restart.

Brama akceptacyjna:
1. `pnpm run typecheck` przechodzi.
2. `pnpm run lint` przechodzi.
3. `pnpm vitest run` przechodzi.

Status:
1. Completed (testy integracyjne `macros.*` w preload + hardening rename makra po ID + komplet bramek jakosci).

## 6. Co zostaje w `main.json`, a co wychodzi

1. WYCHODZI z `main.json`: `macros` (pelne dane makr).
2. ZOSTAJE w `main.json` (etapowo): `logs`, `stats`, `audit`.
3. `settings` pozostaje osobno w `settings.json`.

## 7. Proponowana struktura plikow

1. `userData/macros/index.json`
2. `userData/macros/my-first-macro.json`
3. `userData/macros/copy-paste-pro.json`
4. `userData/settings.json`
5. `userData/main.json` (tymczasowo logs/stats/audit)

## 8. Kluczowe ryzyka i zabezpieczenia

1. Ryzyko kolizji slugow.
2. Ryzyko uszkodzenia indexu.
3. Ryzyko przerwania zapisu podczas rename.
4. Ryzyko roznic filesystem (case sensitivity).

Mitigacje:
1. Stabilne ID i indeks po ID.
2. Atomic write.
3. Rebuild index fallback.
4. Testy cross-platform path handling.

## 9. Definition of Done

1. Makra sa trzymane jako osobne pliki JSON.
2. Dashboard i Editor dzialaja na nowym storage.
3. "My First Macro" istnieje i jest pelnym makrem.
4. Bloki sa ladowane z registry plikowego.
5. Mocki runtime sa usuniete.
6. Wszystkie bramki jakosci przechodza.
