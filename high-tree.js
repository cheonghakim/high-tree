export default class VirtualTree {
    constructor(element, options) {
        this.container = element;
        this.options = {
            data: options.data || [],
            rowHeight: options.rowHeight || 40,
            height: options.height || 550,
            lazy: options.lazy || false,

            // Callbacks
            onLoadData: options.onLoadData || null,
            onClick: options.onClick || null,
            onExpand: options.onExpand || null,
            onCollapse: options.onCollapse || null,
            onSelect: options.onSelect || null,
            onCheck: options.onCheck || null,
            onDrop: options.onDrop || null,
            onContextMenu: options.onContextMenu || null,

            // Features
            renderNode: options.renderNode || null,
            selectable: options.selectable || false,
            multiSelect: options.multiSelect || false,
            cascadeSelect: options.cascadeSelect || false,
            checkbox: options.checkbox || false,
            draggable: options.draggable || false,
            enableDefaultDragDrop: options.enableDefaultDragDrop !== undefined ? options.enableDefaultDragDrop : true, // default: true
            filter: options.filter || null,
            editable: options.editable || false,
            onEdit: options.onEdit || null,

            // Worker options
            useWorker: options.useWorker !== undefined ? options.useWorker : true,
            workerPath: options.workerPath || null,
        };

        // Internal state
        this.state = {
            treeData: [...this.options.data],
            expandedIds: new Set(),
            loadingIds: new Set(),
            selectedIds: new Set(),
            checkedIds: new Set(),
            searchTerm: '',
            scrollTop: 0,
            visibleNodes: [],
            focusedId: null,
            focusedIndex: -1,
            draggingNode: null,
            dragOverNode: null,
            dragTargetPosition: null, // 'inside', 'before', 'after'
            editingId: null,
            lastSelectedId: null,
            indeterminateIds: new Set(),
            customFilter: this.options.filter,
        };

        // Worker state
        this.worker = null;
        this.workerReady = false;
        this.useWorkerForOperations = false;
        this.workerMessageId = 0;
        this.workerCallbacks = new Map();
        this.pendingWorkerOperation = false;

        this.initWorker();
        this.init();
    }

    /**
     * Initializes the Web Worker for off-thread tree operations.
     */
    initWorker() {
        if (!this.options.useWorker || typeof Worker === 'undefined') {
            console.log('[high-tree] Worker disabled or not supported, using synchronous mode');
            this.useWorkerForOperations = false;
            return;
        }

        try {
            // Determine worker path
            let workerPath = this.options.workerPath;

            if (!workerPath) {
                // Auto-detect worker path
                const scriptTag = document.currentScript;
                if (scriptTag && scriptTag.src) {
                    const scriptUrl = new URL(scriptTag.src);
                    workerPath = new URL('high-tree-worker.js', scriptUrl).href;
                } else {
                    // Fallback: assume worker is in same directory
                    workerPath = new URL('high-tree-worker.js', import.meta.url).href;
                }
            }

            this.worker = new Worker(workerPath);

            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
            this.worker.onerror = (error) => {
                console.error('[high-tree] Worker error:', error);
                this.useWorkerForOperations = false;
                // Fallback to synchronous mode
            };

            console.log('[high-tree] Worker initialized');
        } catch (error) {
            console.warn('[high-tree] Failed to initialize worker:', error);
            this.useWorkerForOperations = false;
        }
    }

    // Handle worker messages
    handleWorkerMessage(e) {
        const { type, id, result, error } = e.data;

        if (type === 'ready') {
            this.workerReady = true;
            this.useWorkerForOperations = true;
            console.log('[high-tree] Worker ready');
            return;
        }

        if (type === 'error') {
            console.error('[high-tree] Worker error:', error);
            const callback = this.workerCallbacks.get(id);
            if (callback && callback.reject) {
                callback.reject(new Error(error.message));
                this.workerCallbacks.delete(id);
            }
            return;
        }

        // Handle specific result types
        const callback = this.workerCallbacks.get(id);
        if (callback) {
            callback.resolve(result);
            this.workerCallbacks.delete(id);
        }
    }

    // Send message to worker with promise-based callback
    postWorkerMessage(type, payload) {
        return new Promise((resolve, reject) => {
            const id = ++this.workerMessageId;
            this.workerCallbacks.set(id, { resolve, reject });

            // Timeout after 5 seconds
            const timeout = setTimeout(() => {
                if (this.workerCallbacks.has(id)) {
                    this.workerCallbacks.delete(id);
                    reject(new Error('Worker timeout'));
                }
            }, 5000);

            // Clear timeout on resolve/reject
            const originalResolve = resolve;
            const originalReject = reject;
            this.workerCallbacks.set(id, {
                resolve: (result) => {
                    clearTimeout(timeout);
                    originalResolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    originalReject(error);
                }
            });

            this.worker.postMessage({ type, id, payload });
        });
    }

    // Terminate worker
    terminateWorker() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.workerReady = false;
            this.useWorkerForOperations = false;
        }
    }

    // Initialize DOM structure and event bindings
    init() {
        this.container.innerHTML = `
      <div class="flex flex-col border border-gray-200 rounded-lg bg-white overflow-hidden" style="height: ${this.options.height}px" tabindex="0" id="tree-container">
        <!-- Search Bar -->
        <div class="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <input type="text" id="tree-search" placeholder="Search..." class="flex-1 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors">
          <div id="tree-count" class="text-[11px] text-gray-400 tabular-nums shrink-0">0</div>
        </div>

        <!-- Scroll Viewport -->
        <div id="tree-viewport" class="relative flex-1 overflow-auto custom-scrollbar">
          <div id="tree-spacer" style="width: 100%; pointer-events: none;"></div>
          <div id="tree-content-layer" class="absolute top-0 left-0 w-full tree-node-container"></div>
        </div>
      </div>
    `;

        this.treeContainer = this.container.querySelector('#tree-container');
        this.viewport = this.container.querySelector('#tree-viewport');
        this.spacer = this.container.querySelector('#tree-spacer');
        this.contentLayer = this.container.querySelector('#tree-content-layer');
        this.searchInput = this.container.querySelector('#tree-search');
        this.countDisplay = this.container.querySelector('#tree-count');

        // Event listeners
        this.viewport.addEventListener('scroll', () => {
            this.state.scrollTop = this.viewport.scrollTop;
            this.render();
        });

        this.searchInput.addEventListener('input', (e) => {
            this.setState({ searchTerm: e.target.value, scrollTop: 0 });
            this.viewport.scrollTop = 0;
        });

        // Definitive Click Handling (Single vs Double-Click Timer)
        this._clickTimer = null;
        this._lastClickId = null;

        this.contentLayer.addEventListener('click', (e) => {
            const nodeEl = e.target.closest('[data-id]');
            if (!nodeEl) return;
            
            const nodeId = String(nodeEl.dataset.id);

            // Priority 1: Checkbox & Toggle Arrow (IMMEDIATE)
            if (e.target.closest('.tree-checkbox')) {
                e.stopPropagation();
                this.handleCheckboxClick(nodeId);
                return;
            }
            if (e.target.closest('.w-5.h-5')) {
                e.stopPropagation();
                this.toggleNode(nodeId);
                return;
            }

            // Priority 2: Edit Buttons (IMMEDIATE)
            if (e.target.closest('.tree-edit-save')) {
                e.stopPropagation();
                this.saveEditing(nodeId, nodeEl.querySelector('.tree-edit-input')?.value || '');
                return;
            }
            if (e.target.closest('.tree-edit-cancel')) {
                e.stopPropagation();
                this.cancelEditing();
                return;
            }
            if (e.target.closest('.tree-edit-input')) {
                e.stopPropagation();
                return;
            }

            // Priority 3: Label Interactions (Timer-based)
            if (this.options.editable) {
                if (this._lastClickId === nodeId && this._clickTimer) {
                    // Double Click!
                    clearTimeout(this._clickTimer);
                    this._clickTimer = null;
                    this._lastClickId = null;
                    this.startEditing(nodeId);
                } else {
                    // Start Single Click Timer
                    if (this._clickTimer) clearTimeout(this._clickTimer);
                    this._lastClickId = nodeId;
                    this._clickTimer = setTimeout(() => {
                        this._clickTimer = null;
                        this._lastClickId = null;
                        this.handleNodeClick(nodeId, e);
                    }, 250);
                }
                return;
            }

            // Default: Selection / Click
            this.handleNodeClick(nodeId, e);
        });

        // Keyboard navigation & Editing support
        this.viewport.addEventListener('keydown', (e) => {
            if (this.state.editingId) {
                const isEnter = e.key === 'Enter';
                const isEsc = e.key === 'Escape';
                if (isEnter || isEsc) {
                    const input = this.viewport.querySelector('.tree-edit-input');
                    if (input) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isEnter) {
                            this.saveEditing(this.state.editingId, input.value);
                        } else {
                            this.cancelEditing();
                        }
                    }
                }
                return;
            }

            const { focusedId, visibleNodes } = this.state;
            if (!focusedId) return;

            const currentIndex = visibleNodes.findIndex(n => n.id === focusedId);
            if (currentIndex === -1) return;
            
            const node = visibleNodes[currentIndex];
            const hasChildren = node.children || (this.options.lazy && node.hasChildren);
            const isExpanded = this.state.expandedIds.has(node.id);

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.focusPreviousNode();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.focusNextNode();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (hasChildren && !isExpanded) {
                        this.toggleNode(focusedId);
                    } else if (hasChildren && isExpanded) {
                        this.focusNextNode();
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (hasChildren && isExpanded) {
                        this.toggleNode(focusedId);
                    } else {
                        this.focusParentNode();
                    }
                    break;
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    this.toggleNode(focusedId);
                    break;
            }
        });

        // Context menu
        if (this.options.onContextMenu) {
            this.contentLayer.addEventListener('contextmenu', (e) => {
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    e.preventDefault();
                    const node = this.findNodeById(nodeEl.dataset.id);
                    if (node) {
                        this.options.onContextMenu(node, e);
                    }
                }
            });
        }

        // Drag and drop
        if (this.options.draggable) {
            this.contentLayer.addEventListener('dragstart', (e) => {
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    this.handleDragStart(e, nodeEl.dataset.id);
                }
            });

            this.contentLayer.addEventListener('dragover', (e) => {
                e.preventDefault(); // Required for drop event to fire
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    this.handleDragOver(e, nodeEl.dataset.id);
                }
            });

            this.contentLayer.addEventListener('drop', (e) => {
                e.preventDefault(); // Prevent default behavior
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    this.handleDrop(e, nodeEl.dataset.id);
                }
            });

            this.contentLayer.addEventListener('dragleave', () => {
                this.state.dragOverNode = null;
                this.render();
            });
        }

 
         this.updateVisibleNodes();
     }

    // State change function
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.updateVisibleNodes();
    }

    // Flatten tree and apply filtering
    async updateVisibleNodes() {
        // Prevent multiple simultaneous worker operations
        if (this.pendingWorkerOperation) {
            return;
        }

        if (this.useWorkerForOperations && this.workerReady) {
            // Use worker for tree operations
            try {
                this.pendingWorkerOperation = true;

                const result = await this.postWorkerMessage('flatten', {
                    nodes: this.state.treeData,
                    searchTerm: this.state.searchTerm,
                    expandedIds: Array.from(this.state.expandedIds),
                    customFilterRules: null // Custom functions can't be serialized
                });

                // Apply custom filter on main thread if needed
                let filteredResult = result;
                if (this.state.customFilter) {
                    filteredResult = result.filter(node => {
                        // Find original node to apply filter
                        const originalNode = this.findNodeById(node.id);
                        return originalNode && this.state.customFilter(originalNode);
                    });
                }

                this.state.visibleNodes = filteredResult;
                
                // Calculate indeterminate states
                this.updateIndeterminateStates();

                // Set total height
                const totalHeight = filteredResult.length * this.options.rowHeight;
                this.spacer.style.height = `${totalHeight}px`;
                this.countDisplay.textContent = `${filteredResult.length} items`;

                this.render();
            } catch (error) {
                console.warn('[high-tree] Worker operation failed, falling back to sync:', error);
                // Fallback to synchronous mode
                this.updateVisibleNodesSync();
            } finally {
                this.pendingWorkerOperation = false;
            }
        } else {
            // Synchronous mode (fallback or worker disabled)
            this.updateVisibleNodesSync();
        }
    }

    // Synchronous version (fallback)
    updateVisibleNodesSync() {
        const result = [];
        this.flattenFilteredTree(this.state.treeData, 0, result);
        this.state.visibleNodes = result;
        
        // Calculate indeterminate states
        this.updateIndeterminateStates();

        // Set total height
        const totalHeight = result.length * this.options.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
        this.countDisplay.textContent = `${result.length} items`;

        this.render();
    }

    flattenFilteredTree(nodes, level = 0, result = []) {
        let hasMatchInBranch = false;
        const currentSearch = this.state.searchTerm.trim().toLowerCase();

        for (const node of nodes) {
            // Apply custom filter
            if (this.state.customFilter && !this.state.customFilter(node)) {
                continue;
            }

            const isMatch = currentSearch ? node.label.toLowerCase().includes(currentSearch) : false;
            const tempSubResult = [];
            let childHasMatch = false;

            if (node.children) {
                childHasMatch = this.flattenFilteredTree(node.children, level + 1, tempSubResult);
            }

            if (!currentSearch || isMatch || childHasMatch) {
                result.push({ ...node, level, isMatch });
                if ((currentSearch && childHasMatch) || (!currentSearch && this.state.expandedIds.has(node.id))) {
                    result.push(...tempSubResult);
                }
                if (isMatch || childHasMatch) hasMatchInBranch = true;
            }
        }
        return hasMatchInBranch;
    }

    // Node click handler
    async handleNodeClick(nodeId, event) {
        const node = this.findNodeById(nodeId);
        if (!node) return;

        // onClick callback
        if (this.options.onClick) {
            this.options.onClick(node, event);
        }

        // Selection feature
        if (this.options.selectable) {
            if (this.options.multiSelect && (event.ctrlKey || event.metaKey)) {
                // Multi-select (Ctrl)
                if (this.state.selectedIds.has(nodeId)) {
                    this.state.selectedIds.delete(nodeId);
                    if (this.options.cascadeSelect) this.cascadeDeselectChildren(node);
                } else {
                    this.state.selectedIds.add(nodeId);
                    if (this.options.cascadeSelect) this.cascadeSelectChildren(node);
                }
                this.state.lastSelectedId = nodeId;
            } else if (this.options.multiSelect && event.shiftKey && this.state.lastSelectedId) {
                // Range-select (Shift)
                const startIdx = this.state.visibleNodes.findIndex(n => n.id === this.state.lastSelectedId);
                const endIdx = this.state.visibleNodes.findIndex(n => n.id === nodeId);
                if (startIdx !== -1 && endIdx !== -1) {
                    const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
                    for (let i = min; i <= max; i++) {
                        this.state.selectedIds.add(this.state.visibleNodes[i].id);
                    }
                }
            } else {
                // Single select
                this.state.selectedIds.clear();
                this.state.selectedIds.add(nodeId);
                if (this.options.cascadeSelect) this.cascadeSelectChildren(node);
                this.state.lastSelectedId = nodeId;
            }

            this.state.focusedId = nodeId;
            this.state.focusedIndex = this.state.visibleNodes.findIndex(n => n.id === nodeId);

            if (this.options.onSelect) {
                this.options.onSelect(this.getSelectedNodes());
            }
            this.render();
        }

        // Expand/collapse
        if (this.state.expandedIds.has(nodeId)) {
            this.state.expandedIds.delete(nodeId);
            if (this.options.onCollapse) {
                this.options.onCollapse(node);
            }
            this.setState({});
        } else {
            // Lazy Load
            if (this.options.lazy && node.hasChildren && !node.children) {
                this.state.loadingIds.add(nodeId);
                this.render();

                try {
                    const newChildren = await this.options.onLoadData(node);

                    // Update data structure
                    const updateRecursive = (list) => {
                        return list.map(n => {
                            if (n.id === nodeId) return { ...n, children: newChildren };
                            if (n.children) return { ...n, children: updateRecursive(n.children) };
                            return n;
                        });
                    };
                    this.state.treeData = updateRecursive(this.state.treeData);
                    this.state.expandedIds.add(nodeId);
                    if (this.options.onExpand) {
                        this.options.onExpand(node);
                    }

                    // Cascade check inherit
                    if (this.options.checkbox && this.state.checkedIds.has(nodeId)) {
                        const checkRecursive = (children) => {
                            children.forEach(c => {
                                this.state.checkedIds.add(String(c.id));
                                if (c.children) checkRecursive(c.children);
                            });
                        };
                        checkRecursive(newChildren);
                    }

                    this.setState({});
                } finally {
                    this.state.loadingIds.delete(nodeId);
                    this.setState({});
                }
            } else {
                this.state.expandedIds.add(nodeId);
                if (this.options.onExpand) {
                    this.options.onExpand(node);
                }
                this.setState({});
            }
        }
    }

    /**
     * Toggles expansion state of a node
     */
    toggleNode(nodeId) {
        if (this.state.expandedIds.has(nodeId)) {
            this.collapseNode(nodeId);
        } else {
            this.expandNode(nodeId);
        }
    }

    /**
     * Handle checkbox click event.
     * Decisions between synchronous (main thread) or worker-based processing 
     * based on tree size to maintain UI responsiveness.
     */
    async handleCheckboxClick(nodeId) {
        if (!this.options.checkbox) return;

        const startTime = performance.now();
        const totalNodesCount = this.state.visibleNodes.length; 
        const useWorker = this.useWorkerForOperations && this.workerReady && totalNodesCount > 10000;

        let resultMetadata = {
            timeTaken: 0,
            isWorker: useWorker,
            nodesCount: totalNodesCount
        };

        if (useWorker) {
            // Offload to background worker for massive scale
            await this.handleCheckboxClickWorker(nodeId);
            resultMetadata.timeTaken = performance.now() - startTime;
        } else {
            // Instant synchronous update for standard use cases
            this.handleCheckboxClickSync(nodeId);
            resultMetadata.timeTaken = performance.now() - startTime;
        }

        // Pass performance metadata to callback if demo needs to show efficiency
        if (this.options.onCheck) {
            this.options.onCheck(this.getCheckedNodes(), resultMetadata);
        }

        this.render();
    }

    /**
     * Synchronous implementation for immediate feedback in small/medium trees.
     * @private
     */
    handleCheckboxClickSync(nodeId) {
        const id = String(nodeId);
        const node = this.findNodeById(id);
        if (!node) return;

        const willCheck = !this.state.checkedIds.has(id);
        this._toggleNodeCheckedRecursive(node, willCheck);
        this._updateAncestorsState(id);
    }

    /**
     * Asynchronous implementation for large trees (10k+ nodes).
     * Prevents UI freeze by delegating calculation to Web Worker.
     * @private
     */
    async handleCheckboxClickWorker(nodeId) {
        try {
            const result = await this.postWorkerMessage('toggle_check', {
                nodes: this.state.treeData,
                nodeId: nodeId,
                checked: !this.state.checkedIds.has(String(nodeId)),
                checkedIds: Array.from(this.state.checkedIds),
                indeterminateIds: Array.from(this.state.indeterminateIds)
            });

            if (result) {
                this.state.checkedIds = new Set(result.checkedIds);
                this.state.indeterminateIds = new Set(result.indeterminateIds);
            }
        } catch (error) {
            console.error('[high-tree] Worker checkbox operation failed, falling back to sync', error);
            this.handleCheckboxClickSync(nodeId);
        }
    }

    /**
     * Recursively toggles checked state for a node and all its children.
     * @private
     */
    _toggleNodeCheckedRecursive(node, checked) {
        if (checked) {
            this.state.checkedIds.add(String(node.id));
        } else {
            this.state.checkedIds.delete(String(node.id));
        }
        this.state.indeterminateIds.delete(String(node.id));

        if (node.children) {
            node.children.forEach(child => this._toggleNodeCheckedRecursive(child, checked));
        }
    }

    /**
     * Updates parent indeterminate and checked states based on children.
     * @private
     */
    _updateAncestorsState(nodeId) {
        const parent = this.findParentNode(String(nodeId));
        if (!parent) return;

        const children = parent.children || [];
        if (children.length === 0) return;

        let checkedCount = 0;
        let indeterminateCount = 0;

        children.forEach(c => {
            if (this.state.checkedIds.has(String(c.id))) checkedCount++;
            else if (this.state.indeterminateIds.has(String(c.id))) indeterminateCount++;
        });

        const pId = String(parent.id);
        if (checkedCount === children.length) {
            this.state.checkedIds.add(pId);
            this.state.indeterminateIds.delete(pId);
        } else if (checkedCount > 0 || indeterminateCount > 0) {
            this.state.checkedIds.delete(pId);
            this.state.indeterminateIds.add(pId);
        } else {
            this.state.checkedIds.delete(pId);
            this.state.indeterminateIds.delete(pId);
        }

        this._updateAncestorsState(pId);
    }

    // Drag and drop handlers
    handleDragStart(event, nodeId) {
        this.state.draggingNode = nodeId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', nodeId);
    }

    handleDragOver(event, nodeId) {
        if (this.state.draggingNode === nodeId) return;
        event.preventDefault();

        const nodeEl = event.target.closest('[data-id]');
        if (!nodeEl) return;

        const rect = nodeEl.getBoundingClientRect();
        const offsetY = event.clientY - rect.top;
        const threshold = rect.height / 4;

        let position = 'inside';
        if (offsetY < threshold) position = 'before';
        else if (offsetY > rect.height - threshold) position = 'after';

        if (this.state.dragOverNode !== nodeId || this.state.dragTargetPosition !== position) {
            this.state.dragOverNode = nodeId;
            this.state.dragTargetPosition = position;

            if (!this._dragOverRenderScheduled) {
                this._dragOverRenderScheduled = true;
                requestAnimationFrame(() => {
                    this.render();
                    this._dragOverRenderScheduled = false;
                });
            }
        }
    }

    handleDrop(event, targetNodeId) {
        console.log('handleDrop called', { draggedNodeId: this.state.draggingNode, targetNodeId });
        const draggedNodeId = this.state.draggingNode;

        if (draggedNodeId && draggedNodeId !== targetNodeId) {
            const draggedNode = this.findNodeById(draggedNodeId);
            const targetNode = this.findNodeById(targetNodeId);
            const position = this.state.dragTargetPosition || 'inside';

            if (draggedNode && targetNode) {
                if (this.options.enableDefaultDragDrop) {
                    const isDescendant = this.isNodeDescendant(draggedNode.id, targetNode.id);
                    if (!isDescendant) {
                        const removed = this.removeNodeFromTree(this.state.treeData, draggedNode.id);
                        if (removed) {
                            this.insertNodeInTree(this.state.treeData, targetNode.id, removed, position);
                            this.updateVisibleNodes();
                        }
                    }
                }

                if (this.options.onDrop) {
                    this.options.onDrop(draggedNode, targetNode, position);
                }
            }
        }

        this.state.draggingNode = null;
        this.state.dragOverNode = null;
        this.state.dragTargetPosition = null;
        this.render();
    }

    /**
     * Activates edit mode for a specific node.
     */
    startEditing(nodeId) {
        this.state.editingId = nodeId;
        this.render();
        // Use requestAnimationFrame to ensure the input is in the DOM before focusing
        requestAnimationFrame(() => {
            const input = this.container.querySelector(`[data-id="${nodeId}"] .tree-edit-input`);
            if (input) {
                input.focus();
                input.select();
            }
        });
    }

    saveEditing(nodeId, newLabel) {
        if (!newLabel.trim()) return this.cancelEditing();

        const node = this.findNodeById(nodeId);
        if (node) {
            const oldLabel = node.label;
            node.label = newLabel;
            this.state.editingId = null;

            if (this.options.onEdit) {
                this.options.onEdit(node, newLabel, oldLabel);
            }
            this.updateVisibleNodes();
        }
    }

    cancelEditing() {
        this.state.editingId = null;
        this.render();
    }

    // API: Add node
    addNode(parentId, newNode) {
        if (!parentId) {
            this.state.treeData.push(newNode);
        } else {
            const parent = this.findNodeById(parentId);
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(newNode);
                parent.hasChildren = true;
                this.state.expandedIds.add(parentId);
            }
        }
        this.updateVisibleNodes();
    }

    // API: Remove node
    removeNode(nodeId) {
        const removed = this.removeNodeFromTree(this.state.treeData, nodeId);
        if (removed) {
            this.state.selectedIds.delete(nodeId);
            this.state.checkedIds.delete(nodeId);
            this.state.expandedIds.delete(nodeId);
            this.updateVisibleNodes();
        }
    }

    // API: Scroll to node
    scrollToNode(nodeId) {
        // Find index in visible nodes
        const index = this.state.visibleNodes.findIndex(n => n.id === nodeId);
        if (index !== -1) {
            const top = index * this.options.rowHeight;
            this.viewport.scrollTop = top;
        } else {
            // Node might be hidden, try to expand ancestors
            this.expandPathToNode(nodeId);
        }
    }

    expandPathToNode(nodeId) {
        const path = [];
        const findPath = (nodes, targetId, currentPath) => {
            for (const node of nodes) {
                if (node.id === targetId) return true;
                if (node.children) {
                    currentPath.push(node.id);
                    if (findPath(node.children, targetId, currentPath)) return true;
                    currentPath.pop();
                }
            }
            return false;
        };

        if (findPath(this.state.treeData, nodeId, path)) {
            path.forEach(id => this.state.expandedIds.add(id));
            this.updateVisibleNodes().then(() => {
                const index = this.state.visibleNodes.findIndex(n => n.id === nodeId);
                if (index !== -1) {
                    this.viewport.scrollTop = index * this.options.rowHeight;
                }
            });
        }
    }

    // Keyboard navigation
    handleKeyDown(event) {
        if (!this.state.visibleNodes.length) return;

        let handled = false;

        switch (event.key) {
            case 'ArrowDown':
                this.moveFocus(1);
                handled = true;
                break;
            case 'ArrowUp':
                this.moveFocus(-1);
                handled = true;
                break;
            case 'ArrowRight':
                if (this.state.focusedId) {
                    this.expandNode(this.state.focusedId);
                    handled = true;
                }
                break;
            case 'ArrowLeft':
                if (this.state.focusedId) {
                    this.collapseNode(this.state.focusedId);
                    handled = true;
                }
                break;
            case 'Enter':
                if (this.state.focusedId) {
                    this.handleNodeClick(this.state.focusedId, event);
                    handled = true;
                }
                break;
            case ' ':
                if (this.options.selectable && this.state.focusedId) {
                    event.preventDefault();
                    const node = this.findNodeById(this.state.focusedId);
                    if (node) {
                        this.handleNodeClick(this.state.focusedId, event);
                    }
                    handled = true;
                }
                break;
        }

        if (handled) {
            event.preventDefault();
        }
    }

    moveFocus(direction) {
        if (this.state.focusedIndex === -1 && this.state.visibleNodes.length > 0) {
            this.state.focusedIndex = 0;
        } else {
            this.state.focusedIndex = Math.max(0, Math.min(this.state.visibleNodes.length - 1, this.state.focusedIndex + direction));
        }

        if (this.state.visibleNodes[this.state.focusedIndex]) {
            this.state.focusedId = this.state.visibleNodes[this.state.focusedIndex].id;
            this.render();
            this.scrollToFocused();
        }
    }

    scrollToFocused() {
        if (this.state.focusedIndex === -1) return;

        const { rowHeight } = this.options;
        const focusedTop = this.state.focusedIndex * rowHeight;
        const focusedBottom = focusedTop + rowHeight;
        const viewportTop = this.viewport.scrollTop;
        const viewportBottom = viewportTop + this.viewport.clientHeight;

        if (focusedTop < viewportTop) {
            this.viewport.scrollTop = focusedTop;
        } else if (focusedBottom > viewportBottom) {
            this.viewport.scrollTop = focusedBottom - this.viewport.clientHeight;
        }
    }

    // Highlight search term
    getHighlightedText(text) {
        if (!this.state.searchTerm) return text;
        const regex = new RegExp(`(${this.state.searchTerm})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
    }

    updateIndeterminateStates() {
        this.state.indeterminateIds.clear();
        const check = (node) => {
            const id = String(node.id);
            if (!node.children || node.children.length === 0) {
                return this.state.checkedIds.has(id) ? 'checked' : 'unchecked';
            }

            const results = node.children.map(child => check(child));
            const allChecked = results.every(r => r === 'checked');
            const allUnchecked = results.every(r => r === 'unchecked');

            if (allChecked) {
                this.state.checkedIds.add(id);
                return 'checked';
            } else if (allUnchecked) {
                this.state.checkedIds.delete(id);
                return 'unchecked';
            } else {
                this.state.checkedIds.delete(id);
                this.state.indeterminateIds.add(id);
                return 'indeterminate';
            }
        };
        this.state.treeData.forEach(check);
    }

    /**
     * Generates a unique state key for a node to determine if re-rendering is needed.
     * @private
     */
    _getNodeStateKey(node) {
        const isExpanded = this.state.expandedIds.has(node.id) || (this.state.searchTerm && !node.isMatch);
        const isLoading = this.state.loadingIds.has(node.id);
        const isSelected = this.state.selectedIds.has(node.id);
        const isFocused = this.state.focusedId === node.id;
        const isChecked = this.state.checkedIds.has(String(node.id));
        const isIndeterminate = this.state.indeterminateIds.has(String(node.id));
        const isDragOver = this.state.dragOverNode === node.id;
        const dragPos = this.state.dragTargetPosition;
        const isEditing = this.state.editingId === node.id;

        return `${node.label}|${isExpanded}|${isLoading}|${isSelected}|${isFocused}|${isChecked}|${isIndeterminate}|${isDragOver}|${dragPos}|${isEditing}`;
    }


    // Build HTML string for a single node
    _buildNodeHTML(node) {
        const { rowHeight } = this.options;
        const isExpanded = this.state.expandedIds.has(node.id) || (this.state.searchTerm && !node.isMatch);
        const isLoading = this.state.loadingIds.has(node.id);
        const hasChildren = node.children || (this.options.lazy && node.hasChildren);
        const isSelected = this.state.selectedIds.has(node.id);
        const isFocused = this.state.focusedId === node.id;
        const isChecked = this.state.checkedIds.has(node.id);
        const isIndeterminate = this.state.indeterminateIds ? this.state.indeterminateIds.has(node.id) : false;
        const isDragOver = this.state.dragOverNode === node.id;
        const isEditing = this.state.editingId === node.id;
        const dragPos = this.state.dragTargetPosition;

        let content = '';
        if (isEditing) {
            content = `
                <div class="flex items-center gap-1 flex-1 min-w-[120px] mr-2">
                    <input type="text" class="tree-edit-input flex-1 min-w-[150px] px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
                        value="${node.label}">
                    <button class="tree-edit-save p-1 shrink-0 text-green-600 hover:bg-green-50 rounded transition-colors" title="Save">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="tree-edit-cancel p-1 shrink-0 text-red-600 hover:bg-red-50 rounded transition-colors" title="Cancel">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
        } else {
            content = this.options.renderNode
                ? this.options.renderNode(node, this.state.searchTerm)
                : `
        <div class="flex items-center gap-2 overflow-hidden">
          ${hasChildren
                    ? `<svg class="w-4 h-4 ${isExpanded ? 'text-gray-500' : 'text-gray-400'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`
                    : `<svg class="w-4 h-4 text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
                }
          <span class="text-sm text-slate-700 select-none truncate">${this.getHighlightedText(node.label)}</span>
        </div>
      `;
        }
 
        const dropClass = isDragOver ? (dragPos === 'before' ? 'border-t-2 border-t-gray-400' : dragPos === 'after' ? 'border-b-2 border-b-gray-400' : 'bg-gray-50') : '';
 
        return `
       <div
         data-id="${node.id}"
         data-state-key="${this._getNodeStateKey(node)}"
         role="treeitem"
         aria-level="${node.level + 1}"
         aria-expanded="${hasChildren ? isExpanded : ''}"
         aria-selected="${isSelected}"
         class="flex items-center px-2 hover:bg-gray-50 cursor-pointer ${node.isMatch ? 'bg-amber-50/60' : ''} ${isSelected ? 'bg-gray-100' : ''} ${isFocused ? 'ring-1 ring-inset ring-gray-300 z-10' : ''} ${dropClass}"
         style="height: ${rowHeight}px; padding-left: ${node.level * 20 + 8}px"
         ${this.options.draggable ? 'draggable="true"' : ''}
       >
         ${this.options.checkbox ? `
           <div class="tree-checkbox mr-2 flex items-center">
             <input type="checkbox" ${isChecked ? 'checked' : ''}
               class="w-4 h-4 rounded cursor-pointer accent-gray-700"
               ${isIndeterminate ? 'data-indeterminate="true"' : ''}>
           </div>
         ` : ''}
 
         <div class="w-5 h-5 flex items-center justify-center mr-1">
           ${isLoading
                ? `<svg class="w-3 h-3 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
                : hasChildren
                    ? `<svg class="w-3.5 h-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isExpanded ? '<path d="m6 9 6 6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>'}</svg>`
                    : ''
            }
         </div>
         ${content}
       </div>
    `.trim();
    }

    // Actual DOM rendering — diffs existing nodes instead of replacing everything
    render() {
        const { visibleNodes, scrollTop } = this.state;
        const { rowHeight, height } = this.options;

        const startIndex = Math.floor(scrollTop / rowHeight);
        const endIndex = Math.min(startIndex + Math.ceil(height / rowHeight) + 1, visibleNodes.length);
        const displayNodes = visibleNodes.slice(startIndex, endIndex);

        this.contentLayer.style.transform = `translateY(${startIndex * rowHeight}px)`;
        this.contentLayer.setAttribute('role', 'tree');

        if (displayNodes.length === 0) {
            this.contentLayer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-400">
          <p class="text-sm">검색 결과가 없습니다.</p>
        </div>
      `;
            return;
        }

        // Build map of currently rendered row elements (direct children of contentLayer)
        const existingEls = Array.from(this.contentLayer.children);
        const existingMap = new Map();
        existingEls.forEach(el => {
            if (el.dataset.id) existingMap.set(el.dataset.id, el);
        });
        const newIds = new Set(displayNodes.map(n => n.id));

        // Remove elements that are no longer in the visible window
        existingEls.forEach(el => {
            if (!newIds.has(el.dataset.id)) el.remove();
        });

        const tempDiv = document.createElement('div');
        let refEl = null; // insertion anchor

        displayNodes.forEach(node => {
            const stateKey = this._getNodeStateKey(node);
            let el = existingMap.get(node.id);

            if (el) {
                // Node already in DOM — only replace if state changed
                if (el.dataset.stateKey !== stateKey) {
                    tempDiv.innerHTML = this._buildNodeHTML(node);
                    const newEl = tempDiv.firstElementChild;
                    el.replaceWith(newEl);
                    el = newEl;
                    existingMap.set(node.id, el);
                }
            } else {
                // New node — insert into DOM
                tempDiv.innerHTML = this._buildNodeHTML(node);
                el = tempDiv.firstElementChild;
                if (refEl) {
                    refEl.after(el);
                } else {
                    this.contentLayer.prepend(el);
                }
                existingMap.set(node.id, el);
            }

            // Ensure correct order
            if (refEl && refEl.nextSibling !== el) {
                refEl.after(el);
            }
            refEl = el;
        });

        // Set indeterminate state on checkboxes (can't be done via HTML attribute)
        this.contentLayer.querySelectorAll('[data-indeterminate="true"]').forEach(el => {
            el.indeterminate = true;
        });
    }

    // ========== Public API ==========

    /**
     * Recursively find a node by ID
     */
    findNodeById(nodeId) {
        const find = (nodes) => {
            for (const n of nodes) {
                if (n.id === nodeId) return n;
                if (n.children) {
                    const found = find(n.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return find(this.state.treeData);
    }

    /**
     * Find parent node of a specific node
     */
    findParentNode(nodeId) {
        const id = String(nodeId);
        const find = (nodes, parent = null) => {
            for (const n of nodes) {
                if (String(n.id) === id) return parent;
                if (n.children) {
                    const found = find(n.children, n);
                    if (found) return found;
                }
            }
            return null;
        };
        return find(this.state.treeData);
    }

    // Expand node
    expandNode(nodeId) {
        if (!this.state.expandedIds.has(nodeId)) {
            this.state.expandedIds.add(nodeId);
            const node = this.findNodeById(nodeId);
            if (node && this.options.onExpand) {
                this.options.onExpand(node);
            }
            this.setState({});
        }
    }

    // Collapse node
    collapseNode(nodeId) {
        if (this.state.expandedIds.has(nodeId)) {
            this.state.expandedIds.delete(nodeId);
            const node = this.findNodeById(nodeId);
            if (node && this.options.onCollapse) {
                this.options.onCollapse(node);
            }
            this.setState({});
        }
    }

    // Expand all (async with lazy loading support)
    async expandAll() {
        if (!this.options.lazy) {
            // Non-lazy: simply expand all nodes
            const expandRecursive = (nodes) => {
                nodes.forEach(node => {
                    if (node.children || node.hasChildren) {
                        this.state.expandedIds.add(node.id);
                    }
                    if (node.children) {
                        expandRecursive(node.children);
                    }
                });
            };
            expandRecursive(this.state.treeData);
            this.updateVisibleNodes();
        } else {
            // Lazy: load and expand in parallel (performance optimization)
            const expandAndLoadRecursive = async (nodes) => {
                // Process same-level nodes in parallel
                const loadPromises = nodes.map(async (node) => {
                    if (node.children || node.hasChildren) {
                        this.state.expandedIds.add(node.id);

                        // Load children if not yet loaded
                        if (node.hasChildren && !node.children) {
                            try {
                                this.state.loadingIds.add(node.id);
                                this.render();

                                const newChildren = await this.options.onLoadData(node);

                                // Update data structure
                                const updateRecursive = (list) => {
                                    return list.map(n => {
                                        if (n.id === node.id) return { ...n, children: newChildren };
                                        if (n.children) return { ...n, children: updateRecursive(n.children) };
                                        return n;
                                    });
                                };
                                this.state.treeData = updateRecursive(this.state.treeData);

                                // Inherit checkbox state
                                if (this.options.checkbox && this.state.checkedIds.has(node.id)) {
                                    const checkChildren = (children) => {
                                        children.forEach(child => {
                                            this.state.checkedIds.add(child.id);
                                            if (child.children) checkChildren(child.children);
                                        });
                                    };
                                    checkChildren(newChildren);
                                }

                                // Inherit selection state
                                if (this.options.selectable && this.options.cascadeSelect && this.state.selectedIds.has(node.id)) {
                                    const selectChildren = (children) => {
                                        children.forEach(child => {
                                            this.state.selectedIds.add(child.id);
                                            if (child.children) selectChildren(child.children);
                                        });
                                    };
                                    selectChildren(newChildren);
                                }

                                this.state.loadingIds.delete(node.id);

                                // Recursively expand children in parallel
                                await expandAndLoadRecursive(newChildren);
                            } catch (error) {
                                console.error('Error loading children in expandAll:', error);
                                this.state.loadingIds.delete(node.id);
                            }
                        } else if (node.children) {
                            // Expand already loaded children in parallel
                            await expandAndLoadRecursive(node.children);
                        }
                    }
                });

                // Process all nodes in parallel
                await Promise.all(loadPromises);
            };

            await expandAndLoadRecursive(this.state.treeData);
            this.updateVisibleNodes();
        }
    }

    // Collapse all
    collapseAll() {
        this.state.expandedIds.clear();
        this.setState({});
    }

    // Select node
    selectNode(nodeId) {
        if (!this.options.selectable) return;

        if (!this.options.multiSelect) {
            this.state.selectedIds.clear();
        }
        this.state.selectedIds.add(nodeId);

        if (this.options.onSelect) {
            this.options.onSelect(this.getSelectedNodes());
        }
        this.render();
    }

    // Unselect node
    unselectNode(nodeId) {
        this.state.selectedIds.delete(nodeId);

        if (this.options.onSelect) {
            this.options.onSelect(this.getSelectedNodes());
        }
        this.render();
    }

    // Get selected nodes
    getSelectedNodes() {
        return Array.from(this.state.selectedIds).map(id => this.findNodeById(id)).filter(Boolean);
    }

    // Clear all selections
    clearSelection() {
        this.state.selectedIds.clear();

        if (this.options.onSelect) {
            this.options.onSelect([]);
        }
        this.render();
    }

    checkNode(nodeId, cascade = false) {
        if (!this.options.checkbox) return;
        const node = this.findNodeById(nodeId);
        if (!node) return;

        if (cascade) {
            this._toggleNodeCheckedRecursive(node, true);
            this._updateAncestorsState(nodeId);
        } else {
            this.state.checkedIds.add(nodeId);
        }
    }

    uncheckNode(nodeId, cascade = false) {
        if (!this.options.checkbox) return;
        const node = this.findNodeById(nodeId);
        if (!node) return;

        if (cascade) {
            this._toggleNodeCheckedRecursive(node, false);
            this._updateAncestorsState(nodeId);
        } else {
            this.state.checkedIds.delete(nodeId);
        }
    }

    getCheckedNodes() {
        return Array.from(this.state.checkedIds)
            .map(id => this.findNodeById(id))
            .filter(Boolean);
    }

    // Set filter
    setFilter(filterFn) {
        this.state.customFilter = filterFn;
        this.updateVisibleNodes();
    }

    // Clear filter
    clearFilter() {
        this.state.customFilter = null;
        this.state.searchTerm = '';
        this.updateVisibleNodes();
    }

    // Refresh
    refresh() {
        this.updateVisibleNodes();
    }

    // Update data
    setData(newData) {
        this.state.treeData = [...newData];
        this.updateVisibleNodes();
    }

    // Get all data
    getData() {
        return this.state.treeData;
    }

    // Export current tree state (expanded, selected, checked)
    exportState() {
        return {
            expandedIds: Array.from(this.state.expandedIds),
            selectedIds: Array.from(this.state.selectedIds),
            checkedIds: Array.from(this.state.checkedIds)
        };
    }

    // Import tree state
    importState(state) {
        if (!state) return;
        if (state.expandedIds) this.state.expandedIds = new Set(state.expandedIds);
        if (state.selectedIds) this.state.selectedIds = new Set(state.selectedIds);
        if (state.checkedIds) this.state.checkedIds = new Set(state.checkedIds);
        this.updateVisibleNodes();
    }

    // Cascade select children (helper method)
    cascadeSelectChildren(node) {
        if (node.children) {
            node.children.forEach(child => {
                this.state.selectedIds.add(child.id);
                if (child.children) {
                    this.cascadeSelectChildren(child);
                }
            });
        }
    }

    // Cascade deselect children (helper method)
    cascadeDeselectChildren(node) {
        if (node.children) {
            node.children.forEach(child => {
                this.state.selectedIds.delete(child.id);
                if (child.children) {
                    this.cascadeDeselectChildren(child);
                }
            });
        }
    }

    // Helper: Remove node from tree (for drag-and-drop)
    removeNodeFromTree(nodes, nodeId) {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === nodeId) {
                return nodes.splice(i, 1)[0];
            }
            if (nodes[i].children) {
                const removed = this.removeNodeFromTree(nodes[i].children, nodeId);
                if (removed) return removed;
            }
        }
        return null;
    }

    // Helper: Insert node into tree (for drag-and-drop)
    insertNodeInTree(nodes, targetId, nodeToInsert, position = 'inside') {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === targetId) {
                if (position === 'inside') {
                    if (!nodes[i].children) {
                        nodes[i].children = [];
                    }
                    nodes[i].children.push(nodeToInsert);
                } else if (position === 'before') {
                    nodes.splice(i, 0, nodeToInsert);
                } else if (position === 'after') {
                    nodes.splice(i + 1, 0, nodeToInsert);
                }
                return true;
            }
            if (nodes[i].children) {
                if (this.insertNodeInTree(nodes[i].children, targetId, nodeToInsert, position)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Helper: Check if ancestorId is ancestor of descendantId
    isNodeDescendant(ancestorId, descendantId) {
        const findNode = (nodes, id) => {
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNode(node.children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        const checkDescendant = (node, targetId) => {
            if (node.id === targetId) return true;
            if (node.children) {
                return node.children.some(child => checkDescendant(child, targetId));
            }
            return false;
        };

        const ancestorNode = findNode(this.state.treeData, ancestorId);
        return ancestorNode && checkDescendant(ancestorNode, descendantId);
    }
}
