/**
 * High-Tree Web Worker
 * Handles CPU-intensive tree operations off the main thread
 */

class TreeWorkerCore {
    /**
     * Flatten tree and apply filtering/search
     * @param {Array} nodes - Tree nodes
     * @param {number} level - Current depth level
     * @param {Array} result - Result accumulator
     * @param {string} searchTerm - Search query
     * @param {Set} expandedIds - Set of expanded node IDs
     * @param {Array} customFilterRules - Serializable filter rules (not functions)
     * @returns {boolean} hasMatchInBranch
     */
    flattenFilteredTree(nodes, level = 0, result = [], searchTerm = '', expandedIds = new Set(), customFilterRules = null) {
        let hasMatchInBranch = false;
        const currentSearch = searchTerm.trim().toLowerCase();

        for (const node of nodes) {
            // Apply custom filter rules (if any)
            if (customFilterRules && !this.applyFilterRules(node, customFilterRules)) {
                continue;
            }

            const isMatch = currentSearch ? node.label.toLowerCase().includes(currentSearch) : false;
            const tempSubResult = [];
            let childHasMatch = false;

            if (node.children) {
                childHasMatch = this.flattenFilteredTree(
                    node.children,
                    level + 1,
                    tempSubResult,
                    searchTerm,
                    expandedIds,
                    customFilterRules
                );
            }

            if (!currentSearch || isMatch || childHasMatch) {
                result.push({ ...node, level, isMatch });
                // Auto-expand if child has match OR explicitly expanded
                if (childHasMatch || (!currentSearch && expandedIds.has(node.id))) {
                    result.push(...tempSubResult);
                }
                if (isMatch || childHasMatch) hasMatchInBranch = true;
            }
        }
        return hasMatchInBranch;
    }

    /**
     * Apply serializable filter rules
     * @param {Object} node - Node to check
     * @param {Array} rules - Filter rules
     * @returns {boolean}
     */
    applyFilterRules(node, rules) {
        // Future enhancement: support serializable filter expressions
        // For now, just return true (no filtering)
        return true;
    }

    /**
     * Remove node from tree
     * @param {Array} nodes - Tree nodes
     * @param {string} nodeId - Node ID to remove
     * @returns {Object|null} Removed node or null
     */
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

    /**
     * Insert node into tree
     * @param {Array} nodes - Tree nodes
     * @param {string} targetId - Target node ID
     * @param {Object} nodeToInsert - Node to insert
     * @param {string} position - 'inside', 'before', or 'after'
     * @returns {boolean} Success
     */
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

    /**
     * Check if ancestorId is ancestor of descendantId
     * @param {Array} treeData - Full tree data
     * @param {string} ancestorId - Ancestor node ID
     * @param {string} descendantId - Descendant node ID
     * @returns {boolean}
     */
    isNodeDescendant(treeData, ancestorId, descendantId) {
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

        const ancestorNode = findNode(treeData, ancestorId);
        return ancestorNode && checkDescendant(ancestorNode, descendantId);
    }

    /**
     * Find node by ID
     * @param {Array} nodes - Tree nodes
     * @param {string} nodeId - Node ID to find
     * @returns {Object|null}
     */
    findNodeById(nodes, nodeId) {
        for (const node of nodes) {
            if (node.id === nodeId) return node;
            if (node.children) {
                const found = this.findNodeById(node.children, nodeId);
                if (found) return found;
            }
        }
        return null;
    }
}

// Worker instance
const workerCore = new TreeWorkerCore();

// Message handler
self.onmessage = function (e) {
    const { type, id, payload } = e.data;

    try {
        let result;

        switch (type) {
            case 'flatten':
                result = [];
                const expandedSet = new Set(payload.expandedIds || []);
                workerCore.flattenFilteredTree(
                    payload.nodes,
                    0,
                    result,
                    payload.searchTerm || '',
                    expandedSet,
                    payload.customFilterRules || null
                );
                self.postMessage({
                    type: 'flatten_result',
                    id: id,
                    result: result
                });
                break;

            case 'remove_node':
                // Clone tree data to avoid mutation issues
                const treeForRemoval = JSON.parse(JSON.stringify(payload.treeData));
                const removedNode = workerCore.removeNodeFromTree(treeForRemoval, payload.nodeId);
                self.postMessage({
                    type: 'remove_node_result',
                    id: id,
                    removedNode: removedNode,
                    updatedTree: treeForRemoval
                });
                break;

            case 'insert_node':
                // Clone tree data
                const treeForInsertion = JSON.parse(JSON.stringify(payload.treeData));
                const insertSuccess = workerCore.insertNodeInTree(
                    treeForInsertion,
                    payload.targetId,
                    payload.nodeToInsert,
                    payload.position || 'inside'
                );
                self.postMessage({
                    type: 'insert_node_result',
                    id: id,
                    success: insertSuccess,
                    updatedTree: treeForInsertion
                });
                break;

            case 'check_descendant':
                const isDescendant = workerCore.isNodeDescendant(
                    payload.treeData,
                    payload.ancestorId,
                    payload.descendantId
                );
                self.postMessage({
                    type: 'check_descendant_result',
                    id: id,
                    isDescendant: isDescendant
                });
                break;

            case 'find_node':
                const foundNode = workerCore.findNodeById(payload.nodes, payload.nodeId);
                self.postMessage({
                    type: 'find_node_result',
                    id: id,
                    node: foundNode
                });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            id: id,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
};

// Worker ready signal
self.postMessage({ type: 'ready' });
