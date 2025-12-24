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
            enableDefaultDragDrop: options.enableDefaultDragDrop !== undefined ? options.enableDefaultDragDrop : true, // 기본값 true
            filter: options.filter || null,
        };

        // 내부 상태 (State)
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
            customFilter: this.options.filter,
        };

        this.init();
    }

    // 초기 구조 생성 및 이벤트 바인딩
    init() {
        this.container.innerHTML = `
      <div class="flex flex-col border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden" style="height: ${this.options.height}px" tabindex="0" id="tree-container">
        <!-- Search Bar -->
        <div class="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" id="tree-search" placeholder="노드 이름으로 검색..." class="w-full pl-9 pr-9 py-1.5 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
          </div>
          <div id="tree-count" class="text-[11px] font-medium text-slate-400 px-2 uppercase tracking-wider">0 items</div>
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

        // 이벤트 리스너
        this.viewport.addEventListener('scroll', () => {
            this.state.scrollTop = this.viewport.scrollTop;
            this.render();
        });

        this.searchInput.addEventListener('input', (e) => {
            this.setState({ searchTerm: e.target.value, scrollTop: 0 });
            this.viewport.scrollTop = 0;
        });

        // 노드 클릭 (이벤트 위임)
        this.contentLayer.addEventListener('click', (e) => {
            // 체크박스 클릭
            if (e.target.closest('.tree-checkbox')) {
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    e.stopPropagation();
                    this.handleCheckboxClick(nodeEl.dataset.id, e);
                }
                return;
            }

            // 노드 클릭
            const nodeEl = e.target.closest('[data-id]');
            if (nodeEl) {
                const nodeId = nodeEl.dataset.id;
                this.handleNodeClick(nodeId, e);
            }
        });

        // 컨텍스트 메뉴
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

        // 드래그 앤 드롭
        if (this.options.draggable) {
            this.contentLayer.addEventListener('dragstart', (e) => {
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    this.handleDragStart(e, nodeEl.dataset.id);
                }
            });

            this.contentLayer.addEventListener('dragover', (e) => {
                e.preventDefault(); // 이게 있어야 drop 이벤트가 발생!
                const nodeEl = e.target.closest('[data-id]');
                if (nodeEl) {
                    this.handleDragOver(e, nodeEl.dataset.id);
                }
            });

            this.contentLayer.addEventListener('drop', (e) => {
                e.preventDefault(); // 기본 동작 막기
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

        // 키보드 네비게이션
        this.treeContainer.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        this.updateVisibleNodes();
    }

    // 상태 변경 함수
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.updateVisibleNodes();
    }

    // 트리 평면화 및 필터링
    updateVisibleNodes() {
        const result = [];
        this.flattenFilteredTree(this.state.treeData, 0, result);
        this.state.visibleNodes = result;

        // 전체 높이 설정
        const totalHeight = result.length * this.options.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
        this.countDisplay.textContent = `${result.length} items`;

        this.render();
    }

    flattenFilteredTree(nodes, level = 0, result = []) {
        let hasMatchInBranch = false;
        const currentSearch = this.state.searchTerm.trim().toLowerCase();

        for (const node of nodes) {
            // 커스텀 필터 적용
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

    // 노드 클릭 핸들러
    async handleNodeClick(nodeId, event) {
        const node = this.findNodeById(nodeId);
        if (!node) return;

        // onClick 콜백
        if (this.options.onClick) {
            this.options.onClick(node, event);
        }

        // 선택 기능
        if (this.options.selectable) {
            if (this.options.multiSelect && (event.ctrlKey || event.metaKey)) {
                // 다중 선택
                if (this.state.selectedIds.has(nodeId)) {
                    this.state.selectedIds.delete(nodeId);
                    // Cascade deselect
                    if (this.options.cascadeSelect) {
                        this.cascadeDeselectChildren(node);
                    }
                } else {
                    this.state.selectedIds.add(nodeId);
                    // Cascade select
                    if (this.options.cascadeSelect) {
                        this.cascadeSelectChildren(node);
                    }
                }
            } else {
                // 단일 선택
                this.state.selectedIds.clear();
                this.state.selectedIds.add(nodeId);
                // Cascade select
                if (this.options.cascadeSelect) {
                    this.cascadeSelectChildren(node);
                }
            }

            this.state.focusedId = nodeId;
            this.state.focusedIndex = this.state.visibleNodes.findIndex(n => n.id === nodeId);

            if (this.options.onSelect) {
                this.options.onSelect(this.getSelectedNodes());
            }
            this.render();
        }

        // 확장/축소
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

                    // 데이터 업데이트
                    const updateRecursive = (list) => {
                        return list.map(n => {
                            if (n.id === nodeId) return { ...n, children: newChildren };
                            if (n.children) return { ...n, children: updateRecursive(n.children) };
                            return n;
                        });
                    };
                    this.state.treeData = updateRecursive(this.state.treeData);
                    this.state.expandedIds.add(nodeId);

                    // If parent is checked, check all newly loaded children
                    if (this.options.checkbox && this.state.checkedIds.has(nodeId)) {
                        const checkNewChildren = (children) => {
                            children.forEach(child => {
                                this.state.checkedIds.add(child.id);
                                if (child.children) {
                                    checkNewChildren(child.children);
                                }
                            });
                        };
                        checkNewChildren(newChildren);
                    }

                    // If parent is selected and cascadeSelect is enabled, select all newly loaded children
                    if (this.options.selectable && this.options.cascadeSelect && this.state.selectedIds.has(nodeId)) {
                        const selectNewChildren = (children) => {
                            children.forEach(child => {
                                this.state.selectedIds.add(child.id);
                                if (child.children) {
                                    selectNewChildren(child.children);
                                }
                            });
                        };
                        selectNewChildren(newChildren);
                    }

                    if (this.options.onExpand) {
                        this.options.onExpand(node);
                    }
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

    // 체크박스 클릭 핸들러
    handleCheckboxClick(nodeId, event) {
        if (!this.options.checkbox) return;

        const isChecked = this.state.checkedIds.has(nodeId);

        if (isChecked) {
            this.uncheckNode(nodeId, true);
        } else {
            this.checkNode(nodeId, true);
        }

        if (this.options.onCheck) {
            this.options.onCheck(this.getCheckedNodes());
        }

        // Explicitly render to update UI
        this.render();
    }

    // 드래그 앤 드롭 핸들러
    handleDragStart(event, nodeId) {
        this.state.draggingNode = nodeId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', nodeId);
    }

    handleDragOver(event, nodeId) {
        if (this.state.draggingNode === nodeId) return;

        // Drop 가능하도록 설정
        event.dataTransfer.dropEffect = 'move';

        // 상태만 업데이트 (render 호출 안 함 - drop 이벤트를 방해하지 않기 위해)
        if (this.state.dragOverNode !== nodeId) {
            this.state.dragOverNode = nodeId;

            // requestAnimationFrame으로 렌더링 최적화
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
            console.log('Found nodes:', { draggedNode, targetNode });

            if (draggedNode && targetNode) {
                // 기본 드래그 앤 드롭 처리
                if (this.options.enableDefaultDragDrop) {
                    console.log('Default drag-drop enabled:', this.options.enableDefaultDragDrop);

                    // 유효성 검사: 자기 자신이나 자손으로는 이동 불가
                    const isDescendant = this.isNodeDescendant(draggedNode.id, targetNode.id);
                    console.log('Is descendant?', isDescendant);

                    if (!isDescendant) {
                        // 노드 이동 실행
                        console.log('Removing node:', draggedNode.id);
                        const removed = this.removeNodeFromTree(this.state.treeData, draggedNode.id);
                        console.log('Removed node:', removed);

                        if (removed) {
                            console.log('Inserting node into:', targetNode.id);
                            const inserted = this.insertNodeInTree(this.state.treeData, targetNode.id, removed, 'inside');
                            console.log('Insert result:', inserted);

                            // 명시적으로 렌더링 업데이트
                            this.updateVisibleNodes();
                            console.log('✅ Node moved successfully!');
                        } else {
                            console.error('❌ Failed to remove node');
                        }
                    } else {
                        console.warn('⚠️ Cannot drop node onto its descendant');
                    }
                }

                // 커스텀 콜백 호출 (기본 동작 후)
                if (this.options.onDrop) {
                    this.options.onDrop(draggedNode, targetNode, 'inside');
                }
            } else {
                console.error('❌ Could not find dragged or target node');
            }
        }

        this.state.draggingNode = null;
        this.state.dragOverNode = null;
        this.render();
    }

    // 키보드 네비게이션
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

    // 검색어 하이라이트
    getHighlightedText(text) {
        if (!this.state.searchTerm) return text;
        const regex = new RegExp(`(${this.state.searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // 실제 DOM 렌더링
    render() {
        const { visibleNodes, scrollTop } = this.state;
        const { rowHeight, height } = this.options;

        const startIndex = Math.floor(scrollTop / rowHeight);
        const endIndex = Math.min(startIndex + Math.ceil(height / rowHeight) + 1, visibleNodes.length);

        const displayNodes = visibleNodes.slice(startIndex, endIndex);

        this.contentLayer.style.transform = `translateY(${startIndex * rowHeight}px)`;

        if (displayNodes.length === 0) {
            this.contentLayer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-400">
          <p class="text-sm">검색 결과가 없습니다.</p>
        </div>
      `;
            return;
        }

        this.contentLayer.innerHTML = displayNodes.map(node => {
            const isExpanded = this.state.expandedIds.has(node.id) || (this.state.searchTerm && !node.isMatch);
            const isLoading = this.state.loadingIds.has(node.id);
            const hasChildren = node.children || (this.options.lazy && node.hasChildren);
            const isSelected = this.state.selectedIds.has(node.id);
            const isFocused = this.state.focusedId === node.id;
            const isChecked = this.state.checkedIds.has(node.id);
            const isDragOver = this.state.dragOverNode === node.id;

            // 커스텀 렌더 함수
            const content = this.options.renderNode
                ? this.options.renderNode(node, this.state.searchTerm)
                : `
          <div class="flex items-center gap-2 overflow-hidden">
            ${hasChildren
                    ? `<svg class="w-4 h-4 ${isExpanded ? 'fill-blue-100 text-blue-500' : 'text-slate-400'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`
                    : `<svg class="w-4 h-4 text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
                }
            <span class="text-sm text-slate-700 select-none truncate">${this.getHighlightedText(node.label)}</span>
          </div>
        `;

            return `
        <div 
          data-id="${node.id}"
          class="flex items-center px-2 hover:bg-blue-50/50 cursor-pointer transition-colors ${node.isMatch ? 'bg-blue-50/30' : ''} ${isSelected ? 'bg-blue-100 border-l-2 border-blue-500' : ''} ${isFocused ? 'ring-1 ring-blue-400' : ''} ${isDragOver ? 'bg-green-100' : ''}"
          style="height: ${rowHeight}px; padding-left: ${node.level * 20 + 8}px"
          ${this.options.draggable ? 'draggable="true"' : ''}
        >
          ${this.options.checkbox ? `
            <div class="tree-checkbox mr-2">
              <input type="checkbox" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer">
            </div>
          ` : ''}
          
          <div class="w-5 h-5 flex items-center justify-center mr-1">
            ${isLoading
                    ? `<svg class="w-3 h-3 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
                    : hasChildren
                        ? `<svg class="w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isExpanded ? '<path d="m6 9 6 6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>'}</svg>`
                        : ''
                }
          </div>
          ${content}
        </div>
      `;
        }).join('');
    }

    // ========== Public API ==========

    // 노드 찾기
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

    // 확장
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

    // 축소
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

    // 모두 확장 (비동기 - lazy loading 지원)
    async expandAll() {
        if (!this.options.lazy) {
            // Non-lazy: 단순히 모든 노드 확장
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
            // Lazy: 병렬로 로드하며 확장 (성능 최적화)
            const expandAndLoadRecursive = async (nodes) => {
                // 같은 레벨의 노드들을 병렬로 처리
                const loadPromises = nodes.map(async (node) => {
                    if (node.children || node.hasChildren) {
                        this.state.expandedIds.add(node.id);

                        // 자식이 아직 로드되지 않았으면 로드
                        if (node.hasChildren && !node.children) {
                            try {
                                this.state.loadingIds.add(node.id);
                                this.render();

                                const newChildren = await this.options.onLoadData(node);

                                // 데이터 업데이트
                                const updateRecursive = (list) => {
                                    return list.map(n => {
                                        if (n.id === node.id) return { ...n, children: newChildren };
                                        if (n.children) return { ...n, children: updateRecursive(n.children) };
                                        return n;
                                    });
                                };
                                this.state.treeData = updateRecursive(this.state.treeData);

                                // 체크박스 상속
                                if (this.options.checkbox && this.state.checkedIds.has(node.id)) {
                                    const checkChildren = (children) => {
                                        children.forEach(child => {
                                            this.state.checkedIds.add(child.id);
                                            if (child.children) checkChildren(child.children);
                                        });
                                    };
                                    checkChildren(newChildren);
                                }

                                // 선택 상속
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

                                // 재귀적으로 자식들도 병렬로 확장
                                await expandAndLoadRecursive(newChildren);
                            } catch (error) {
                                console.error('Error loading children in expandAll:', error);
                                this.state.loadingIds.delete(node.id);
                            }
                        } else if (node.children) {
                            // 이미 로드된 자식 병렬로 확장
                            await expandAndLoadRecursive(node.children);
                        }
                    }
                });

                // 모든 노드를 병렬로 처리
                await Promise.all(loadPromises);
            };

            await expandAndLoadRecursive(this.state.treeData);
            this.updateVisibleNodes();
        }
    }

    // 모두 축소
    collapseAll() {
        this.state.expandedIds.clear();
        this.setState({});
    }

    // 선택
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

    // 선택 해제
    unselectNode(nodeId) {
        this.state.selectedIds.delete(nodeId);

        if (this.options.onSelect) {
            this.options.onSelect(this.getSelectedNodes());
        }
        this.render();
    }

    // 선택된 노드들 가져오기
    getSelectedNodes() {
        return Array.from(this.state.selectedIds).map(id => this.findNodeById(id)).filter(Boolean);
    }

    // 모든 선택 해제
    clearSelection() {
        this.state.selectedIds.clear();

        if (this.options.onSelect) {
            this.options.onSelect([]);
        }
        this.render();
    }

    // 체크
    checkNode(nodeId, cascade = false) {
        if (!this.options.checkbox) return;

        this.state.checkedIds.add(nodeId);

        if (cascade) {
            const node = this.findNodeById(nodeId);
            if (node && node.children) {
                const checkChildren = (children) => {
                    children.forEach(child => {
                        this.state.checkedIds.add(child.id);
                        if (child.children) {
                            checkChildren(child.children);
                        }
                    });
                };
                checkChildren(node.children);
            }
        }

        // Don't render here, let the caller handle it
    }

    // 체크 해제
    uncheckNode(nodeId, cascade = false) {
        if (!this.options.checkbox) return;

        this.state.checkedIds.delete(nodeId);

        if (cascade) {
            const node = this.findNodeById(nodeId);
            if (node && node.children) {
                const uncheckChildren = (children) => {
                    children.forEach(child => {
                        this.state.checkedIds.delete(child.id);
                        if (child.children) {
                            uncheckChildren(child.children);
                        }
                    });
                };
                uncheckChildren(node.children);
            }
        }

        // Don't render here, let the caller handle it
    }

    // 체크된 노드들 가져오기
    getCheckedNodes() {
        return Array.from(this.state.checkedIds).map(id => this.findNodeById(id)).filter(Boolean);
    }

    // 필터 설정
    setFilter(filterFn) {
        this.state.customFilter = filterFn;
        this.updateVisibleNodes();
    }

    // 필터 제거
    clearFilter() {
        this.state.customFilter = null;
        this.updateVisibleNodes();
    }

    // 새로고침
    refresh() {
        this.updateVisibleNodes();
    }

    // 데이터 업데이트
    setData(newData) {
        this.state.treeData = [...newData];
        this.updateVisibleNodes();
    }

    // 전체 데이터 가져오기
    getData() {
        return this.state.treeData;
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
