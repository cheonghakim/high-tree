// TypeScript definitions for High-Tree
export default class VirtualTree {
    constructor(element: HTMLElement, options: VirtualTreeOptions);

    // Public API Methods
    expandNode(nodeId: string): void;
    collapseNode(nodeId: string): void;
    expandAll(): Promise<void>;
    collapseAll(): void;
    selectNode(nodeId: string): void;
    unselectNode(nodeId: string): void;
    getSelectedNodes(): TreeNode[];
    clearSelection(): void;
    checkNode(nodeId: string, cascade?: boolean): void;
    uncheckNode(nodeId: string, cascade?: boolean): void;
    getCheckedNodes(): TreeNode[];
    setFilter(filterFn: FilterFunction | null): void;
    clearFilter(): void;
    refresh(): void;
    setData(newData: TreeNode[]): void;
    getData(): TreeNode[];
    findNodeById(nodeId: string): TreeNode | null;
}

export interface VirtualTreeOptions {
    // Required
    data: TreeNode[];

    // Display options
    rowHeight?: number; // default: 40
    height?: number; // default: 550

    // Feature flags
    lazy?: boolean; // default: false
    selectable?: boolean; // default: false
    multiSelect?: boolean; // default: false
    cascadeSelect?: boolean; // default: false - when selecting parent, also select children
    checkbox?: boolean; // default: false
    draggable?: boolean; // default: false
    enableDefaultDragDrop?: boolean; // default: true - automatically move nodes on drop
    filter?: FilterFunction | null; // default: null

    // Callbacks
    onLoadData?: LoadDataCallback | null;
    onClick?: NodeEventCallback | null;
    onExpand?: NodeCallback | null;
    onCollapse?: NodeCallback | null;
    onSelect?: SelectedNodesCallback | null;
    onCheck?: CheckedNodesCallback | null;
    onDrop?: DropCallback | null;
    onContextMenu?: ContextMenuCallback | null;
    renderNode?: RenderNodeCallback | null;
}

export interface TreeNode {
    id: string;
    label: string;
    children?: TreeNode[];
    hasChildren?: boolean;
    level?: number;
    [key: string]: any; // Allow custom properties
}

export type FilterFunction = (node: TreeNode) => boolean;

export type LoadDataCallback = (node: TreeNode) => Promise<TreeNode[]>;

export type NodeCallback = (node: TreeNode) => void;

export type NodeEventCallback = (node: TreeNode, event: MouseEvent) => void;

export type SelectedNodesCallback = (selectedNodes: TreeNode[]) => void;

export type CheckedNodesCallback = (checkedNodes: TreeNode[]) => void;

export type DropCallback = (
    draggedNode: TreeNode,
    targetNode: TreeNode,
    position: 'before' | 'after' | 'inside'
) => void;

export type ContextMenuCallback = (node: TreeNode, event: MouseEvent) => void;

export type RenderNodeCallback = (node: TreeNode, searchTerm: string) => string;
