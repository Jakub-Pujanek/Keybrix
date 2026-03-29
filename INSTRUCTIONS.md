# INSTRUCTIONS for AI contributors in Keybrix

Ten plik ma być źródłem prawdy dla całego zespołu AI, żeby każda nowa zmiana w kodzie:
- była zgodna z architekturą istniejącą w projekcie,
- nie omijała żadnego ważnego kroku,
- miała zawsze testy i działała z tym co już jest.

## 1. Architektura + zakres
a) `main` (Electron main process):
   - Tylko tu jest core backend: okno, zdarzenia systemowe, IPC (zmienne w `IPC_CHANNELS`).
   - Nie wycinaj istniejącej struktury `src/main/index.ts` (window, app lifecycle, preload).
   - Nowy backendowy kod (np. z obsługą makr) łącz z IPC w `src/main/index.ts` i `src/preload/index.ts`.
   - Jeśli dodajesz nowe kanały IPC, zaktualizuj również `src/shared/api.ts` + `dst preload api`.

b) `preload`:
   - Kluczowy szkielet: exposeInMainWorld('electron', electronAPI), exposeInMainWorld('api', api).
   - Brakujący endpoint: dopisz do `api` w `src/preload/index.ts`.
   - Każda metoda musi wewnętrznie walidować (z `zod` lub manual) jeśli ma wejście.

c) `renderer` (React):
   - Wszystkie nowe komponenty w `src/renderer/src/` w folderach `features/*` (dashboard/editor/settings) lub `components/*`.
   - Używaj modułowego CSS tylko przez Tailwind utility-classes.
   - global / base styles tylko w `src/renderer/src/assets/main.css` + `tailwind.config.js`.

## 2. UI: zawsze Tailwind
- Nie importuj klasycznych plików CSS oprócz istniejącego `src/renderer/src/assets/main.css`.
- Każdy nowy visual element ma używać `className` z Tailwind. Przykład:
  `className="rounded-lg p-4 bg-slate-800 text-slate-100 shadow-lg"
`.
- Zawieraj responsywność: `sm:`, `md:`, `lg:` etc, jeśli konstrukcja mogłaby się złamać.
- Nie dopuszczaj raw `style={{}}` chyba, że jest to absolutnie niezbędne (wtedy dodaj komentarz "only non-Tailwind fallback").

## 3. API i typy
- Centralna definicja typów: `src/shared/api.ts`.
- Nowe obiekty/zasoby zawsze dodaj w tym pliku jako `zod` schema + `type`.
- Nie pomijaj walidacji payloadu w `src/main` i `src/preload`.
- Nowe kanały IPC:
  - dopisz w `IPC_CHANNELS`
  - zaktualizuj `KeybrixApi` w `src/shared/api.ts`
  - obsługę w `src/main/index.ts` (ipcMain.handle)
  - wrapper w `src/preload/index.ts` (ipcRenderer.invoke lub on)

## 4. Testy
- Każdy nowy feature musi mieć testy:
  - UI: `src/renderer/src/*.test.tsx` (React Testing Library)
  - Backend: `src/main/**/*.test.ts` jeśli jest logika lub helper.
- Jednostkowe testy dla zod -> walidacja inputu.
- Domyślne pole wyboru: użyj `vitest` z plikiem `vitest.config.ts`.
- Każdy dodany test ma być automatycznie wykonywalny skryptem:
  - `pnpm run test -- --run`
  - `pnpm run coverage`

## 5. Lint / format
- Zawsze uruchom przed commitem:
  - `pnpm run lint`
  - `pnpm run format`
- W nowych plikach stosuj zasady `eslint.config.mjs` i `.prettierrc.yaml`.
- Dla `@ts-ignore`: wymagane co najmniej 3 znaki tekstu opisu:
  `// @ts-ignore: Description...`

## 6. Nowe zależności i konfiguracje
- Jeśli potrzebujesz nowej biblioteki, nim dodasz, potwierdź:
  - czy jest konieczna i lekka;
  - że nie ma „podwójnych” już istniejących.
- Dla każdej nowej paczki twórz config:
  - `tailwindcss`: `tailwind.config.js`, `postcss.config.cjs`, import w main CSS.
  - `vitest`: `vitest.config.ts`, `src/setupTests.ts`, test w `src/renderer/src/*.test.tsx`.
  - `eslint`: `eslint.config.mjs` (jeśli dodałeś pluginy).
  - `prettier`: `.prettierrc.yaml` i `.prettierignore`.

## 7. Commit + review checklist
- [ ] Kod działa lokalnie (`pnpm run dev` uruchamia okno bez błędów).
- [ ] `pnpm run typecheck` -> zero błędów.
- [ ] `pnpm run lint` -> zero błędów (`warn`->dopasowane ok).
- [ ] `pnpm run test -- --run` -> 0 failures.
- [ ] `pnpm run coverage` (przynajmniej 80% w nowych plikach).
- [ ] `INSTRUCTIONS.md` pozostaje aktualny, nie pomija kluczowych kroków.

## 8. Małe itemy (nie można omijać)
- `src/main` zamknij wszystkie `app.on('will-quit')` wyczyszczeniem.
- `src/main` zamknij eventy wskaźnikiem “watcher cleanup”.
- Unikaj `any` w kodzie, zawsze typuj.
- W `src/shared/api.ts` bilans [schema + fallback].
- W testach daj opis <i>nie docker/pusty</i> np. "should render configurable dashboard card".
- Kiedy dodajesz nowy fragment UI, wrzuć screen-`data-testid` w `render` i testuj query.

## 9. Konwencje nazewnictwa
- `features/{dashboard,editor,settings}/...` i `components/{ui,layout,macro,terminal}/...`
- `*View.tsx` dla ekranów, `*Card.tsx` dla paneli.
- `useAppStore.ts` dla global store.
- IPC kanały w `IPC_CHANNELS` camelCase (np. `macros:get-all`).

## 10. Komunikacja między layers
1. Renderer -> preload -> main via IPC.
2. main -> renderer eventy przez `system` i `logs`.
3. Nie pisz już bezpośrednio `window.api` w `main`.
4. Jeśli dodajesz `broadcast`, użyj tej samej struktury co w `src/main/index.ts`.

## 11. Nie pomijaj (w szczegółach)
- brak: metod lub propsów w API;
- zła kolejność ładowania `useEffect` w React;
- brak `cleanup` w event listenerach i `setInterval`;
- błędne ścieżki importu (stosuj aliasy, gdy możesz);
- brak `await` w async funkcjach (immediate return bez obsługi błędów);
- mechanizm i18n (jeśli dodasz meta/tekst, minimalnie: `string` w `const`).

## 12. Lista narzędzi (package.json)
Poniżej wszystkie paczki z `package.json`, które AI powinno rozważać przy rozszerzaniu funkcjonalności.
NIE POMIJAĆ żadnej.

- @electron-toolkit/preload
- @electron-toolkit/utils
- @nut-tree-fork/nut-js
- blockly
- electron-log
- electron-store
- framer-motion
- lucide-react
- react-blockly
- zod
- zustand

- @electron-toolkit/eslint-config-prettier
- @electron-toolkit/eslint-config-ts
- @electron-toolkit/tsconfig
- @testing-library/jest-dom
- @testing-library/react
- @types/node
- @types/react
- @types/react-dom
- @vitejs/plugin-react
- @vitest/ui
- autoprefixer
- c8
- cross-env
- electron
- electron-builder
- electron-vite
- eslint
- eslint-plugin-react
- eslint-plugin-react-hooks
- eslint-plugin-react-refresh
- postcss
- prettier
- prettier-plugin-tailwindcss
- react
- react-dom
- tailwindcss
- typescript
- vite
- vitest

Każda nowa funkcja powinna mieć uzasadnienie (komentarz w kodzie albo w PR), dlaczego potrzebuje użycia nowej biblioteki.

---

Zawsze: "najpierw architektura, potem wygląd, potem testy".

Tak jak napisałeś: notoryczne pomijanie drobnych detali kończy się „rozpierdoleniem”; tu jest pełny checklist, więc każdy kontrybutor ma wskazówki krok-po-kroku i nie może pominąć.
