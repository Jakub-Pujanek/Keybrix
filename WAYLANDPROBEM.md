# WAYLANDPROBEM - Pelny plan feature

## 1. Cel feature

Zbudowac pelny mechanizm wykrywania sesji Wayland/X11 i jasnej komunikacji dla usera:

- Jesli sesja to Wayland: pokazac globalny pasek na dole aplikacji (na kazdym screenie), z komunikatem o blokadzie symulowanego inputu i akcjami.
- Pasek ma miec:
  - przycisk "Sprawdz sesje teraz",
  - przycisk "Jak przelaczyc na X11" (otwiera osobny screen poradnika),
  - czytelny stan (blocked/ok/checking).
- Po udanej zmianie na X11: pasek zmienia sie na zielony, pokazuje potwierdzenie sukcesu, po krotkiej chwili znika.
- Wszystkie teksty dzialaja w obu jezykach (PL + EN).
- Styl ma respektowac aktualna palete i akcent (theme + accent color).

## 2. Zakres funkcjonalny

### 2.1 Session detection

Stan sesji (minimum):

- `sessionType`: `WAYLAND` | `X11` | `UNKNOWN`
- `rawSession`: string | null (np. `XDG_SESSION_TYPE`)
- `detectedAt`: ISO datetime
- `isInputInjectionSupported`: boolean

Polityka:

- `WAYLAND` => `isInputInjectionSupported = false`
- `X11` => `isInputInjectionSupported = true`
- `UNKNOWN` => ostrozny warning, ale bez twardej blokady banera sukcesu

### 2.2 Global bottom banner

Pasek ma byc renderowany w shellu layoutu, nie w pojedynczym screenie.

Widocznosc:

- Pokazuj zawsze, gdy sessionType = WAYLAND.
- Pokazuj tymczasowo po sukcesie X11 (`SUCCESS` state), potem autohide.
- Ukryj, gdy X11 i brak pending sukcesu.

Stany banera:

- `BLOCKED`: Wayland wykryty, kolor ostrzegawczy.
- `CHECKING`: trwa reczny refresh sesji.
- `SUCCESS`: wykryto X11 po poprzednim blocked, kolor zielony, auto-hide.
- `UNKNOWN`: sesja nierozpoznana, kolor neutralny/warn.

Akcje banera:

- `Sprawdz sesje teraz` -> trigger backend refresh detection.
- `Jak przelaczyc na X11` -> nawigacja do nowego `WaylandGuideScreen`.

### 2.3 Guide screen (osobny ekran)

Nowy ekran: `WaylandGuideScreen.tsx`.

Wymagania:

- Krok po kroku jak przejsc na X11.
- Sekcja dla najczestszych DE/login managerow (np. GDM).
- Wyrazny disclaimer: po przelogowaniu uruchomic app ponownie.
- CTA: `Sprawdz sesje teraz` oraz `Wroc`.

Routing:

- Dodac nowy screen name do app store, np. `wayland-guide`.
- Dostep z banera globalnego.

## 3. Architektura techniczna (zgodnie z INSTRUCTIONS.md)

## 3.1 shared/api.ts (source of truth)

Dodac:

- `SessionTypeSchema`
- `RuntimeSessionInfoSchema`
- `SessionCheckResultSchema`
- nowy kontrakt API w `KeybrixApi.system`, np.:
  - `getSessionInfo(): Promise<RuntimeSessionInfo>`
  - `refreshSessionInfo(): Promise<RuntimeSessionInfo>`
  - opcjonalnie realtime event `sessionInfoChanged`

Dodac IPC channels, np.:

- `system:get-session-info`
- `system:refresh-session-info`
- opcjonalnie `system:session-info-changed`

## 3.2 main process

W `src/main/index.ts` i/lub nowym serwisie `src/main/services/session-detection.service.ts`:

- Wykrywanie sesji z env:
  - `XDG_SESSION_TYPE`
  - fallback: obecny heurystyczny detector z macro runnera
- IPC handlers dla get/refresh.
- Ujednolicic logowanie diagnostyczne.

Zalecane:

- Wydzielic do serwisu, z metoda:
  - `detectSession(): RuntimeSessionInfo`

## 3.3 preload

W `src/preload/index.ts`:

- Cienki bridge do nowych IPC metod.
- Walidacja input/output przez schemy shared.
- Bez logiki domenowej/timerow.

## 3.4 renderer stores

Preferowany nowy store: `src/renderer/src/store/session.store.ts`

Stan:

- `sessionInfo`
- `isChecking`
- `lastBlockedAt`
- `showSuccessUntil` (timestamp)

Akcje:

- `loadSessionInfo()`
- `refreshSessionInfo()`
- `openWaylandGuide()`
- `consumeSuccessAutohide()`

Integracja:

- `AppLayout` renderuje globalny banner na dole.
- `App`/root odpala initial load sesji.

## 3.5 renderer components

Nowe komponenty:

- `src/renderer/src/components/composites/system/SessionStatusBanner.tsx`
- `src/renderer/src/components/screens/WaylandGuideScreen.tsx`

Wymogi UI:

- Tailwind classes only.
- Bez nowych global CSS files.
- Brak inline style (chyba ze absolutnie konieczne).
- Pelna zgodnosc z accent/theme poprzez istniejace CSS vars i tokeny.

## 4. i18n - oba jezyki

Dodac klucze PL + EN dla:

- tytul i opis banera blocked/unknown/success/checking,
- labelki przyciskow,
- tytuly i kroki poradnika,
- teksty CTA.

Przyklad obszarow kluczy:

- `wayland.banner.blocked.title`
- `wayland.banner.blocked.body`
- `wayland.banner.checkNow`
- `wayland.banner.openGuide`
- `wayland.banner.success`
- `wayland.guide.title`
- `wayland.guide.steps.*`

## 5. Dokladny flow UX

### 5.1 App start

1. Renderer robi `getSessionInfo`.
2. Jesli WAYLAND -> pokaz banner blocked na dole, stale.
3. Jesli X11 -> banner hidden.

### 5.2 User on Wayland kliknie "Sprawdz sesje teraz"

1. Banner przechodzi w `CHECKING`.
2. Renderer wywoluje `refreshSessionInfo`.
3. Wynik:
   - nadal WAYLAND -> wraca `BLOCKED`.
   - X11 -> przejdz w `SUCCESS`, zielony banner, autohide po np. 4-6 sekundach.

### 5.3 User kliknie "Jak przelaczyc na X11"

1. Nawigacja do `WaylandGuideScreen`.
2. Screen pokazuje kroki + przycisk `Sprawdz sesje teraz`.
3. Po sukcesie wraca na poprzedni screen (opcjonalnie) lub zostaje z sukcesowym banerem.

## 6. Plan implementacji (task-by-task)

### Faza A - API contract

1. `src/shared/api.ts`:
   - dodaj schemy i typy sesji,
   - rozbuduj `KeybrixApi.system`,
   - dodaj IPC_CHANNELS.

### Faza B - Main + preload

2. Dodaj `session-detection.service.ts` w main.
3. Dodaj IPC handlers w `src/main/index.ts`.
4. Dodaj bridge metody w `src/preload/index.ts`.

### Faza C - Renderer state + global banner

5. Dodaj `session.store.ts`.
6. Dodaj `SessionStatusBanner.tsx` i osadz w `AppLayout` (always mounted).
7. Integracja z `app.store` (nowy screen `wayland-guide`).

### Faza D - Guide screen

8. Dodaj `WaylandGuideScreen.tsx`.
9. Dodaj wejscie do routingu `App.tsx`.

### Faza E - i18n + polish

10. Dodaj pelne klucze PL/EN.
11. Zweryfikuj readability i zgodnosc z accent palette.

### Faza F - tests

12. Preload tests: get/refresh session IPC mapping i parse.
13. Renderer tests:
    - banner widoczny na WAYLAND,
    - button check triggeruje refresh,
    - success state + autohide,
    - guide screen render i nawigacja.
14. Main tests (jezeli istnieje harness): detector env mapping.

## 7. Kryteria akceptacji

- Banner widoczny na dole niezaleznie od aktywnego screena.
- Wayland wykryty => komunikat blocked + 2 przyciski (`check now`, `guide`).
- Guide jest osobnym screenem i ma kroki PL/EN.
- Po przejsciu na X11 i refresh:
  - banner zielony success,
  - znika automatycznie po krotkim czasie.
- Brak regresji stylu i dzialania accent palette.
- Typecheck + lint + testy przechodza.

## 8. Ryzyka i decyzje

Ryzyka:

- Rozne distro/login managery maja rozne sciezki przejscia na X11.
- User moze odpalic appke bez pelnego env (`UNKNOWN`).

Decyzje:

- W guide pokazac najczestszy flow (GDM/Ubuntu) + notke "moze sie roznic zalezne od distro".
- `UNKNOWN` traktowac jako warning, bez falszywego success.

## 9. Pozniejsze rozszerzenia (opcjonalne)

- Link do zewnetrznej dokumentacji online (fallback).
- Telemetria ilosci userow na WAYLAND/X11.
- Rekomendacje runtime backendow Wayland (jesli kiedys wejdzie wsparcie).

---
Plan jest gotowy do implementacji etapami bez lamania architektury: shared -> main/preload -> store -> UI screens/composites -> testy.
