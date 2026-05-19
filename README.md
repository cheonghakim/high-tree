# High-Tree 🌲

고성능 가상 트리 컴포넌트 · A high-performance virtual tree component for modern web applications.  
Zero dependencies · Vanilla JavaScript · TypeScript types included

---

# Demo

[데모사이트 바로가기(Demo site)](https://cheonghakim.github.io/high-tree/)

[![npm version](https://img.shields.io/npm/v/high-tree.svg)](https://www.npmjs.com/package/high-tree)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## 왜 High-Tree인가? / Why High-Tree?

일반적인 DOM 기반 트리는 데이터가 많아질수록 브라우저가 멈춥니다. High-Tree는 두 가지 기법으로 이 문제를 해결합니다.

Standard DOM-based trees freeze the browser when datasets grow large. High-Tree solves this with two techniques:

- **가상 스크롤링 / Virtual Scrolling** — 뷰포트에 보이는 행만 DOM에 존재합니다. 10만 개 트리도 약 20개의 DOM 노드만 사용합니다.  
  Only the rows visible in the viewport exist in the DOM. A 100,000-node tree renders ~20 DOM nodes at a time.

- **Web Worker 오프로딩 / Web Worker Offloading** — 체크박스 cascade 등 무거운 연산을 메인 스레드 밖에서 처리해 UI가 끊기지 않습니다.  
  Heavy operations like checkbox cascade run off the main thread, keeping the UI responsive.

| 지표 / Metric                                     | 일반 재귀 DOM / Standard recursive DOM | High-Tree                 |
| :------------------------------------------------ | :------------------------------------- | :------------------------ |
| 초기 렌더 100k 노드 / Initial render (100k nodes) | ~297 ms                                | **~24 ms** (12× faster)   |
| 생성된 DOM 노드 / Live DOM nodes                  | 420,001                                | **~169** (2,485× lighter) |

---

## 설치 / Installation

```bash
npm install high-tree
# 또는 / or
yarn add high-tree
```

**CDN (UMD 빌드 / UMD build)**

```html
<script src="https://unpkg.com/high-tree/dist/high-tree.umd.js"></script>
```

### Tailwind CSS 의존성 / Tailwind CSS Dependency

High-Tree는 검색 바, 스크롤 컨테이너, 노드 행 등 내장 UI에 Tailwind CSS 유틸리티 클래스를 사용합니다. 컴포넌트를 사용하는 페이지에 Tailwind가 반드시 있어야 합니다.

High-Tree uses Tailwind CSS utility classes for its built-in UI (search bar, scroll container, node rows). Tailwind must be available in the page that uses the component.

**옵션 A — CDN (프로토타이핑에 적합 / Quick for prototyping)**

```html
<script src="https://cdn.tailwindcss.com"></script>
```

**옵션 B — npm 설치 (프로덕션 권장 / Recommended for production)**

```bash
npm install tailwindcss
```

High-Tree 클래스가 purge되지 않도록 `content` 경로에 추가합니다.  
Add `high-tree` to your Tailwind `content` paths to prevent class purging:

```js
// tailwind.config.js
export default {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "./node_modules/high-tree/high-tree.js", // High-Tree 클래스 보존 / keep High-Tree classes
  ],
};
```

---

## 빠른 시작 / Quick Start

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="my-tree"></div>

    <script type="module">
      import VirtualTree from "high-tree";

      const tree = new VirtualTree(document.getElementById("my-tree"), {
        height: 500,
        data: [
          {
            id: "docs",
            label: "문서",
            level: 0,
            children: [
              { id: "docs-work", label: "업무", level: 1 },
              { id: "docs-personal", label: "개인", level: 1 },
            ],
          },
          { id: "readme", label: "README.md", level: 0 },
        ],
        selectable: true,
        onSelect: (nodes) => console.log("선택됨", nodes),
      });
    </script>
  </body>
</html>
```

> **`level`은 모든 노드에 필수입니다 / `level` is required on every node.**  
> 들여쓰기를 제어합니다 (0 = 루트, 1 = 자식, 2 = 손자 …). 생략하면 들여쓰기가 깨집니다.  
> It controls indentation (0 = root, 1 = child, 2 = grandchild …). Omitting it will break the layout.

---

## 노드 데이터 구조 / Node Data Structure

모든 노드 객체는 `id`, `label`, `level`을 반드시 포함해야 합니다.  
Every node object must include `id`, `label`, and `level`.

```ts
interface TreeNode {
  id: string; // 고유 식별자 (문자열) / unique identifier — must be a string
  label: string; // 표시 텍스트 / display text
  level: number; // 깊이: 0=루트, 1=자식 … / depth: 0=root, 1=child …
  children?: TreeNode[]; // 미리 로드된 자식 (정적 트리) / pre-loaded children (static tree)
  hasChildren?: boolean; // true = 아직 로드되지 않은 자식이 있음 (lazy 모드) / true = has unloaded children (lazy mode)
  [key: string]: any; // 커스텀 프로퍼티 자유롭게 추가 가능 / any extra properties are preserved
}
```

**정적 트리 / Static tree** — `children` 배열을 처음부터 제공합니다:

```js
{ id: '1', label: '폴더', level: 0, children: [
  { id: '1-1', label: '파일.txt', level: 1 }
]}
```

**Lazy 트리 / Lazy tree** — `hasChildren: true`를 설정하고 펼칠 때 로드합니다:

```js
// 초기 데이터: children 배열 없이 플래그만 / Initial data: flag only, no children array
{ id: '1', label: '폴더', level: 0, hasChildren: true }

// 로더 제공 / Provide the loader:
const tree = new VirtualTree(el, {
  lazy: true,
  data: initialData,
  onLoadData: async (node) => {
    const res = await fetch(`/api/children?id=${node.id}`);
    const items = await res.json();
    // 반환하는 각 항목에도 id, label, level 필수 / each item must include id, label, level
    return items;
  },
});
```

---

## Web Worker 설정 / Web Worker Setup

10,000개 이상의 노드를 가진 트리에서 체크박스 cascade 등을 자동으로 Web Worker에 오프로드합니다. `high-tree-worker.js`가 페이지와 동일한 origin에서 서빙되어야 합니다.

For trees with 10,000+ nodes, High-Tree automatically offloads operations to a Web Worker. The worker file (`high-tree-worker.js`) must be served from the same origin as your page.

**npm / 번들러 사용 시 / When using npm / a bundler** — worker 파일을 public 폴더에 복사합니다:

```bash
cp node_modules/high-tree/high-tree-worker.js public/
```

자동 감지에 실패하면 (복잡한 번들러 환경 등) 경로를 명시적으로 지정합니다.  
If auto-detection fails, set the path explicitly:

```js
const tree = new VirtualTree(el, {
  workerPath: "/assets/high-tree-worker.js",
});
```

Worker를 완전히 비활성화하려면 / To disable the worker entirely:

```js
const tree = new VirtualTree(el, { useWorker: false });
```

---

## 옵션 레퍼런스 / Options Reference

### 표시 / Display

| 옵션 / Option | 타입 / Type  | 기본값 / Default | 설명 / Description                          |
| :------------ | :----------- | :--------------- | :------------------------------------------ |
| `data`        | `TreeNode[]` | `[]`             | 초기 트리 데이터 / Initial tree data        |
| `height`      | `number`     | `550`            | 컨테이너 높이 (px) / Container height in px |
| `rowHeight`   | `number`     | `40`             | 행 높이 (px) / Row height in px             |

### 기능 / Features

| 옵션 / Option           | 타입 / Type | 기본값 / Default | 설명 / Description                                                                                                                                              |
| :---------------------- | :---------- | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lazy`                  | `boolean`   | `false`          | `onLoadData`를 통한 지연 로딩 활성화 / Enable on-demand child loading via `onLoadData`                                                                          |
| `selectable`            | `boolean`   | `false`          | 행 선택 활성화 / Enable row selection                                                                                                                           |
| `multiSelect`           | `boolean`   | `false`          | Ctrl/Cmd·Shift 다중 선택 / Allow Ctrl/Cmd + click and Shift + click multi-select                                                                                |
| `cascadeSelect`         | `boolean`   | `false`          | 부모 선택 시 자식 자동 선택 / Auto-select all descendants when a parent is selected                                                                             |
| `checkbox`              | `boolean`   | `false`          | indeterminate 상태 포함 체크박스 / Show checkboxes with indeterminate parent state                                                                              |
| `draggable`             | `boolean`   | `false`          | 드래그 앤 드롭 / Enable drag-and-drop reordering                                                                                                                |
| `enableDefaultDragDrop` | `boolean`   | `true`           | drop 시 노드 이동 자동 적용. `false`로 설정하면 `onDrop`에서 직접 처리. / Automatically apply node moves on drop. Set `false` to handle reordering in `onDrop`. |
| `editable`              | `boolean`   | `false`          | 더블 클릭 인라인 라벨 편집 / Enable double-click inline label editing                                                                                           |

### Worker

| 옵션 / Option | 타입 / Type | 기본값 / Default | 설명 / Description                                                              |
| :------------ | :---------- | :--------------- | :------------------------------------------------------------------------------ |
| `useWorker`   | `boolean`   | `true`           | 대규모 트리 연산에 Web Worker 사용 / Use a Web Worker for large-tree operations |
| `workerPath`  | `string`    | `null`           | `high-tree-worker.js` 경로 직접 지정 / Explicit path to `high-tree-worker.js`   |

### 다국어 / Locale

| 옵션 / Option | 타입 / Type | 기본값 / Default | 설명 / Description                                                                           |
| :------------ | :---------- | :--------------- | :------------------------------------------------------------------------------------------- |
| `locale`      | `object`    | `{}`             | UI 문자열 재정의 / Override UI strings — [다국어 설정](#다국어-설정--localization-i18n) 참고 |

### 콜백 / Callbacks

| 옵션 / Option   | 시그니처 / Signature                  | 설명 / Description                                                                                                                                                        |
| :-------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onLoadData`    | `async (node) => TreeNode[]`          | **`lazy: true` 사용 시 필수.** 해당 노드의 자식 배열을 반환합니다. / **Required when `lazy: true`.** Return child nodes for the given node.                               |
| `onClick`       | `(node, event) => void`               | 행 클릭 시 호출 / Fired on row click                                                                                                                                      |
| `onExpand`      | `(node) => void`                      | 노드 펼침 시 호출 / Fired when a node expands                                                                                                                             |
| `onCollapse`    | `(node) => void`                      | 노드 접힘 시 호출 / Fired when a node collapses                                                                                                                           |
| `onSelect`      | `(nodes) => void`                     | 선택 변경 시 호출. 현재 선택된 노드 전체를 받습니다. / Fired when selection changes. Receives all currently selected nodes.                                               |
| `onCheck`       | `(nodes, meta) => void`               | 체크 상태 변경 시 호출. `meta`에 `{ timeTaken, isWorker }` 포함. / Fired when checkbox state changes. `meta` contains `{ timeTaken, isWorker }`.                          |
| `onDrop`        | `(dragged, target, position) => void` | `position`은 `'before'` · `'after'` · `'inside'` 중 하나. / `position` is `'before'`, `'after'`, or `'inside'`.                                                           |
| `onContextMenu` | `(node, event) => void`               | 우클릭 시 호출 / Fired on right-click                                                                                                                                     |
| `onEdit`        | `(node, newLabel, oldLabel) => void`  | 인라인 편집 저장 후 호출 / Fired after an inline edit is saved                                                                                                            |
| `renderNode`    | `(node, searchTerm) => string`        | 노드 콘텐츠 영역을 커스텀 HTML로 교체 / Return an HTML string to replace the default node content — [커스텀 노드 렌더링](#커스텀-노드-렌더링--custom-node-rendering) 참고 |
| `filter`        | `(node) => boolean`                   | 초기 필터 함수 / Initial filter function                                                                                                                                  |

---

## 메서드 / Methods

### 트리 제어 / Tree control

```js
await tree.expandNode(id); // 특정 노드 펼침 (lazy 로딩 포함) / Expand one node (handles lazy loading)
tree.collapseNode(id); // 특정 노드 접음 / Collapse one node
await tree.expandAll(); // 모든 노드 펼침 (비동기) / Expand every node (async — triggers lazy loaders)
tree.collapseAll(); // 모든 노드 접음 / Collapse every node
tree.scrollToNode(id); // 해당 노드가 보이도록 뷰포트 스크롤 / Scroll the viewport to bring a node into view
```

### 선택 / Selection

```js
tree.selectNode(id); // 프로그래밍 방식으로 노드 선택 / Programmatically select a node
tree.unselectNode(id); // 노드 선택 해제 / Deselect a node
tree.getSelectedNodes(); // → TreeNode[]
tree.clearSelection(); // 모든 선택 해제 / Clear all selections
```

### 체크박스 / Checkboxes

```js
tree.checkNode(id, cascade?) // 노드 체크 (cascade=true면 자식까지 전파) / Check a node (cascade propagates to children)
tree.uncheckNode(id, cascade?) // 노드 체크 해제 / Uncheck a node
tree.getCheckedNodes()       // → TreeNode[] (완전 체크된 노드만, indeterminate 제외 / fully checked only)
```

### 데이터 관리 / Data management

```js
tree.setData(newData); // 전체 트리 데이터 교체 / Replace the entire tree
tree.getData(); // → TreeNode[] (변경 사항 포함 현재 데이터 / current data including mutations)
tree.findNodeById(id); // → TreeNode | null
tree.addNode(parentId, node); // 노드 추가. parentId=null이면 루트에 추가. / Add a node. parentId=null adds at root.
tree.removeNode(id); // 노드와 모든 자손 삭제 / Remove a node and all its descendants
tree.refresh(); // 강제 리렌더링 / Force a full re-render
```

### 필터링 & 검색 / Filtering & Search

검색 바는 기본 내장되어 있습니다. 프로그래밍 방식 필터는 아래와 같이 사용합니다.  
The search bar is built-in. For programmatic filtering:

```js
tree.setFilter((node) => node.type === "folder"); // 폴더만 표시 / Show only folders
tree.clearFilter(); // 필터 제거 / Remove the custom filter
```

### 상태 저장 / State persistence

```js
const saved = tree.exportState(); // { expandedIds, selectedIds, checkedIds } 반환 / Returns state object
tree.importState(saved); // 이전에 내보낸 상태 복원 / Restore a previously exported state
```

### 생명주기 / Lifecycle

```js
tree.terminateWorker(); // Web Worker 종료. 컴포넌트 언마운트 시 호출. / Stop the Web Worker. Call when unmounting.
```

---

## 다국어 설정 / Localization (i18n)

`locale` 옵션으로 UI 문자열을 재정의합니다. 설정하지 않은 키는 영어 기본값으로 표시됩니다.

Override any UI string via the `locale` option. Unset keys fall back to English defaults.

```js
const tree = new VirtualTree(el, {
  locale: {
    searchPlaceholder: "검색...",
    emptyText: "검색 결과가 없습니다.",
  },
});
```

**사용 가능한 locale 키 / Available locale keys**

| 키 / Key            | 기본값 / Default      | 설명 / Description                                                                      |
| :------------------ | :-------------------- | :-------------------------------------------------------------------------------------- |
| `searchPlaceholder` | `'Search...'`         | 검색 입력창 플레이스홀더 / Placeholder text in the search input                         |
| `emptyText`         | `'No results found.'` | 검색 결과가 없을 때 표시되는 문구 / Message shown when the filtered result set is empty |

**언어별 예시 / Examples by language**

```js
// 한국어
locale: { searchPlaceholder: '검색...', emptyText: '검색 결과가 없습니다.' }

// 日本語
locale: { searchPlaceholder: '検索...', emptyText: '結果が見つかりません。' }

// Deutsch
locale: { searchPlaceholder: 'Suchen...', emptyText: 'Keine Ergebnisse gefunden.' }

// 中文 (简体)
locale: { searchPlaceholder: '搜索...', emptyText: '没有找到结果。' }

// Français
locale: { searchPlaceholder: 'Rechercher...', emptyText: 'Aucun résultat.' }
```

---

## 커스텀 노드 렌더링 / Custom Node Rendering

`renderNode`를 사용하면 각 행의 콘텐츠 영역을 원하는 HTML로 교체할 수 있습니다.  
Use `renderNode` to replace the content area of each row with your own HTML.

```js
renderNode: (node, searchTerm) => {
  // 검색어 하이라이트 / highlight matches
  const text = searchTerm
    ? node.label.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>')
    : node.label;

  const icon = node.type === 'folder' ? '📁' : '📄';
  return `<span>${icon} ${text}</span>`;
},
```

> **보안 주의 / Security note:**  
> `renderNode`가 반환한 문자열은 `innerHTML`로 삽입됩니다. 노드 레이블이 사용자 입력이나 외부 API에서 오는 경우, HTML 엔티티 이스케이프 처리를 직접 해야 합니다. 기본 렌더러는 자동으로 이스케이프 처리합니다.  
> The string returned by `renderNode` is injected via `innerHTML`. If node labels come from untrusted input, you are responsible for escaping HTML entities. The built-in default renderer handles this automatically.

---

## 키보드 단축키 / Keyboard Shortcuts

| 키 / Key        | 동작 / Action                                          |
| :-------------- | :----------------------------------------------------- |
| `↑` / `↓`       | 포커스 이동 / Move focus up / down                     |
| `→`             | 노드 펼치기 / Expand node                              |
| `←`             | 노드 접기 / Collapse node                              |
| `Enter`         | 펼침 토글 / 편집 저장 / Toggle expand / confirm edit   |
| `Space`         | 선택 / 체크 / Select or check focused node             |
| `Escape`        | 편집 취소 / Cancel inline edit                         |
| `Ctrl + Click`  | 다중 선택에 추가/제거 / Add to / remove from selection |
| `Shift + Click` | 범위 선택 / Range select                               |

---

## TypeScript 사용 / TypeScript Usage

High-Tree는 타입 정의를 기본 포함합니다.  
High-Tree ships with type definitions.

```ts
import VirtualTree, { type VirtualTreeOptions, type TreeNode } from "high-tree";

const options: VirtualTreeOptions = {
  data: [],
  height: 600,
  lazy: true,
  locale: {
    searchPlaceholder: "검색...",
    emptyText: "검색 결과가 없습니다.",
  },
  onLoadData: async (node: TreeNode): Promise<TreeNode[]> => {
    const res = await fetch(`/api/nodes/${node.id}`);
    return res.json();
  },
};

const tree = new VirtualTree(document.getElementById("tree")!, options);
```

---

## 자주 묻는 문제 / Troubleshooting

**노드가 들여쓰기 없이 표시됩니다 / Nodes appear with no indentation**  
→ 모든 노드 객체에 `level` 필드가 있는지 확인하세요 (루트: `level: 0`, 자식: `level: 1`, …).  
→ Every node object must include a `level` field (root: `level: 0`, child: `level: 1`, …).

**Lazy 노드를 펼쳐도 자식이 나타나지 않습니다 / Lazy nodes expand but show no children**  
→ `lazy: true` 옵션과 `onLoadData` 콜백이 모두 설정되어 있는지 확인하세요. 또한 초기 데이터의 lazy 노드에 `hasChildren: true`가 있는지 확인하세요. `children: []`처럼 빈 배열이 있으면 leaf 노드로 인식해 로더를 호출하지 않습니다.  
→ Verify that both `lazy: true` and `onLoadData` are set. Also confirm each lazy node has `hasChildren: true` — an empty `children: []` marks the node as a leaf and bypasses the loader.

**Web Worker가 활성화되지 않고 Sync Mode로 유지됩니다 / Web Worker not activating (stays in Sync Mode)**  
→ `high-tree-worker.js`가 동일 origin에서 서빙되는지 확인하고 브라우저 콘솔에서 worker 로드 오류를 확인하세요. 자동 감지가 실패하면 `workerPath`를 명시적으로 지정하세요. 참고: Worker는 가시 노드 수가 10,000개 이상일 때만 활성화됩니다.  
→ Ensure `high-tree-worker.js` is served from the same origin. Check the console for a worker load error. Set `workerPath` explicitly if auto-detection fails. Note: the worker only activates for trees with 10,000+ visible nodes.

**`expandAll()`이 대규모 lazy 트리에서 오래 걸립니다 / `expandAll()` is slow on a large lazy tree**  
→ `expandAll()`은 미로드 lazy 노드마다 순차적으로 `onLoadData`를 호출합니다. 매우 큰 데이터셋에서는 특정 깊이까지만 펼치는 방식을 권장합니다.  
→ `expandAll()` sequentially triggers `onLoadData` for every unexpanded lazy node. On very large datasets, consider only expanding to a limited depth instead.

**검색이 접힌 노드 안의 항목을 찾지 못합니다 / Search doesn't find nodes inside collapsed branches**  
→ 의도된 동작입니다. 내장 검색은 현재 플랫 목록에서 매칭 노드를 필터링해 보여줍니다. lazy 모드에서 아직 로드되지 않은 노드는 검색 대상에 포함되지 않습니다.  
→ This is by design. The built-in search filters the current flat visible list. Lazy nodes that were never loaded are not included in the search scope.

**커스텀 `renderNode`에서 선택/체크 클릭이 동작하지 않습니다 / Custom `renderNode` breaks selection or checkbox clicks**  
→ 반환하는 HTML이 행 전체를 채우는 `<div>`로 감싸지 않도록 주의하세요. 콘텐츠는 내장 체크박스·토글 화살표 옆에 있는 *내부 영역*만 교체합니다. 최상위 요소에 `display: flex; align-items: center;`를 유지하세요.  
→ Do not return a wrapping `<div>` that fills the entire row — your content replaces only the inner area next to the built-in checkbox and toggle arrow. Keep the outermost element `display: flex; align-items: center;`.

---

## 개발 / Development

```bash
yarn install   # 의존성 설치 / install dependencies
yarn dev       # 개발 서버 시작 (http://localhost:5173) / start dev server
yarn build     # ESM + UMD + IIFE 번들 빌드 → dist/ / build bundles to dist/
```

---

## 라이선스 / License

MIT © cheongha.kim
