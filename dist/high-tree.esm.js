class VirtualTree {
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
      enableDefaultDragDrop: options.enableDefaultDragDrop !== void 0 ? options.enableDefaultDragDrop : true,
      // default: true
      filter: options.filter || null,
      editable: options.editable || false,
      onEdit: options.onEdit || null,
      // Worker options
      useWorker: options.useWorker !== void 0 ? options.useWorker : true,
      workerPath: options.workerPath || null
    };
    this.state = {
      treeData: [...this.options.data],
      expandedIds: /* @__PURE__ */ new Set(),
      loadingIds: /* @__PURE__ */ new Set(),
      selectedIds: /* @__PURE__ */ new Set(),
      checkedIds: /* @__PURE__ */ new Set(),
      searchTerm: "",
      scrollTop: 0,
      visibleNodes: [],
      focusedId: null,
      focusedIndex: -1,
      draggingNode: null,
      dragOverNode: null,
      dragTargetPosition: null,
      // 'inside', 'before', 'after'
      editingId: null,
      lastSelectedId: null,
      indeterminateIds: /* @__PURE__ */ new Set(),
      customFilter: this.options.filter
    };
    this._locale = Object.assign({
      searchPlaceholder: "Search...",
      emptyText: "No results found.",
      nodeCount: (n) => `${n} node${n === 1 ? "" : "s"}`
    }, options.locale || {});
    this.worker = null;
    this.workerReady = false;
    this._scrollRafId = null;
    this.useWorkerForOperations = false;
    this.workerMessageId = 0;
    this.workerCallbacks = /* @__PURE__ */ new Map();
    this.pendingWorkerOperation = false;
    this.initWorker();
    this.init();
  }
  /**
   * Initializes the Web Worker for off-thread tree operations.
   */
  initWorker() {
    if (!this.options.useWorker || typeof Worker === "undefined") {
      console.log("[high-tree] Worker disabled or not supported, using synchronous mode");
      this.useWorkerForOperations = false;
      return;
    }
    try {
      let workerPath = this.options.workerPath;
      if (!workerPath) {
        const scriptTag = document.currentScript;
        if (scriptTag && scriptTag.src) {
          const scriptUrl = new URL(scriptTag.src);
          workerPath = new URL("high-tree-worker.js", scriptUrl).href;
        } else {
          workerPath = new URL("data:text/javascript;base64,LyoqDQogKiBXZWIgV29ya2VyIGZvciB0aGUgSGlnaC1UcmVlIGNvbXBvbmVudC4NCiAqIFBlcmZvcm1zIGNvbXB1dGF0aW9uYWxseSBleHBlbnNpdmUgdHJlZSBmbGF0dGVuaW5nIGFuZCBzZWFyY2ggb3BlcmF0aW9ucyBvZmYtdGhyZWFkLg0KICovDQoNCmNsYXNzIFRyZWVXb3JrZXJDb3JlIHsNCiAgICAvKioNCiAgICAgKiBGbGF0dGVucyB0aGUgdHJlZSBzdHJ1Y3R1cmUgYW5kIGFwcGxpZXMgZmlsdGVyaW5nL3NlYXJjaCBsb2dpYy4NCiAgICAgKiBAcGFyYW0ge0FycmF5fSBub2RlcyAtIFNvdXJjZSB0cmVlIG5vZGVzLg0KICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZXZlbCAtIEN1cnJlbnQgbmVzdGluZyBsZXZlbC4NCiAgICAgKiBAcGFyYW0ge0FycmF5fSByZXN1bHQgLSBBY2N1bXVsYXRvciBmb3IgZmxhdHRlbmVkIG5vZGVzLg0KICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZWFyY2hUZXJtIC0gU2VhcmNoIHF1ZXJ5IHRvIG1hdGNoIGxhYmVscyBhZ2FpbnN0Lg0KICAgICAqIEBwYXJhbSB7U2V0fSBleHBhbmRlZElkcyAtIE1hcCBvZiBub2RlcyB0byBiZSBleHBhbmRlZC4NCiAgICAgKiBAcGFyYW0ge0FycmF5fSBjdXN0b21GaWx0ZXJSdWxlcyAtIFNlcmlhbGl6YXRpb24tZnJpZW5kbHkgZmlsdGVyIHJ1bGVzLg0KICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGFueSBub2RlIGluIHRoaXMgYnJhbmNoIG1hdGNoZXMgdGhlIHNlYXJjaCBjcml0ZXJpYS4NCiAgICAgKi8NCiAgICBmbGF0dGVuRmlsdGVyZWRUcmVlKG5vZGVzLCBsZXZlbCA9IDAsIHJlc3VsdCA9IFtdLCBzZWFyY2hUZXJtID0gJycsIGV4cGFuZGVkSWRzID0gbmV3IFNldCgpLCBjdXN0b21GaWx0ZXJSdWxlcyA9IG51bGwpIHsNCiAgICAgICAgbGV0IGhhc01hdGNoSW5CcmFuY2ggPSBmYWxzZTsNCiAgICAgICAgY29uc3QgY3VycmVudFNlYXJjaCA9IHNlYXJjaFRlcm0udHJpbSgpLnRvTG93ZXJDYXNlKCk7DQoNCiAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7DQogICAgICAgICAgICAvLyBBcHBseSBjdXN0b20gZmlsdGVyIHJ1bGVzIChpZiBhbnkpDQogICAgICAgICAgICBpZiAoY3VzdG9tRmlsdGVyUnVsZXMgJiYgIXRoaXMuYXBwbHlGaWx0ZXJSdWxlcyhub2RlLCBjdXN0b21GaWx0ZXJSdWxlcykpIHsNCiAgICAgICAgICAgICAgICBjb250aW51ZTsNCiAgICAgICAgICAgIH0NCg0KICAgICAgICAgICAgY29uc3QgaXNNYXRjaCA9IGN1cnJlbnRTZWFyY2ggPyBub2RlLmxhYmVsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoY3VycmVudFNlYXJjaCkgOiBmYWxzZTsNCiAgICAgICAgICAgIGNvbnN0IHRlbXBTdWJSZXN1bHQgPSBbXTsNCiAgICAgICAgICAgIGxldCBjaGlsZEhhc01hdGNoID0gZmFsc2U7DQoNCiAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7DQogICAgICAgICAgICAgICAgY2hpbGRIYXNNYXRjaCA9IHRoaXMuZmxhdHRlbkZpbHRlcmVkVHJlZSgNCiAgICAgICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbiwNCiAgICAgICAgICAgICAgICAgICAgbGV2ZWwgKyAxLA0KICAgICAgICAgICAgICAgICAgICB0ZW1wU3ViUmVzdWx0LA0KICAgICAgICAgICAgICAgICAgICBzZWFyY2hUZXJtLA0KICAgICAgICAgICAgICAgICAgICBleHBhbmRlZElkcywNCiAgICAgICAgICAgICAgICAgICAgY3VzdG9tRmlsdGVyUnVsZXMNCiAgICAgICAgICAgICAgICApOw0KICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICBpZiAoIWN1cnJlbnRTZWFyY2ggfHwgaXNNYXRjaCB8fCBjaGlsZEhhc01hdGNoKSB7DQogICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goeyAuLi5ub2RlLCBsZXZlbCwgaXNNYXRjaCB9KTsNCiAgICAgICAgICAgICAgICAvLyBBdXRvLWV4cGFuZCBpZiBjaGlsZCBoYXMgbWF0Y2ggT1IgZXhwbGljaXRseSBleHBhbmRlZA0KICAgICAgICAgICAgICAgIGlmIChjaGlsZEhhc01hdGNoIHx8ICghY3VycmVudFNlYXJjaCAmJiBleHBhbmRlZElkcy5oYXMobm9kZS5pZCkpKSB7DQogICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKC4uLnRlbXBTdWJSZXN1bHQpOw0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICBpZiAoaXNNYXRjaCB8fCBjaGlsZEhhc01hdGNoKSBoYXNNYXRjaEluQnJhbmNoID0gdHJ1ZTsNCiAgICAgICAgICAgIH0NCiAgICAgICAgfQ0KICAgICAgICByZXR1cm4gaGFzTWF0Y2hJbkJyYW5jaDsNCiAgICB9DQoNCiAgICAvKioNCiAgICAgKiBBcHBseSBzZXJpYWxpemFibGUgZmlsdGVyIHJ1bGVzDQogICAgICogQHBhcmFtIHtPYmplY3R9IG5vZGUgLSBOb2RlIHRvIGNoZWNrDQogICAgICogQHBhcmFtIHtBcnJheX0gcnVsZXMgLSBGaWx0ZXIgcnVsZXMNCiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0NCiAgICAgKi8NCiAgICBhcHBseUZpbHRlclJ1bGVzKG5vZGUsIHJ1bGVzKSB7DQogICAgICAgIC8vIEZ1dHVyZSBlbmhhbmNlbWVudDogc3VwcG9ydCBzZXJpYWxpemFibGUgZmlsdGVyIGV4cHJlc3Npb25zDQogICAgICAgIC8vIEZvciBub3csIGp1c3QgcmV0dXJuIHRydWUgKG5vIGZpbHRlcmluZykNCiAgICAgICAgcmV0dXJuIHRydWU7DQogICAgfQ0KDQogICAgLyoqDQogICAgICogUmVtb3ZlIG5vZGUgZnJvbSB0cmVlDQogICAgICogQHBhcmFtIHtBcnJheX0gbm9kZXMgLSBUcmVlIG5vZGVzDQogICAgICogQHBhcmFtIHtzdHJpbmd9IG5vZGVJZCAtIE5vZGUgSUQgdG8gcmVtb3ZlDQogICAgICogQHJldHVybnMge09iamVjdHxudWxsfSBSZW1vdmVkIG5vZGUgb3IgbnVsbA0KICAgICAqLw0KICAgIHJlbW92ZU5vZGVGcm9tVHJlZShub2Rlcywgbm9kZUlkKSB7DQogICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHsNCiAgICAgICAgICAgIGlmIChub2Rlc1tpXS5pZCA9PT0gbm9kZUlkKSB7DQogICAgICAgICAgICAgICAgcmV0dXJuIG5vZGVzLnNwbGljZShpLCAxKVswXTsNCiAgICAgICAgICAgIH0NCiAgICAgICAgICAgIGlmIChub2Rlc1tpXS5jaGlsZHJlbikgew0KICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZWQgPSB0aGlzLnJlbW92ZU5vZGVGcm9tVHJlZShub2Rlc1tpXS5jaGlsZHJlbiwgbm9kZUlkKTsNCiAgICAgICAgICAgICAgICBpZiAocmVtb3ZlZCkgcmV0dXJuIHJlbW92ZWQ7DQogICAgICAgICAgICB9DQogICAgICAgIH0NCiAgICAgICAgcmV0dXJuIG51bGw7DQogICAgfQ0KDQogICAgLyoqDQogICAgICogSW5zZXJ0IG5vZGUgaW50byB0cmVlDQogICAgICogQHBhcmFtIHtBcnJheX0gbm9kZXMgLSBUcmVlIG5vZGVzDQogICAgICogQHBhcmFtIHtzdHJpbmd9IHRhcmdldElkIC0gVGFyZ2V0IG5vZGUgSUQNCiAgICAgKiBAcGFyYW0ge09iamVjdH0gbm9kZVRvSW5zZXJ0IC0gTm9kZSB0byBpbnNlcnQNCiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcG9zaXRpb24gLSAnaW5zaWRlJywgJ2JlZm9yZScsIG9yICdhZnRlcicNCiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gU3VjY2Vzcw0KICAgICAqLw0KICAgIGluc2VydE5vZGVJblRyZWUobm9kZXMsIHRhcmdldElkLCBub2RlVG9JbnNlcnQsIHBvc2l0aW9uID0gJ2luc2lkZScpIHsNCiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykgew0KICAgICAgICAgICAgaWYgKG5vZGVzW2ldLmlkID09PSB0YXJnZXRJZCkgew0KICAgICAgICAgICAgICAgIGlmIChwb3NpdGlvbiA9PT0gJ2luc2lkZScpIHsNCiAgICAgICAgICAgICAgICAgICAgaWYgKCFub2Rlc1tpXS5jaGlsZHJlbikgew0KICAgICAgICAgICAgICAgICAgICAgICAgbm9kZXNbaV0uY2hpbGRyZW4gPSBbXTsNCiAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgICAgICBub2Rlc1tpXS5jaGlsZHJlbi5wdXNoKG5vZGVUb0luc2VydCk7DQogICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ2JlZm9yZScpIHsNCiAgICAgICAgICAgICAgICAgICAgbm9kZXMuc3BsaWNlKGksIDAsIG5vZGVUb0luc2VydCk7DQogICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ2FmdGVyJykgew0KICAgICAgICAgICAgICAgICAgICBub2Rlcy5zcGxpY2UoaSArIDEsIDAsIG5vZGVUb0luc2VydCk7DQogICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOw0KICAgICAgICAgICAgfQ0KICAgICAgICAgICAgaWYgKG5vZGVzW2ldLmNoaWxkcmVuKSB7DQogICAgICAgICAgICAgICAgaWYgKHRoaXMuaW5zZXJ0Tm9kZUluVHJlZShub2Rlc1tpXS5jaGlsZHJlbiwgdGFyZ2V0SWQsIG5vZGVUb0luc2VydCwgcG9zaXRpb24pKSB7DQogICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOw0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgIH0NCiAgICAgICAgfQ0KICAgICAgICByZXR1cm4gZmFsc2U7DQogICAgfQ0KDQogICAgLyoqDQogICAgICogQ2hlY2sgaWYgYW5jZXN0b3JJZCBpcyBhbmNlc3RvciBvZiBkZXNjZW5kYW50SWQNCiAgICAgKiBAcGFyYW0ge0FycmF5fSB0cmVlRGF0YSAtIEZ1bGwgdHJlZSBkYXRhDQogICAgICogQHBhcmFtIHtzdHJpbmd9IGFuY2VzdG9ySWQgLSBBbmNlc3RvciBub2RlIElEDQogICAgICogQHBhcmFtIHtzdHJpbmd9IGRlc2NlbmRhbnRJZCAtIERlc2NlbmRhbnQgbm9kZSBJRA0KICAgICAqIEByZXR1cm5zIHtib29sZWFufQ0KICAgICAqLw0KICAgIGlzTm9kZURlc2NlbmRhbnQodHJlZURhdGEsIGFuY2VzdG9ySWQsIGRlc2NlbmRhbnRJZCkgew0KICAgICAgICBjb25zdCBmaW5kTm9kZSA9IChub2RlcywgaWQpID0+IHsNCiAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykgew0KICAgICAgICAgICAgICAgIGlmIChub2RlLmlkID09PSBpZCkgcmV0dXJuIG5vZGU7DQogICAgICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm91bmQgPSBmaW5kTm9kZShub2RlLmNoaWxkcmVuLCBpZCk7DQogICAgICAgICAgICAgICAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGZvdW5kOw0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgIH0NCiAgICAgICAgICAgIHJldHVybiBudWxsOw0KICAgICAgICB9Ow0KDQogICAgICAgIGNvbnN0IGNoZWNrRGVzY2VuZGFudCA9IChub2RlLCB0YXJnZXRJZCkgPT4gew0KICAgICAgICAgICAgaWYgKG5vZGUuaWQgPT09IHRhcmdldElkKSByZXR1cm4gdHJ1ZTsNCiAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7DQogICAgICAgICAgICAgICAgcmV0dXJuIG5vZGUuY2hpbGRyZW4uc29tZShjaGlsZCA9PiBjaGVja0Rlc2NlbmRhbnQoY2hpbGQsIHRhcmdldElkKSk7DQogICAgICAgICAgICB9DQogICAgICAgICAgICByZXR1cm4gZmFsc2U7DQogICAgICAgIH07DQoNCiAgICAgICAgY29uc3QgYW5jZXN0b3JOb2RlID0gZmluZE5vZGUodHJlZURhdGEsIGFuY2VzdG9ySWQpOw0KICAgICAgICByZXR1cm4gYW5jZXN0b3JOb2RlICYmIGNoZWNrRGVzY2VuZGFudChhbmNlc3Rvck5vZGUsIGRlc2NlbmRhbnRJZCk7DQogICAgfQ0KDQogICAgLyoqDQogICAgICogRmluZCBub2RlIGJ5IElEDQogICAgICogQHBhcmFtIHtBcnJheX0gbm9kZXMgLSBUcmVlIG5vZGVzDQogICAgICogQHBhcmFtIHtzdHJpbmd9IG5vZGVJZCAtIE5vZGUgSUQgdG8gZmluZA0KICAgICAqIEByZXR1cm5zIHtPYmplY3R8bnVsbH0NCiAgICAgKi8NCiAgICBmaW5kTm9kZUJ5SWQobm9kZXMsIG5vZGVJZCkgew0KICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHsNCiAgICAgICAgICAgIGlmIChub2RlLmlkID09PSBub2RlSWQpIHJldHVybiBub2RlOw0KICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHsNCiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZE5vZGVCeUlkKG5vZGUuY2hpbGRyZW4sIG5vZGVJZCk7DQogICAgICAgICAgICAgICAgaWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7DQogICAgICAgICAgICB9DQogICAgICAgIH0NCiAgICAgICAgcmV0dXJuIG51bGw7DQogICAgfQ0KfQ0KDQovLyBXb3JrZXIgaW5zdGFuY2UNCmNvbnN0IHdvcmtlckNvcmUgPSBuZXcgVHJlZVdvcmtlckNvcmUoKTsNCg0KLy8gTWVzc2FnZSBoYW5kbGVyDQpzZWxmLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7DQogICAgY29uc3QgeyB0eXBlLCBpZCwgcGF5bG9hZCB9ID0gZS5kYXRhOw0KDQogICAgdHJ5IHsNCiAgICAgICAgbGV0IHJlc3VsdDsNCg0KICAgICAgICBzd2l0Y2ggKHR5cGUpIHsNCiAgICAgICAgICAgIGNhc2UgJ2ZsYXR0ZW4nOg0KICAgICAgICAgICAgICAgIHJlc3VsdCA9IFtdOw0KICAgICAgICAgICAgICAgIGNvbnN0IGV4cGFuZGVkU2V0ID0gbmV3IFNldChwYXlsb2FkLmV4cGFuZGVkSWRzIHx8IFtdKTsNCiAgICAgICAgICAgICAgICB3b3JrZXJDb3JlLmZsYXR0ZW5GaWx0ZXJlZFRyZWUoDQogICAgICAgICAgICAgICAgICAgIHBheWxvYWQubm9kZXMsDQogICAgICAgICAgICAgICAgICAgIDAsDQogICAgICAgICAgICAgICAgICAgIHJlc3VsdCwNCiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5zZWFyY2hUZXJtIHx8ICcnLA0KICAgICAgICAgICAgICAgICAgICBleHBhbmRlZFNldCwNCiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5jdXN0b21GaWx0ZXJSdWxlcyB8fCBudWxsDQogICAgICAgICAgICAgICAgKTsNCiAgICAgICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ZsYXR0ZW5fcmVzdWx0JywNCiAgICAgICAgICAgICAgICAgICAgaWQ6IGlkLA0KICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IHJlc3VsdA0KICAgICAgICAgICAgICAgIH0pOw0KICAgICAgICAgICAgICAgIGJyZWFrOw0KDQogICAgICAgICAgICBjYXNlICdyZW1vdmVfbm9kZSc6DQogICAgICAgICAgICAgICAgLy8gQ2xvbmUgdHJlZSBkYXRhIHRvIGF2b2lkIG11dGF0aW9uIGlzc3Vlcw0KICAgICAgICAgICAgICAgIGNvbnN0IHRyZWVGb3JSZW1vdmFsID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShwYXlsb2FkLnRyZWVEYXRhKSk7DQogICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlZE5vZGUgPSB3b3JrZXJDb3JlLnJlbW92ZU5vZGVGcm9tVHJlZSh0cmVlRm9yUmVtb3ZhbCwgcGF5bG9hZC5ub2RlSWQpOw0KICAgICAgICAgICAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoew0KICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVtb3ZlX25vZGVfcmVzdWx0JywNCiAgICAgICAgICAgICAgICAgICAgaWQ6IGlkLA0KICAgICAgICAgICAgICAgICAgICByZW1vdmVkTm9kZTogcmVtb3ZlZE5vZGUsDQogICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRUcmVlOiB0cmVlRm9yUmVtb3ZhbA0KICAgICAgICAgICAgICAgIH0pOw0KICAgICAgICAgICAgICAgIGJyZWFrOw0KDQogICAgICAgICAgICBjYXNlICdpbnNlcnRfbm9kZSc6DQogICAgICAgICAgICAgICAgLy8gQ2xvbmUgdHJlZSBkYXRhDQogICAgICAgICAgICAgICAgY29uc3QgdHJlZUZvckluc2VydGlvbiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocGF5bG9hZC50cmVlRGF0YSkpOw0KICAgICAgICAgICAgICAgIGNvbnN0IGluc2VydFN1Y2Nlc3MgPSB3b3JrZXJDb3JlLmluc2VydE5vZGVJblRyZWUoDQogICAgICAgICAgICAgICAgICAgIHRyZWVGb3JJbnNlcnRpb24sDQogICAgICAgICAgICAgICAgICAgIHBheWxvYWQudGFyZ2V0SWQsDQogICAgICAgICAgICAgICAgICAgIHBheWxvYWQubm9kZVRvSW5zZXJ0LA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLnBvc2l0aW9uIHx8ICdpbnNpZGUnDQogICAgICAgICAgICAgICAgKTsNCiAgICAgICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2luc2VydF9ub2RlX3Jlc3VsdCcsDQogICAgICAgICAgICAgICAgICAgIGlkOiBpZCwNCiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogaW5zZXJ0U3VjY2VzcywNCiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZFRyZWU6IHRyZWVGb3JJbnNlcnRpb24NCiAgICAgICAgICAgICAgICB9KTsNCiAgICAgICAgICAgICAgICBicmVhazsNCg0KICAgICAgICAgICAgY2FzZSAnY2hlY2tfZGVzY2VuZGFudCc6DQogICAgICAgICAgICAgICAgY29uc3QgaXNEZXNjZW5kYW50ID0gd29ya2VyQ29yZS5pc05vZGVEZXNjZW5kYW50KA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLnRyZWVEYXRhLA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLmFuY2VzdG9ySWQsDQogICAgICAgICAgICAgICAgICAgIHBheWxvYWQuZGVzY2VuZGFudElkDQogICAgICAgICAgICAgICAgKTsNCiAgICAgICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NoZWNrX2Rlc2NlbmRhbnRfcmVzdWx0JywNCiAgICAgICAgICAgICAgICAgICAgaWQ6IGlkLA0KICAgICAgICAgICAgICAgICAgICBpc0Rlc2NlbmRhbnQ6IGlzRGVzY2VuZGFudA0KICAgICAgICAgICAgICAgIH0pOw0KICAgICAgICAgICAgICAgIGJyZWFrOw0KDQogICAgICAgICAgICBjYXNlICdmaW5kX25vZGUnOg0KICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kTm9kZSA9IHdvcmtlckNvcmUuZmluZE5vZGVCeUlkKHBheWxvYWQubm9kZXMsIHBheWxvYWQubm9kZUlkKTsNCiAgICAgICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ZpbmRfbm9kZV9yZXN1bHQnLA0KICAgICAgICAgICAgICAgICAgICBpZDogaWQsDQogICAgICAgICAgICAgICAgICAgIG5vZGU6IGZvdW5kTm9kZQ0KICAgICAgICAgICAgICAgIH0pOw0KICAgICAgICAgICAgICAgIGJyZWFrOw0KDQogICAgICAgICAgICBjYXNlICd0b2dnbGVfY2hlY2snOg0KICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVzID0gcGF5bG9hZC5ub2RlczsNCiAgICAgICAgICAgICAgICBjb25zdCBub2RlSWQgPSBTdHJpbmcocGF5bG9hZC5ub2RlSWQpOw0KICAgICAgICAgICAgICAgIGNvbnN0IGlzQ2hlY2tlZCA9IHBheWxvYWQuY2hlY2tlZDsNCiAgICAgICAgICAgICAgICBjb25zdCBjaGVja2VkSWRzID0gbmV3IFNldChwYXlsb2FkLmNoZWNrZWRJZHMgfHwgW10pOw0KICAgICAgICAgICAgICAgIGNvbnN0IGluZGV0ZXJtaW5hdGVJZHMgPSBuZXcgU2V0KHBheWxvYWQuaW5kZXRlcm1pbmF0ZUlkcyB8fCBbXSk7DQoNCiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXROb2RlID0gd29ya2VyQ29yZS5maW5kTm9kZUJ5SWQobm9kZXMsIG5vZGVJZCk7DQogICAgICAgICAgICAgICAgaWYgKHRhcmdldE5vZGUpIHsNCiAgICAgICAgICAgICAgICAgICAgLy8gUmVjdXJzaXZlIHRvZ2dsZSBkb3duDQogICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvZ2dsZURvd24gPSAobm9kZSwgY2hlY2spID0+IHsNCiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gU3RyaW5nKG5vZGUuaWQpOw0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNoZWNrKSB7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZElkcy5hZGQoaWQpOw0KICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkSWRzLmRlbGV0ZShpZCk7DQogICAgICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICAgICAgICBpbmRldGVybWluYXRlSWRzLmRlbGV0ZShpZCk7DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikgew0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjID0+IHRvZ2dsZURvd24oYywgY2hlY2spKTsNCiAgICAgICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICAgICAgfTsNCiAgICAgICAgICAgICAgICAgICAgdG9nZ2xlRG93bih0YXJnZXROb2RlLCBpc0NoZWNrZWQpOw0KDQogICAgICAgICAgICAgICAgICAgIC8vIFByb3BhZ2F0ZSB1cCAocmUtY2FsY3VsYXRlIGFsbCBhbmNlc3RvcnMgb3IganVzdCB0aGlzIGJyYW5jaCkNCiAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHNpbXBsaWNpdHkgYW5kIGNvcnJlY3RuZXNzIGluIGEgc3RhdGVsZXNzIHdvcmtlciwgd2UgY2FuIHJlLWNhbGN1bGF0ZSBhbGwgb3IgdXNlIGEgcGFyZW50IG1hcC4NCiAgICAgICAgICAgICAgICAgICAgLy8gTGV0J3MgaW1wbGVtZW50IGEgYnViYmxlLXVwIHVwZGF0ZS4NCiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlVXAgPSAoY3VycklkKSA9PiB7DQogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaW5kUGFyZW50ID0gKGxpc3QsIHRhcmdldCwgcGFyZW50ID0gbnVsbCkgPT4gew0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbiBvZiBsaXN0KSB7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChTdHJpbmcobi5pZCkgPT09IHRhcmdldCkgcmV0dXJuIHBhcmVudDsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG4uY2hpbGRyZW4pIHsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHAgPSBmaW5kUGFyZW50KG4uY2hpbGRyZW4sIHRhcmdldCwgbik7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocCkgcmV0dXJuIHA7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7DQogICAgICAgICAgICAgICAgICAgICAgICB9Ow0KDQogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBmaW5kUGFyZW50KG5vZGVzLCBjdXJySWQpOw0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJlbnQpIHJldHVybjsNCg0KICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBwYXJlbnQuY2hpbGRyZW4gfHwgW107DQogICAgICAgICAgICAgICAgICAgICAgICBsZXQgY2hlY2tlZENvdW50ID0gMDsNCiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBpbmRldGVybWluYXRlQ291bnQgPSAwOw0KDQogICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbi5mb3JFYWNoKGMgPT4gew0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNpZCA9IFN0cmluZyhjLmlkKTsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hlY2tlZElkcy5oYXMoY2lkKSkgY2hlY2tlZENvdW50Kys7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoaW5kZXRlcm1pbmF0ZUlkcy5oYXMoY2lkKSkgaW5kZXRlcm1pbmF0ZUNvdW50Kys7DQogICAgICAgICAgICAgICAgICAgICAgICB9KTsNCg0KICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGlkID0gU3RyaW5nKHBhcmVudC5pZCk7DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hlY2tlZENvdW50ID09PSBjaGlsZHJlbi5sZW5ndGgpIHsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja2VkSWRzLmFkZChwaWQpOw0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV0ZXJtaW5hdGVJZHMuZGVsZXRlKHBpZCk7DQogICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNoZWNrZWRDb3VudCA+IDAgfHwgaW5kZXRlcm1pbmF0ZUNvdW50ID4gMCkgew0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWRJZHMuZGVsZXRlKHBpZCk7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXRlcm1pbmF0ZUlkcy5hZGQocGlkKTsNCiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZElkcy5kZWxldGUocGlkKTsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRldGVybWluYXRlSWRzLmRlbGV0ZShwaWQpOw0KICAgICAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlVXAocGlkKTsNCiAgICAgICAgICAgICAgICAgICAgfTsNCiAgICAgICAgICAgICAgICAgICAgdXBkYXRlVXAobm9kZUlkKTsNCiAgICAgICAgICAgICAgICB9DQoNCiAgICAgICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3RvZ2dsZV9jaGVja19yZXN1bHQnLA0KICAgICAgICAgICAgICAgICAgICBpZDogaWQsDQogICAgICAgICAgICAgICAgICAgIHJlc3VsdDogew0KICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZElkczogQXJyYXkuZnJvbShjaGVja2VkSWRzKSwNCiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV0ZXJtaW5hdGVJZHM6IEFycmF5LmZyb20oaW5kZXRlcm1pbmF0ZUlkcykNCiAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIH0pOw0KICAgICAgICAgICAgICAgIGJyZWFrOw0KDQogICAgICAgICAgICBkZWZhdWx0Og0KICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBtZXNzYWdlIHR5cGU6ICR7dHlwZX1gKTsNCiAgICAgICAgfQ0KICAgIH0gY2F0Y2ggKGVycm9yKSB7DQogICAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoew0KICAgICAgICAgICAgdHlwZTogJ2Vycm9yJywNCiAgICAgICAgICAgIGlkOiBpZCwNCiAgICAgICAgICAgIGVycm9yOiB7DQogICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSwNCiAgICAgICAgICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2sNCiAgICAgICAgICAgIH0NCiAgICAgICAgfSk7DQogICAgfQ0KfTsNCg0KLy8gV29ya2VyIHJlYWR5IHNpZ25hbA0Kc2VsZi5wb3N0TWVzc2FnZSh7IHR5cGU6ICdyZWFkeScgfSk7DQo=", import.meta.url).href;
        }
      }
      this.worker = new Worker(workerPath);
      this.worker.onmessage = (e) => this.handleWorkerMessage(e);
      this.worker.onerror = (error) => {
        console.error("[high-tree] Worker error:", error);
        this.useWorkerForOperations = false;
      };
      console.log("[high-tree] Worker initialized");
    } catch (error) {
      console.warn("[high-tree] Failed to initialize worker:", error);
      this.useWorkerForOperations = false;
    }
  }
  // Handle worker messages
  handleWorkerMessage(e) {
    const { type, id, result, error } = e.data;
    if (type === "ready") {
      this.workerReady = true;
      this.useWorkerForOperations = true;
      console.log("[high-tree] Worker ready");
      return;
    }
    if (type === "error") {
      console.error("[high-tree] Worker error:", error);
      const callback2 = this.workerCallbacks.get(id);
      if (callback2 && callback2.reject) {
        callback2.reject(new Error(error.message));
        this.workerCallbacks.delete(id);
      }
      return;
    }
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
      const timeout = setTimeout(() => {
        if (this.workerCallbacks.has(id)) {
          this.workerCallbacks.delete(id);
          reject(new Error("Worker timeout"));
        }
      }, 5e3);
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
          <input type="text" id="tree-search" placeholder="${this._locale.searchPlaceholder}" class="flex-1 py-1.5 px-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-400 transition-colors">
          <div id="tree-count" class="text-[11px] text-gray-400 tabular-nums shrink-0">0</div>
        </div>

        <!-- Scroll Viewport -->
        <div id="tree-viewport" class="relative flex-1 overflow-auto custom-scrollbar">
          <div id="tree-spacer" style="width: 100%; pointer-events: none;"></div>
          <div id="tree-content-layer" class="absolute top-0 left-0 w-full tree-node-container"></div>
        </div>
      </div>
    `;
    this.treeContainer = this.container.querySelector("#tree-container");
    this.viewport = this.container.querySelector("#tree-viewport");
    this.spacer = this.container.querySelector("#tree-spacer");
    this.contentLayer = this.container.querySelector("#tree-content-layer");
    this.searchInput = this.container.querySelector("#tree-search");
    this.countDisplay = this.container.querySelector("#tree-count");
    this.viewport.addEventListener("scroll", () => {
      this.state.scrollTop = this.viewport.scrollTop;
      if (this._scrollRafId) return;
      this._scrollRafId = requestAnimationFrame(() => {
        this._scrollRafId = null;
        this.render();
      });
    });
    this.searchInput.addEventListener("input", (e) => {
      this.setState({ searchTerm: e.target.value, scrollTop: 0 });
      this.viewport.scrollTop = 0;
    });
    this._clickTimer = null;
    this._lastClickId = null;
    this.contentLayer.addEventListener("click", (e) => {
      var _a;
      const nodeEl = e.target.closest("[data-id]");
      if (!nodeEl) return;
      const nodeId = String(nodeEl.dataset.id);
      if (e.target.closest(".tree-checkbox")) {
        e.stopPropagation();
        this.handleCheckboxClick(nodeId);
        return;
      }
      if (e.target.closest(".tree-toggle")) {
        e.stopPropagation();
        if (this.state.expandedIds.has(nodeId)) {
          this.collapseNode(nodeId);
        } else {
          this.expandNode(nodeId);
        }
        return;
      }
      if (e.target.closest(".tree-edit-save")) {
        e.stopPropagation();
        this.saveEditing(nodeId, ((_a = nodeEl.querySelector(".tree-edit-input")) == null ? void 0 : _a.value) || "");
        return;
      }
      if (e.target.closest(".tree-edit-cancel")) {
        e.stopPropagation();
        this.cancelEditing();
        return;
      }
      if (e.target.closest(".tree-edit-input")) {
        e.stopPropagation();
        return;
      }
      if (this.options.editable) {
        if (this._lastClickId === nodeId && this._clickTimer) {
          clearTimeout(this._clickTimer);
          this._clickTimer = null;
          this._lastClickId = null;
          this.startEditing(nodeId);
        } else {
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
      this.handleNodeClick(nodeId, e);
    });
    this.viewport.addEventListener("keydown", (e) => {
      if (this.state.editingId) {
        const isEnter = e.key === "Enter";
        const isEsc = e.key === "Escape";
        if (isEnter || isEsc) {
          const input = this.viewport.querySelector(".tree-edit-input");
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
      const currentIndex = visibleNodes.findIndex((n) => n.id === focusedId);
      if (currentIndex === -1) return;
      const node = visibleNodes[currentIndex];
      const hasChildren = node.children || this.options.lazy && node.hasChildren;
      const isExpanded = this.state.expandedIds.has(node.id);
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          this.focusPreviousNode();
          break;
        case "ArrowDown":
          e.preventDefault();
          this.focusNextNode();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (hasChildren && !isExpanded) {
            this.toggleNode(focusedId);
          } else if (hasChildren && isExpanded) {
            this.focusNextNode();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (hasChildren && isExpanded) {
            this.toggleNode(focusedId);
          } else {
            this.focusParentNode();
          }
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          this.toggleNode(focusedId);
          break;
      }
    });
    if (this.options.onContextMenu) {
      this.contentLayer.addEventListener("contextmenu", (e) => {
        const nodeEl = e.target.closest("[data-id]");
        if (nodeEl) {
          e.preventDefault();
          const node = this.findNodeById(nodeEl.dataset.id);
          if (node) {
            this.options.onContextMenu(node, e);
          }
        }
      });
    }
    if (this.options.draggable) {
      this.contentLayer.addEventListener("dragstart", (e) => {
        const nodeEl = e.target.closest("[data-id]");
        if (nodeEl) {
          this.handleDragStart(e, nodeEl.dataset.id);
        }
      });
      this.contentLayer.addEventListener("dragover", (e) => {
        e.preventDefault();
        const nodeEl = e.target.closest("[data-id]");
        if (nodeEl) {
          this.handleDragOver(e, nodeEl.dataset.id);
        }
      });
      this.contentLayer.addEventListener("drop", (e) => {
        e.preventDefault();
        const nodeEl = e.target.closest("[data-id]");
        if (nodeEl) {
          this.handleDrop(e, nodeEl.dataset.id);
        }
      });
      this.contentLayer.addEventListener("dragleave", () => {
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
    if (this.pendingWorkerOperation) {
      return;
    }
    if (this.useWorkerForOperations && this.workerReady) {
      try {
        this.pendingWorkerOperation = true;
        const result = await this.postWorkerMessage("flatten", {
          nodes: this.state.treeData,
          searchTerm: this.state.searchTerm,
          expandedIds: Array.from(this.state.expandedIds),
          customFilterRules: null
          // Custom functions can't be serialized
        });
        let filteredResult = result;
        if (this.state.customFilter) {
          filteredResult = result.filter((node) => {
            const originalNode = this.findNodeById(node.id);
            return originalNode && this.state.customFilter(originalNode);
          });
        }
        this.state.visibleNodes = filteredResult;
        this.updateIndeterminateStates();
        const totalHeight = filteredResult.length * this.options.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
        this.countDisplay.textContent = `${filteredResult.length} items`;
        this.render();
      } catch (error) {
        console.warn("[high-tree] Worker operation failed, falling back to sync:", error);
        this.updateVisibleNodesSync();
      } finally {
        this.pendingWorkerOperation = false;
      }
    } else {
      this.updateVisibleNodesSync();
    }
  }
  // Synchronous version (fallback)
  updateVisibleNodesSync() {
    const result = [];
    this.flattenFilteredTree(this.state.treeData, 0, result);
    this.state.visibleNodes = result;
    this.updateIndeterminateStates();
    const totalHeight = result.length * this.options.rowHeight;
    this.spacer.style.height = `${totalHeight}px`;
    this.countDisplay.textContent = `${result.length} items`;
    this.render();
  }
  flattenFilteredTree(nodes, level = 0, result = []) {
    let hasMatchInBranch = false;
    const currentSearch = this.state.searchTerm.trim().toLowerCase();
    for (const node of nodes) {
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
        if (currentSearch && childHasMatch || !currentSearch && this.state.expandedIds.has(node.id)) {
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
    if (this.options.onClick) {
      this.options.onClick(node, event);
    }
    if (this.options.selectable) {
      if (this.options.multiSelect && (event.ctrlKey || event.metaKey)) {
        if (this.state.selectedIds.has(nodeId)) {
          this.state.selectedIds.delete(nodeId);
          if (this.options.cascadeSelect) this.cascadeDeselectChildren(node);
        } else {
          this.state.selectedIds.add(nodeId);
          if (this.options.cascadeSelect) this.cascadeSelectChildren(node);
        }
        this.state.lastSelectedId = nodeId;
      } else if (this.options.multiSelect && event.shiftKey && this.state.lastSelectedId) {
        const startIdx = this.state.visibleNodes.findIndex((n) => n.id === this.state.lastSelectedId);
        const endIdx = this.state.visibleNodes.findIndex((n) => n.id === nodeId);
        if (startIdx !== -1 && endIdx !== -1) {
          const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
          for (let i = min; i <= max; i++) {
            this.state.selectedIds.add(this.state.visibleNodes[i].id);
          }
        }
      } else {
        this.state.selectedIds.clear();
        this.state.selectedIds.add(nodeId);
        if (this.options.cascadeSelect) this.cascadeSelectChildren(node);
        this.state.lastSelectedId = nodeId;
      }
      this.state.focusedId = nodeId;
      this.state.focusedIndex = this.state.visibleNodes.findIndex((n) => n.id === nodeId);
      if (this.options.onSelect) {
        this.options.onSelect(this.getSelectedNodes());
      }
      this.render();
    }
    if (this.state.expandedIds.has(nodeId)) {
      this.collapseNode(nodeId);
    } else {
      await this.expandNode(nodeId);
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
    const useWorker = this.useWorkerForOperations && this.workerReady && totalNodesCount > 1e4;
    let resultMetadata = {
      timeTaken: 0,
      isWorker: useWorker,
      nodesCount: totalNodesCount
    };
    if (useWorker) {
      await this.handleCheckboxClickWorker(nodeId);
      resultMetadata.timeTaken = performance.now() - startTime;
    } else {
      this.handleCheckboxClickSync(nodeId);
      resultMetadata.timeTaken = performance.now() - startTime;
    }
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
      const result = await this.postWorkerMessage("toggle_check", {
        nodes: this.state.treeData,
        nodeId,
        checked: !this.state.checkedIds.has(String(nodeId)),
        checkedIds: Array.from(this.state.checkedIds),
        indeterminateIds: Array.from(this.state.indeterminateIds)
      });
      if (result) {
        this.state.checkedIds = new Set(result.checkedIds);
        this.state.indeterminateIds = new Set(result.indeterminateIds);
      }
    } catch (error) {
      console.error("[high-tree] Worker checkbox operation failed, falling back to sync", error);
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
      node.children.forEach((child) => this._toggleNodeCheckedRecursive(child, checked));
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
    children.forEach((c) => {
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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", nodeId);
  }
  handleDragOver(event, nodeId) {
    if (this.state.draggingNode === nodeId) return;
    event.preventDefault();
    const nodeEl = event.target.closest("[data-id]");
    if (!nodeEl) return;
    const rect = nodeEl.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const threshold = rect.height / 4;
    let position = "inside";
    if (offsetY < threshold) position = "before";
    else if (offsetY > rect.height - threshold) position = "after";
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
    console.log("handleDrop called", { draggedNodeId: this.state.draggingNode, targetNodeId });
    const draggedNodeId = this.state.draggingNode;
    if (draggedNodeId && draggedNodeId !== targetNodeId) {
      const draggedNode = this.findNodeById(draggedNodeId);
      const targetNode = this.findNodeById(targetNodeId);
      const position = this.state.dragTargetPosition || "inside";
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
    const index = this.state.visibleNodes.findIndex((n) => n.id === nodeId);
    if (index !== -1) {
      const top = index * this.options.rowHeight;
      this.viewport.scrollTop = top;
    } else {
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
      path.forEach((id) => this.state.expandedIds.add(id));
      this.updateVisibleNodes().then(() => {
        const index = this.state.visibleNodes.findIndex((n) => n.id === nodeId);
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
      case "ArrowDown":
        this.moveFocus(1);
        handled = true;
        break;
      case "ArrowUp":
        this.moveFocus(-1);
        handled = true;
        break;
      case "ArrowRight":
        if (this.state.focusedId) {
          this.expandNode(this.state.focusedId);
          handled = true;
        }
        break;
      case "ArrowLeft":
        if (this.state.focusedId) {
          this.collapseNode(this.state.focusedId);
          handled = true;
        }
        break;
      case "Enter":
        if (this.state.focusedId) {
          this.handleNodeClick(this.state.focusedId, event);
          handled = true;
        }
        break;
      case " ":
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
  _escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // Highlight search term — escapes label before injection to prevent XSS
  getHighlightedText(text) {
    const escaped = this._escapeHtml(text);
    if (!this.state.searchTerm) return escaped;
    const escapedTerm = this._escapeHtml(this.state.searchTerm).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedTerm})`, "gi");
    return escaped.replace(regex, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
  }
  updateIndeterminateStates() {
    this.state.indeterminateIds.clear();
    const check = (node) => {
      const id = String(node.id);
      if (!node.children || node.children.length === 0) {
        return this.state.checkedIds.has(id) ? "checked" : "unchecked";
      }
      const results = node.children.map((child) => check(child));
      const allChecked = results.every((r) => r === "checked");
      const allUnchecked = results.every((r) => r === "unchecked");
      if (allChecked) {
        this.state.checkedIds.add(id);
        return "checked";
      } else if (allUnchecked) {
        this.state.checkedIds.delete(id);
        return "unchecked";
      } else {
        this.state.checkedIds.delete(id);
        this.state.indeterminateIds.add(id);
        return "indeterminate";
      }
    };
    this.state.treeData.forEach(check);
  }
  /**
   * Generates a unique state key for a node to determine if re-rendering is needed.
   * @private
   */
  _getNodeStateKey(node) {
    const isExpanded = this.state.expandedIds.has(node.id) || this.state.searchTerm && !node.isMatch;
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
    const isExpanded = this.state.expandedIds.has(node.id) || this.state.searchTerm && !node.isMatch;
    const isLoading = this.state.loadingIds.has(node.id);
    const hasChildren = node.children || this.options.lazy && node.hasChildren;
    const isSelected = this.state.selectedIds.has(node.id);
    const isFocused = this.state.focusedId === node.id;
    const isChecked = this.state.checkedIds.has(node.id);
    const isIndeterminate = this.state.indeterminateIds ? this.state.indeterminateIds.has(node.id) : false;
    const isDragOver = this.state.dragOverNode === node.id;
    const isEditing = this.state.editingId === node.id;
    const dragPos = this.state.dragTargetPosition;
    let content = "";
    if (isEditing) {
      content = `
                <div class="flex items-center gap-1 flex-1 min-w-[120px] mr-2">
                    <input type="text" class="tree-edit-input flex-1 min-w-[150px] px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none"
                        value="${this._escapeHtml(node.label)}">
                    <button class="tree-edit-save p-1 shrink-0 text-green-600 hover:bg-green-50 rounded transition-colors" title="Save">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="tree-edit-cancel p-1 shrink-0 text-red-600 hover:bg-red-50 rounded transition-colors" title="Cancel">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
    } else {
      content = this.options.renderNode ? this.options.renderNode(node, this.state.searchTerm) : `
        <div class="flex items-center gap-2 overflow-hidden">
          ${hasChildren ? `<svg class="w-4 h-4 ${isExpanded ? "text-gray-500" : "text-gray-400"}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>` : `<svg class="w-4 h-4 text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`}
          <span class="text-sm text-slate-700 select-none truncate">${this.getHighlightedText(node.label)}</span>
        </div>
      `;
    }
    const dropClass = isDragOver ? dragPos === "before" ? "drop-before" : dragPos === "after" ? "drop-after" : "drop-inside" : "";
    return `
       <div
         data-id="${node.id}"
         data-state-key="${this._getNodeStateKey(node)}"
         role="treeitem"
         aria-level="${node.level + 1}"
         aria-expanded="${hasChildren ? isExpanded : ""}"
         aria-selected="${isSelected}"
         class="flex items-center px-2 hover:bg-slate-50 cursor-pointer ${node.isMatch ? "bg-amber-50/50" : ""} ${isSelected ? "bg-blue-50" : ""} ${isFocused ? "ring-1 ring-inset ring-blue-200 z-10" : ""} ${dropClass}"
         style="height: ${rowHeight}px; padding-left: ${node.level * 20 + 8}px"
         ${this.options.draggable ? 'draggable="true"' : ""}
       >
         ${this.options.checkbox ? `
           <div class="tree-checkbox mr-2 flex items-center">
             <input type="checkbox" ${isChecked ? "checked" : ""}
               class="w-4 h-4 rounded cursor-pointer accent-gray-700"
               ${isIndeterminate ? 'data-indeterminate="true"' : ""}>
           </div>
         ` : ""}
 
         <div class="tree-toggle w-5 h-5 flex items-center justify-center mr-1">
           ${isLoading ? `<svg class="w-3 h-3 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>` : hasChildren ? `<svg class="w-3.5 h-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isExpanded ? '<path d="m6 9 6 6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>'}</svg>` : ""}
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
    this.contentLayer.setAttribute("role", "tree");
    if (displayNodes.length === 0) {
      this.contentLayer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-400">
          <p class="text-sm">${this._escapeHtml(this._locale.emptyText)}</p>
        </div>
      `;
      return;
    }
    const existingEls = Array.from(this.contentLayer.children);
    const existingMap = /* @__PURE__ */ new Map();
    existingEls.forEach((el) => {
      if (el.dataset.id) existingMap.set(el.dataset.id, el);
    });
    const newIds = new Set(displayNodes.map((n) => n.id));
    existingEls.forEach((el) => {
      if (!newIds.has(el.dataset.id)) el.remove();
    });
    const tempDiv = document.createElement("div");
    let refEl = null;
    displayNodes.forEach((node) => {
      const stateKey = this._getNodeStateKey(node);
      let el = existingMap.get(node.id);
      if (el) {
        if (el.dataset.stateKey !== stateKey) {
          tempDiv.innerHTML = this._buildNodeHTML(node);
          const newEl = tempDiv.firstElementChild;
          el.replaceWith(newEl);
          el = newEl;
          existingMap.set(node.id, el);
        }
      } else {
        tempDiv.innerHTML = this._buildNodeHTML(node);
        el = tempDiv.firstElementChild;
        if (refEl) {
          refEl.after(el);
        } else {
          this.contentLayer.prepend(el);
        }
        existingMap.set(node.id, el);
      }
      if (refEl && refEl.nextSibling !== el) {
        refEl.after(el);
      }
      refEl = el;
    });
    this.contentLayer.querySelectorAll('[data-indeterminate="true"]').forEach((el) => {
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
  async expandNode(nodeId) {
    if (this.state.expandedIds.has(nodeId)) return;
    const node = this.findNodeById(nodeId);
    if (!node) return;
    if (this.options.lazy && node.hasChildren && !node.children) {
      this.state.loadingIds.add(nodeId);
      this.render();
      try {
        const newChildren = await this.options.onLoadData(node);
        const updateRecursive = (list) => list.map((n) => {
          if (n.id === nodeId) return { ...n, children: newChildren };
          if (n.children) return { ...n, children: updateRecursive(n.children) };
          return n;
        });
        this.state.treeData = updateRecursive(this.state.treeData);
        this.state.expandedIds.add(nodeId);
        if (this.options.onExpand) this.options.onExpand(node);
        if (this.options.checkbox && this.state.checkedIds.has(nodeId)) {
          const checkRecursive = (children) => {
            children.forEach((c) => {
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
      if (this.options.onExpand) this.options.onExpand(node);
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
      const expandRecursive = (nodes) => {
        nodes.forEach((node) => {
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
      const expandAndLoadRecursive = async (nodes) => {
        const loadPromises = nodes.map(async (node) => {
          if (node.children || node.hasChildren) {
            this.state.expandedIds.add(node.id);
            if (node.hasChildren && !node.children) {
              try {
                this.state.loadingIds.add(node.id);
                this.render();
                const newChildren = await this.options.onLoadData(node);
                const updateRecursive = (list) => {
                  return list.map((n) => {
                    if (n.id === node.id) return { ...n, children: newChildren };
                    if (n.children) return { ...n, children: updateRecursive(n.children) };
                    return n;
                  });
                };
                this.state.treeData = updateRecursive(this.state.treeData);
                if (this.options.checkbox && this.state.checkedIds.has(node.id)) {
                  const checkChildren = (children) => {
                    children.forEach((child) => {
                      this.state.checkedIds.add(child.id);
                      if (child.children) checkChildren(child.children);
                    });
                  };
                  checkChildren(newChildren);
                }
                if (this.options.selectable && this.options.cascadeSelect && this.state.selectedIds.has(node.id)) {
                  const selectChildren = (children) => {
                    children.forEach((child) => {
                      this.state.selectedIds.add(child.id);
                      if (child.children) selectChildren(child.children);
                    });
                  };
                  selectChildren(newChildren);
                }
                this.state.loadingIds.delete(node.id);
                await expandAndLoadRecursive(newChildren);
              } catch (error) {
                console.error("Error loading children in expandAll:", error);
                this.state.loadingIds.delete(node.id);
              }
            } else if (node.children) {
              await expandAndLoadRecursive(node.children);
            }
          }
        });
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
    return Array.from(this.state.selectedIds).map((id) => this.findNodeById(id)).filter(Boolean);
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
    return Array.from(this.state.checkedIds).map((id) => this.findNodeById(id)).filter(Boolean);
  }
  // Set filter
  setFilter(filterFn) {
    this.state.customFilter = filterFn;
    this.updateVisibleNodes();
  }
  // Clear filter
  clearFilter() {
    this.state.customFilter = null;
    this.state.searchTerm = "";
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
      node.children.forEach((child) => {
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
      node.children.forEach((child) => {
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
  insertNodeInTree(nodes, targetId, nodeToInsert, position = "inside") {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) {
        if (position === "inside") {
          if (!nodes[i].children) {
            nodes[i].children = [];
          }
          nodes[i].children.push(nodeToInsert);
        } else if (position === "before") {
          nodes.splice(i, 0, nodeToInsert);
        } else if (position === "after") {
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
        return node.children.some((child) => checkDescendant(child, targetId));
      }
      return false;
    };
    const ancestorNode = findNode(this.state.treeData, ancestorId);
    return ancestorNode && checkDescendant(ancestorNode, descendantId);
  }
}
export {
  VirtualTree as default
};
//# sourceMappingURL=high-tree.esm.js.map
