# Keybrix - Plan Architektury i Odwzorowania Dashboardu

## 1. Wizja i Dashboard (Analiza 1:1)

Dashboard z obrazka charakteryzuje się nowoczesnym, ciemnym designem z wyraźnymi akcentami (pomarańczowy i niebieski). Zbudwany jest z następujących sfer:
- **Sidebar (lewy)**: Nawigacja pionowa (Strona Główna, Ulubione, Ustawienia, Baza).
- **Header (góra)**: Nazwa "Dashboard", mały wskaźnik statusu "System Optimal", dzwonek powiadomień, pomoc, przycisk CTA "New Macro".
- **Statystyki (Top)**: Czyste liczniki liczbowe (Total Automations, Time Saved, Success Rate, Active Now) z użyciem dużej i cienkiej typografii (prawdopodobnie Inter/Roboto).
- **Grid Makr (Środek)**: Trzy-kolumnowa siatka (np. "Copy & Paste Pro", "Docker Clean"). Każda karta zawiera:
  - Tagi klawiszowe (np. `CTRL+SHIFT+C`) i estetyczny Toggle Switch (włącz/wyłącz).
  - Tytuł i dwulinijkowy szary opis.
  - Małe prostokątne ikonki szybkiej akcji (Play, Edytuj).
  - Wyraźny wskaźnik Statusu po prawej stronie (RUNNING, IDLE, ACTIVE, PAUSED).
  - Obszar pustej karty w formie dashed border (przycisk "+ Create Custom Block").
- **Konsola Logów (Dół)**: Obszar terminalopodobny – Recent Activity Logs. Prezentuje listy chronologiczne wiadomości z timestampami, typem zdarzeń (RUN, TRIG, INFO, WARN) w kolorach, w monospace'owej czcionce.

## 2. Proponowany Stack Technologiczny (Modern Stack)

- **Frontend / Interfejs**: 
  - `react`, `react-dom`
  - `tailwindcss` – idealny wybór do równego i perfekcyjnego pixel-perfect gridu i dark theme.
  - `lucide-react` – idealne powielenie estetyki ikonek z dashboardu (cienkie, proste kreski).
  - `framer-motion` (opcjonalnie) – płynne przejścia dla przełączników (toggle) i najechania myszką (`hover`) na makra.
  - `zustand` – ekstremalnie lekki menedżer stanu do trzymania w UI, które logi i makra "biegną" w danym momencie.
  - `blockly` oraz `react-blockly` – silnik do edytora blokowego "ala Scratch".

- **Backend (Electron Main Process)**:
  - `@nut-tree/nut-js` – do sterowania os systemową (klawiatura, mysz, wizja komputerowa).
  - `electron-store` – do lekkiego przechowywania danych.

- **Środowisko i Narzędzia Budowania**:
  - `electron-vite` (który już masz w projekcie) wyśmienicie łączy TypeScript i Vite (szybki Hot Module Replacement).

## 3. Przechowywanie Makr

Ponieważ Blockly operuje domyślnie na XML, a współcześnie również na czystym JSONie (do serializacji grafów), **zapis w formacie JSON** będzie najrozsądniejszy.

1. **Podejście Systemowe (Lokalne Pliki .json)**:
   - Przestrzeń magazynowa np. w `app.getPath('userData')/macros/`.
   - Każde makro to osobny plik (np. `copy-paste-pro.json`), zawierający metadata (klawisze, nazwa, status) oraz wygenerowane bloki programu.
   - *Zalety:* Możesz łatwo dodać opcję "Eksportuj/Importuj", wręczając komuś mailem po prostu jeden plik.

2. **Połączenie z `electron-store`**:
   - Skrypty trzymamy w JSON, a globalny słownik skrótów klawiszowych (wraz z referencjami, np. `{"CTRL+SHIFT+C" : "macros/copy-paste-pro.json"}`) ładujemy przy starcie z `electron-store` prosto z pamięci komputera. Gwarantuje to najszybszą pętlę ładowania aplikacji (System Optimal).

## 4. Architektura i Separacja Warstw (Najważniejsze Pytania)

Pisząc Keybrix w architekturze Electron + nut.js, kluczowe stają się 3 domeny zabezpieczające apke przed lagowaniem UI:

- **Jak oddzielić widok od logiki, by dashboard działał super gładko?**
  - **Preload.ts API (Context Bridge):** Dashboard (UI) widzi tylko abstrakcyjne API "zleceń" (np. `window.api.runMacro(id)`). Sam `nut.js` jest ukryty pod spodem w systemie głównym Main Process. Nigdy nie importuj `nut.js` po stronie Renderera.
  
- **W jaki sposób nasłuchiwać skrótów (jak `ALT+B`), kiedy program jest w tle?**
  - **Node.js layer:** Wykorzystamy moduł `globalShortcut` z Electrona po stronie `main/index.ts`. Nasłuchuje on skróty w systemie, a jeżeli użytkownik wykona skrót klawiszowy, to odpala powiązany obiekt generatora i ewentualnie odświeża interfejs logów wysyłając IPC event typu `macro:triggered`.

- **Skąd wziąć kod wykonawczy po utworzeniu makra w blokach?**
  - Trzeba zbudować własną warstwę tzw. "Code Generatora" u boku środowiska Blockly. Oznacza to, że po ułożeniu bloków, musimy przetłumaczyć ten graf na asynchroniczne wywołania JS w node (czyli tłumaczyć bloki typu `[Move Mouse x,y]` prosto na `await mouse.setPosition(new Point(x,y))`).

- **Jak działać z "Recent Activity Logs"?**
  - Możemy stworzyć dedykowany `LogService` na poziomie `main/` Electrona, posiadający stały rozmiar np. do 100 wpisów wstecz i poprzez IPC Push Events wysyłać najnowsze logi i błędy do Dashboardu (komponent `<ActivityLog />`).

## 5. Propozycja Struktury Folderów

Skupmy się na bardzo czytelnym podziale "Feature-Based" na frontnedzie.

```text
src/
├── main/                 # Node.js + natywne okna (Systemowe)
│   ├── index.ts          # Root
│   ├── keyboard/         # Rejestrator skrótów `globalShortcut` 
│   ├── macro-runner/     # Zespół parsowania JSON na komendy `nut.js`
│   └── store/            # Kontroler bazy lokalnej (electron-store)
├── preload/              # Most IPC
│   ├── index.ts          # Zabezpieczony `contextBridge` dla Renderera
│   └── index.d.ts
├── renderer/             # Frontend Dashboardu (React, Tailwind)
│   ├── index.html
│   ├── src/
│   │   ├── components/   # Współdzielone UI (komponenty 1:1 z obrazka)
│   │   │   ├── layout/   # Sidebar.tsx, Header.tsx
│   │   │   ├── macro/    # MacroCard.tsx, CreateMacroButton.tsx
│   │   │   ├── ui/       # Przyciski, Toggle, Tagi, StatCard
│   │   │   └── terminal/ # RecentActivityLogs.tsx
│   │   ├── features/     # Rozdzielone widoki całej logiki
│   │   │   ├── dashboard/# Zestawienie w widok /Dashboard
│   │   │   ├── editor/   # Środowisko React-Blockly (Canvas i Przybornik)
│   │   │   └── settings/ # Parametry konfiguracyjne aplikacji
│   │   ├── store/        # Zustand - Globalny state aplikacji (Uruchomione makra etc.)
│   │   └── App.tsx       # Root dla Routera (Dashboard vs Blockly Editor)
```
