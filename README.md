
# 🌳 High-Tree

A professional, high-performance virtual tree component for modern web applications. Zero dependencies, lightweight, and extensible.

[![npm version](https://img.shields.io/npm/v/high-tree.svg)](https://www.npmjs.com/package/high-tree)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **Virtual Scrolling** - Efficiently handles 10,000+ nodes by rendering only visible elements.
- ⚡ **Web Worker Support** - Offloads heavy tree operations to a background thread to maintain UI responsiveness.
- 🔍 **Persistent Editing** - Robust double-click editing with dedicated Save/Cancel controls and keyboard support.
- ⚡ **Lazy Loading** - On-demand node loading for optimal performance with massive datasets.
- 🎯 **Deep Event System** - Comprehensive callbacks: `onClick`, `onExpand`, `onCollapse`, `onSelect`, `onCheck`, `onDrop`, `onContextMenu`.
- ☑️ **Hierarchical Checkboxes** - Full support for indeterminate states and cascaded checking.
- 🖱️ **Multi-Selection** - Flexible selection modes including Ctrl/Cmd and Shift-range selection.
- 🔥 **High Performance**: Optimized virtual scroll for 100,000+ nodes.
- ⚡ **Zero Dependency**: Pure Vanilla JavaScript and CSS.
- 🎨 **Modern UX**: Tailwind CSS integration, smooth animations.
- 📝 **Advanced Node Editing**: 
    - **Persistent Edit Mode**: Double-click to start. Clicking inside the input field won't exit the mode.
    - **Explicit Controls**: On-row Save (V) and Cancel (X) buttons for clear user intent.
    - **Keyboard Shortcuts**: `Enter` to save, `Escape` to cancel while editing.
- 🛠️ **Fully Customizable**: Support for custom node rendering and flexible event callbacks.
- 🔍 **Real-time Search**: Instant tree filtering with match highlighting.
- 🏗️ **Tree CRUD**: Simple APIs for nodes addition, deletion, and movement.
- 🖱️ **Drag & Drop**: Advanced D&D with before/after/inside indicators.
- 🌐 **Multiple Formats** - ES modules and UMD support
- 📘 **TypeScript Ready** - Full TypeScript definitions included

## Demo
- https://cheonghakim.github.io/high-tree

## 📦 Installation

### Using npm
```bash
npm install high-tree
```

### Using yarn
```bash
yarn add high-tree
```

### Using CDN
```html
<script src="https://unpkg.com/high-tree/dist/high-tree.umd.js"></script>
```

## 🚀 Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="tree-container"></div>

  <script type="module">
    import VirtualTree from 'high-tree';

    const data = [
      {
        id: '1',
        label: 'Documents',
        children: [
          { id: '1-1', label: 'Work' },
          { id: '1-2', label: 'Personal' }
        ]
      }
    ];

    const tree = new VirtualTree(document.getElementById('tree-container'), {
      data: data,
      height: 600,
      rowHeight: 40,
      
      // Enable features
      selectable: true,
      multiSelect: true,
      checkbox: true,
      draggable: true,
      
      // Callbacks
      onClick: (node) => console.log('Clicked:', node.label),
      onSelect: (nodes) => console.log('Selected:', nodes)
    });
  </script>
</body>
</html>
```

## 📖 API Reference

### Constructor

```javascript
new VirtualTree(element, options)
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data` | `TreeNode[]` | `[]` | Initial tree data |
| `rowHeight` | `number` | `40` | Height of each row in pixels |
| `height` | `number` | `550` | Total container height in pixels |
| `lazy` | `boolean` | `false` | Enable lazy loading |
| `selectable` | `boolean` | `false` | Enable node selection |
| `multiSelect` | `boolean` | `false` | Allow multiple selection (requires `selectable: true`) |
| `cascadeSelect` | `boolean` | `false` | Auto-select children when parent is selected |
| `checkbox` | `boolean` | `false` | Show checkboxes |
| `draggable` | `boolean` | `false` | Enable drag and drop |
| `enableDefaultDragDrop` | `boolean` | `true` | Automatically move nodes on drop (requires `draggable: true`) |
| `filter` | `Function` | `null` | Custom filter function |
| `useWorker` | `boolean` | `true` | Use Web Worker for CPU-intensive operations |
| `workerPath` | `string` | `null` | Custom worker file path (auto-detected if not provided) |
| `onLoadData` | `Function` | `null` | Async function to load children |
| `onClick` | `Function` | `null` | Fires when node is clicked |
| `onExpand` | `Function` | `null` | Fires when node is expanded |
| `onCollapse` | `Function` | `null` | Fires when node is collapsed |
| `onSelect` | `Function` | `null` | Fires when selection changes |
| `onCheck` | `Function` | `null` | Fires when checkbox state changes |
| `onDrop` | `Function` | `null` | Fires when node is dropped |
| `onContextMenu` | `Function` | `null` | Fires on right-click |
| `renderNode` | `Function` | `null` | Custom node rendering function |

### TreeNode Structure

```typescript
interface TreeNode {
  id: string;           // Required: Unique identifier
  label: string;        // Required: Display text
  children?: TreeNode[]; // Optional: Child nodes
  hasChildren?: boolean; // Optional: For lazy loading
  level?: number;        // Auto-calculated: Depth level
  [key: string]: any;    // Custom properties allowed
}
```

### Methods

#### Tree Control
- `expandNode(nodeId: string)` - Expand a specific node
- `collapseNode(nodeId: string)` - Collapse a specific node
- `await expandAll()` - Expand all nodes (async, parallel loading for performance)
- `collapseAll()` - Collapse all nodes

#### Selection
- `selectNode(nodeId: string)` - Select a node
- `unselectNode(nodeId: string)` - Unselect a node
- `getSelectedNodes()` - Get array of selected nodes
- `clearSelection()` - Clear all selections

#### Checkboxes
- `checkNode(nodeId: string, cascade?: boolean)` - Check a node (cascade to children if true)
- `uncheckNode(nodeId: string, cascade?: boolean)` - Uncheck a node
- `getCheckedNodes()` - Get array of checked nodes

#### Filtering
- `setFilter(filterFn: Function)` - Apply custom filter
- `clearFilter()` - Remove filter

#### Data Management
- `setData(newData: TreeNode[])` - Replace tree data
- `getData()` - Get current tree data
- `findNodeById(nodeId: string)` - Find node by ID
- `refresh()` - Refresh the tree

## 💡 Usage Examples

### Event Callbacks

```javascript
const tree = new VirtualTree(element, {
  data: myData,
  
  onClick: (node, event) => {
    console.log('Node clicked:', node.label);
  },
  
  onExpand: (node) => {
    console.log('Expanded:', node.label);
  },
  
  onCollapse: (node) => {
    console.log('Collapsed:', node.label);
  },
  
  onSelect: (selectedNodes) => {
    console.log('Selection changed:', selectedNodes.length);
  }
});
```

### Lazy Loading

```javascript
const tree = new VirtualTree(element, {
  data: [{ id: '1', label: 'Folder', hasChildren: true }],
  lazy: true,
  
  onLoadData: async (node) => {
    const response = await fetch(`/api/nodes/${node.id}/children`);
    return await response.json();
  }
});
```

### Selection

```javascript
const tree = new VirtualTree(element, {
  data: myData,
  selectable: true,
  multiSelect: true, // Enable Ctrl+Click multi-select
  cascadeSelect: true, // Auto-select children when parent is selected
  
  onSelect: (selectedNodes) => {
    console.log('Selected:', selectedNodes.map(n => n.label));
  }
});

// Programmatic selection
tree.selectNode('node-123');
tree.getSelectedNodes(); // Returns array of selected nodes
tree.clearSelection();
```

### Checkboxes with Cascade

```javascript
const tree = new VirtualTree(element, {
  data: myData,
  checkbox: true,
  
  onCheck: (checkedNodes) => {
    console.log('Checked nodes:', checkedNodes.length);
  }
});

// Programmatic checking
tree.checkNode('parent-id', true); // Cascade to children
tree.getCheckedNodes(); // Returns all checked nodes
```

### Drag & Drop

```javascript
const tree = new VirtualTree(element, {
  data: myData,
  draggable: true,
  
  onDrop: (draggedNode, targetNode, position) => {
    console.log(`Dropped "${draggedNode.label}" onto "${targetNode.label}"`);
    // Update your data structure here
  }
});
```

### Context Menu

```javascript
const tree = new VirtualTree(element, {
  data: myData,
  
  onContextMenu: (node, event) => {
    event.preventDefault();
    // Show custom context menu
    showCustomMenu(node, event.clientX, event.clientY);
  }
});
```

### Custom Filtering

```javascript
const tree = new VirtualTree(element, {
  data: myData
});

// Filter to show only folders
tree.setFilter(node => node.type === 'folder');

// Clear filter
tree.clearFilter();
```

### Custom Rendering

```javascript
const tree = new VirtualTree(element, {
  data: myData,
  
  renderNode: (node, searchTerm) => {
    const icon = node.type === 'folder' ? '📁' : '📄';
    const highlight = searchTerm 
      ? node.label.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>')
      : node.label;
    
    return `
      <div class="flex items-center gap-2">
        <span>${icon}</span>
        <span>${highlight}</span>
        ${node.badge ? `<span class="badge">${node.badge}</span>` : ''}
      </div>
    `;
  }
});
```

### Large Dataset (10,000+ Nodes)

```javascript
const largeData = Array.from({ length: 10000 }, (_, i) => ({
  id: `node-${i}`,
  label: `Category ${i + 1}`,
  hasChildren: true
}));

const tree = new VirtualTree(element, {
  data: largeData,
  height: 600,
  rowHeight: 40,
  lazy: true,
  
  onLoadData: async (node) => {
    await new Promise(r => setTimeout(r, 300));
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${node.id}-child-${i}`,
      label: `Child ${i + 1}`,
      hasChildren: node.level < 2
    }));
  }
});
```

## ⌨️ Keyboard Shortcuts

When the tree has focus:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate between visible nodes |
| `←` / `→` | Collapse/Expand the focused node |
| `Enter` | Toggle expansion or save current edit |
| `Space` | Select/check the focused node |
| `Esc` | Cancel current edit mode |
| `Ctrl` + `Click` | Toggle selection for multiple nodes |
| `Shift` + `Click` | Select a range of nodes |

## 🎨 Styling

High-Tree uses Tailwind CSS classes by default. Include Tailwind in your project:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

Or install it locally:

```bash
npm install -D tailwindcss
```

### Custom Styles

Override default styles with CSS:

```css
.tree-node-container {
  /* Custom styles for nodes */
}

[data-id] {
  /* Style individual node elements */
}

[data-id]:hover {
  background: your-color;
}
```

## 🔧 Development

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## 📄 License

MIT © cheonghakim

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

Found a bug? Please [open an issue](https://github.com/cheonghakim/high-tree/issues).

## 🙏 Acknowledgments

Built for performance and flexibility using modern web standards.

---

**Star this repo** ⭐ if you find it useful!
