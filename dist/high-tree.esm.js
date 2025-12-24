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
      customFilter: this.options.filter
    };
    this.worker = null;
    this.workerReady = false;
    this.useWorkerForOperations = false;
    this.workerMessageId = 0;
    this.workerCallbacks = /* @__PURE__ */ new Map();
    this.pendingWorkerOperation = false;
    this.initWorker();
    this.init();
  }
  // Initialize Web Worker
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
          workerPath = new URL("data:text/javascript;base64,LyoqDQogKiBIaWdoLVRyZWUgV2ViIFdvcmtlcg0KICogSGFuZGxlcyBDUFUtaW50ZW5zaXZlIHRyZWUgb3BlcmF0aW9ucyBvZmYgdGhlIG1haW4gdGhyZWFkDQogKi8NCg0KY2xhc3MgVHJlZVdvcmtlckNvcmUgew0KICAgIC8qKg0KICAgICAqIEZsYXR0ZW4gdHJlZSBhbmQgYXBwbHkgZmlsdGVyaW5nL3NlYXJjaA0KICAgICAqIEBwYXJhbSB7QXJyYXl9IG5vZGVzIC0gVHJlZSBub2Rlcw0KICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZXZlbCAtIEN1cnJlbnQgZGVwdGggbGV2ZWwNCiAgICAgKiBAcGFyYW0ge0FycmF5fSByZXN1bHQgLSBSZXN1bHQgYWNjdW11bGF0b3INCiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VhcmNoVGVybSAtIFNlYXJjaCBxdWVyeQ0KICAgICAqIEBwYXJhbSB7U2V0fSBleHBhbmRlZElkcyAtIFNldCBvZiBleHBhbmRlZCBub2RlIElEcw0KICAgICAqIEBwYXJhbSB7QXJyYXl9IGN1c3RvbUZpbHRlclJ1bGVzIC0gU2VyaWFsaXphYmxlIGZpbHRlciBydWxlcyAobm90IGZ1bmN0aW9ucykNCiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gaGFzTWF0Y2hJbkJyYW5jaA0KICAgICAqLw0KICAgIGZsYXR0ZW5GaWx0ZXJlZFRyZWUobm9kZXMsIGxldmVsID0gMCwgcmVzdWx0ID0gW10sIHNlYXJjaFRlcm0gPSAnJywgZXhwYW5kZWRJZHMgPSBuZXcgU2V0KCksIGN1c3RvbUZpbHRlclJ1bGVzID0gbnVsbCkgew0KICAgICAgICBsZXQgaGFzTWF0Y2hJbkJyYW5jaCA9IGZhbHNlOw0KICAgICAgICBjb25zdCBjdXJyZW50U2VhcmNoID0gc2VhcmNoVGVybS50cmltKCkudG9Mb3dlckNhc2UoKTsNCg0KICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHsNCiAgICAgICAgICAgIC8vIEFwcGx5IGN1c3RvbSBmaWx0ZXIgcnVsZXMgKGlmIGFueSkNCiAgICAgICAgICAgIGlmIChjdXN0b21GaWx0ZXJSdWxlcyAmJiAhdGhpcy5hcHBseUZpbHRlclJ1bGVzKG5vZGUsIGN1c3RvbUZpbHRlclJ1bGVzKSkgew0KICAgICAgICAgICAgICAgIGNvbnRpbnVlOw0KICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICBjb25zdCBpc01hdGNoID0gY3VycmVudFNlYXJjaCA/IG5vZGUubGFiZWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhjdXJyZW50U2VhcmNoKSA6IGZhbHNlOw0KICAgICAgICAgICAgY29uc3QgdGVtcFN1YlJlc3VsdCA9IFtdOw0KICAgICAgICAgICAgbGV0IGNoaWxkSGFzTWF0Y2ggPSBmYWxzZTsNCg0KICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHsNCiAgICAgICAgICAgICAgICBjaGlsZEhhc01hdGNoID0gdGhpcy5mbGF0dGVuRmlsdGVyZWRUcmVlKA0KICAgICAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLA0KICAgICAgICAgICAgICAgICAgICBsZXZlbCArIDEsDQogICAgICAgICAgICAgICAgICAgIHRlbXBTdWJSZXN1bHQsDQogICAgICAgICAgICAgICAgICAgIHNlYXJjaFRlcm0sDQogICAgICAgICAgICAgICAgICAgIGV4cGFuZGVkSWRzLA0KICAgICAgICAgICAgICAgICAgICBjdXN0b21GaWx0ZXJSdWxlcw0KICAgICAgICAgICAgICAgICk7DQogICAgICAgICAgICB9DQoNCiAgICAgICAgICAgIGlmICghY3VycmVudFNlYXJjaCB8fCBpc01hdGNoIHx8IGNoaWxkSGFzTWF0Y2gpIHsNCiAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7IC4uLm5vZGUsIGxldmVsLCBpc01hdGNoIH0pOw0KICAgICAgICAgICAgICAgIGlmICgoY3VycmVudFNlYXJjaCAmJiBjaGlsZEhhc01hdGNoKSB8fCAoIWN1cnJlbnRTZWFyY2ggJiYgZXhwYW5kZWRJZHMuaGFzKG5vZGUuaWQpKSkgew0KICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCguLi50ZW1wU3ViUmVzdWx0KTsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgaWYgKGlzTWF0Y2ggfHwgY2hpbGRIYXNNYXRjaCkgaGFzTWF0Y2hJbkJyYW5jaCA9IHRydWU7DQogICAgICAgICAgICB9DQogICAgICAgIH0NCiAgICAgICAgcmV0dXJuIGhhc01hdGNoSW5CcmFuY2g7DQogICAgfQ0KDQogICAgLyoqDQogICAgICogQXBwbHkgc2VyaWFsaXphYmxlIGZpbHRlciBydWxlcw0KICAgICAqIEBwYXJhbSB7T2JqZWN0fSBub2RlIC0gTm9kZSB0byBjaGVjaw0KICAgICAqIEBwYXJhbSB7QXJyYXl9IHJ1bGVzIC0gRmlsdGVyIHJ1bGVzDQogICAgICogQHJldHVybnMge2Jvb2xlYW59DQogICAgICovDQogICAgYXBwbHlGaWx0ZXJSdWxlcyhub2RlLCBydWxlcykgew0KICAgICAgICAvLyBGdXR1cmUgZW5oYW5jZW1lbnQ6IHN1cHBvcnQgc2VyaWFsaXphYmxlIGZpbHRlciBleHByZXNzaW9ucw0KICAgICAgICAvLyBGb3Igbm93LCBqdXN0IHJldHVybiB0cnVlIChubyBmaWx0ZXJpbmcpDQogICAgICAgIHJldHVybiB0cnVlOw0KICAgIH0NCg0KICAgIC8qKg0KICAgICAqIFJlbW92ZSBub2RlIGZyb20gdHJlZQ0KICAgICAqIEBwYXJhbSB7QXJyYXl9IG5vZGVzIC0gVHJlZSBub2Rlcw0KICAgICAqIEBwYXJhbSB7c3RyaW5nfSBub2RlSWQgLSBOb2RlIElEIHRvIHJlbW92ZQ0KICAgICAqIEByZXR1cm5zIHtPYmplY3R8bnVsbH0gUmVtb3ZlZCBub2RlIG9yIG51bGwNCiAgICAgKi8NCiAgICByZW1vdmVOb2RlRnJvbVRyZWUobm9kZXMsIG5vZGVJZCkgew0KICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7DQogICAgICAgICAgICBpZiAobm9kZXNbaV0uaWQgPT09IG5vZGVJZCkgew0KICAgICAgICAgICAgICAgIHJldHVybiBub2Rlcy5zcGxpY2UoaSwgMSlbMF07DQogICAgICAgICAgICB9DQogICAgICAgICAgICBpZiAobm9kZXNbaV0uY2hpbGRyZW4pIHsNCiAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVkID0gdGhpcy5yZW1vdmVOb2RlRnJvbVRyZWUobm9kZXNbaV0uY2hpbGRyZW4sIG5vZGVJZCk7DQogICAgICAgICAgICAgICAgaWYgKHJlbW92ZWQpIHJldHVybiByZW1vdmVkOw0KICAgICAgICAgICAgfQ0KICAgICAgICB9DQogICAgICAgIHJldHVybiBudWxsOw0KICAgIH0NCg0KICAgIC8qKg0KICAgICAqIEluc2VydCBub2RlIGludG8gdHJlZQ0KICAgICAqIEBwYXJhbSB7QXJyYXl9IG5vZGVzIC0gVHJlZSBub2Rlcw0KICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0YXJnZXRJZCAtIFRhcmdldCBub2RlIElEDQogICAgICogQHBhcmFtIHtPYmplY3R9IG5vZGVUb0luc2VydCAtIE5vZGUgdG8gaW5zZXJ0DQogICAgICogQHBhcmFtIHtzdHJpbmd9IHBvc2l0aW9uIC0gJ2luc2lkZScsICdiZWZvcmUnLCBvciAnYWZ0ZXInDQogICAgICogQHJldHVybnMge2Jvb2xlYW59IFN1Y2Nlc3MNCiAgICAgKi8NCiAgICBpbnNlcnROb2RlSW5UcmVlKG5vZGVzLCB0YXJnZXRJZCwgbm9kZVRvSW5zZXJ0LCBwb3NpdGlvbiA9ICdpbnNpZGUnKSB7DQogICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHsNCiAgICAgICAgICAgIGlmIChub2Rlc1tpXS5pZCA9PT0gdGFyZ2V0SWQpIHsNCiAgICAgICAgICAgICAgICBpZiAocG9zaXRpb24gPT09ICdpbnNpZGUnKSB7DQogICAgICAgICAgICAgICAgICAgIGlmICghbm9kZXNbaV0uY2hpbGRyZW4pIHsNCiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVzW2ldLmNoaWxkcmVuID0gW107DQogICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICAgICAgbm9kZXNbaV0uY2hpbGRyZW4ucHVzaChub2RlVG9JbnNlcnQpOw0KICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICdiZWZvcmUnKSB7DQogICAgICAgICAgICAgICAgICAgIG5vZGVzLnNwbGljZShpLCAwLCBub2RlVG9JbnNlcnQpOw0KICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09ICdhZnRlcicpIHsNCiAgICAgICAgICAgICAgICAgICAgbm9kZXMuc3BsaWNlKGkgKyAxLCAwLCBub2RlVG9JbnNlcnQpOw0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsNCiAgICAgICAgICAgIH0NCiAgICAgICAgICAgIGlmIChub2Rlc1tpXS5jaGlsZHJlbikgew0KICAgICAgICAgICAgICAgIGlmICh0aGlzLmluc2VydE5vZGVJblRyZWUobm9kZXNbaV0uY2hpbGRyZW4sIHRhcmdldElkLCBub2RlVG9JbnNlcnQsIHBvc2l0aW9uKSkgew0KICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICB9DQogICAgICAgIH0NCiAgICAgICAgcmV0dXJuIGZhbHNlOw0KICAgIH0NCg0KICAgIC8qKg0KICAgICAqIENoZWNrIGlmIGFuY2VzdG9ySWQgaXMgYW5jZXN0b3Igb2YgZGVzY2VuZGFudElkDQogICAgICogQHBhcmFtIHtBcnJheX0gdHJlZURhdGEgLSBGdWxsIHRyZWUgZGF0YQ0KICAgICAqIEBwYXJhbSB7c3RyaW5nfSBhbmNlc3RvcklkIC0gQW5jZXN0b3Igbm9kZSBJRA0KICAgICAqIEBwYXJhbSB7c3RyaW5nfSBkZXNjZW5kYW50SWQgLSBEZXNjZW5kYW50IG5vZGUgSUQNCiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0NCiAgICAgKi8NCiAgICBpc05vZGVEZXNjZW5kYW50KHRyZWVEYXRhLCBhbmNlc3RvcklkLCBkZXNjZW5kYW50SWQpIHsNCiAgICAgICAgY29uc3QgZmluZE5vZGUgPSAobm9kZXMsIGlkKSA9PiB7DQogICAgICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHsNCiAgICAgICAgICAgICAgICBpZiAobm9kZS5pZCA9PT0gaWQpIHJldHVybiBub2RlOw0KICAgICAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gZmluZE5vZGUobm9kZS5jaGlsZHJlbiwgaWQpOw0KICAgICAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICB9DQogICAgICAgICAgICByZXR1cm4gbnVsbDsNCiAgICAgICAgfTsNCg0KICAgICAgICBjb25zdCBjaGVja0Rlc2NlbmRhbnQgPSAobm9kZSwgdGFyZ2V0SWQpID0+IHsNCiAgICAgICAgICAgIGlmIChub2RlLmlkID09PSB0YXJnZXRJZCkgcmV0dXJuIHRydWU7DQogICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikgew0KICAgICAgICAgICAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLnNvbWUoY2hpbGQgPT4gY2hlY2tEZXNjZW5kYW50KGNoaWxkLCB0YXJnZXRJZCkpOw0KICAgICAgICAgICAgfQ0KICAgICAgICAgICAgcmV0dXJuIGZhbHNlOw0KICAgICAgICB9Ow0KDQogICAgICAgIGNvbnN0IGFuY2VzdG9yTm9kZSA9IGZpbmROb2RlKHRyZWVEYXRhLCBhbmNlc3RvcklkKTsNCiAgICAgICAgcmV0dXJuIGFuY2VzdG9yTm9kZSAmJiBjaGVja0Rlc2NlbmRhbnQoYW5jZXN0b3JOb2RlLCBkZXNjZW5kYW50SWQpOw0KICAgIH0NCg0KICAgIC8qKg0KICAgICAqIEZpbmQgbm9kZSBieSBJRA0KICAgICAqIEBwYXJhbSB7QXJyYXl9IG5vZGVzIC0gVHJlZSBub2Rlcw0KICAgICAqIEBwYXJhbSB7c3RyaW5nfSBub2RlSWQgLSBOb2RlIElEIHRvIGZpbmQNCiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fG51bGx9DQogICAgICovDQogICAgZmluZE5vZGVCeUlkKG5vZGVzLCBub2RlSWQpIHsNCiAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7DQogICAgICAgICAgICBpZiAobm9kZS5pZCA9PT0gbm9kZUlkKSByZXR1cm4gbm9kZTsNCiAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7DQogICAgICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLmZpbmROb2RlQnlJZChub2RlLmNoaWxkcmVuLCBub2RlSWQpOw0KICAgICAgICAgICAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGZvdW5kOw0KICAgICAgICAgICAgfQ0KICAgICAgICB9DQogICAgICAgIHJldHVybiBudWxsOw0KICAgIH0NCn0NCg0KLy8gV29ya2VyIGluc3RhbmNlDQpjb25zdCB3b3JrZXJDb3JlID0gbmV3IFRyZWVXb3JrZXJDb3JlKCk7DQoNCi8vIE1lc3NhZ2UgaGFuZGxlcg0Kc2VsZi5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZSkgew0KICAgIGNvbnN0IHsgdHlwZSwgaWQsIHBheWxvYWQgfSA9IGUuZGF0YTsNCg0KICAgIHRyeSB7DQogICAgICAgIGxldCByZXN1bHQ7DQoNCiAgICAgICAgc3dpdGNoICh0eXBlKSB7DQogICAgICAgICAgICBjYXNlICdmbGF0dGVuJzoNCiAgICAgICAgICAgICAgICByZXN1bHQgPSBbXTsNCiAgICAgICAgICAgICAgICBjb25zdCBleHBhbmRlZFNldCA9IG5ldyBTZXQocGF5bG9hZC5leHBhbmRlZElkcyB8fCBbXSk7DQogICAgICAgICAgICAgICAgd29ya2VyQ29yZS5mbGF0dGVuRmlsdGVyZWRUcmVlKA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLm5vZGVzLA0KICAgICAgICAgICAgICAgICAgICAwLA0KICAgICAgICAgICAgICAgICAgICByZXN1bHQsDQogICAgICAgICAgICAgICAgICAgIHBheWxvYWQuc2VhcmNoVGVybSB8fCAnJywNCiAgICAgICAgICAgICAgICAgICAgZXhwYW5kZWRTZXQsDQogICAgICAgICAgICAgICAgICAgIHBheWxvYWQuY3VzdG9tRmlsdGVyUnVsZXMgfHwgbnVsbA0KICAgICAgICAgICAgICAgICk7DQogICAgICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7DQogICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmbGF0dGVuX3Jlc3VsdCcsDQogICAgICAgICAgICAgICAgICAgIGlkOiBpZCwNCiAgICAgICAgICAgICAgICAgICAgcmVzdWx0OiByZXN1bHQNCiAgICAgICAgICAgICAgICB9KTsNCiAgICAgICAgICAgICAgICBicmVhazsNCg0KICAgICAgICAgICAgY2FzZSAncmVtb3ZlX25vZGUnOg0KICAgICAgICAgICAgICAgIC8vIENsb25lIHRyZWUgZGF0YSB0byBhdm9pZCBtdXRhdGlvbiBpc3N1ZXMNCiAgICAgICAgICAgICAgICBjb25zdCB0cmVlRm9yUmVtb3ZhbCA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocGF5bG9hZC50cmVlRGF0YSkpOw0KICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZWROb2RlID0gd29ya2VyQ29yZS5yZW1vdmVOb2RlRnJvbVRyZWUodHJlZUZvclJlbW92YWwsIHBheWxvYWQubm9kZUlkKTsNCiAgICAgICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlbW92ZV9ub2RlX3Jlc3VsdCcsDQogICAgICAgICAgICAgICAgICAgIGlkOiBpZCwNCiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZE5vZGU6IHJlbW92ZWROb2RlLA0KICAgICAgICAgICAgICAgICAgICB1cGRhdGVkVHJlZTogdHJlZUZvclJlbW92YWwNCiAgICAgICAgICAgICAgICB9KTsNCiAgICAgICAgICAgICAgICBicmVhazsNCg0KICAgICAgICAgICAgY2FzZSAnaW5zZXJ0X25vZGUnOg0KICAgICAgICAgICAgICAgIC8vIENsb25lIHRyZWUgZGF0YQ0KICAgICAgICAgICAgICAgIGNvbnN0IHRyZWVGb3JJbnNlcnRpb24gPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHBheWxvYWQudHJlZURhdGEpKTsNCiAgICAgICAgICAgICAgICBjb25zdCBpbnNlcnRTdWNjZXNzID0gd29ya2VyQ29yZS5pbnNlcnROb2RlSW5UcmVlKA0KICAgICAgICAgICAgICAgICAgICB0cmVlRm9ySW5zZXJ0aW9uLA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLnRhcmdldElkLA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLm5vZGVUb0luc2VydCwNCiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5wb3NpdGlvbiB8fCAnaW5zaWRlJw0KICAgICAgICAgICAgICAgICk7DQogICAgICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7DQogICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbnNlcnRfbm9kZV9yZXN1bHQnLA0KICAgICAgICAgICAgICAgICAgICBpZDogaWQsDQogICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGluc2VydFN1Y2Nlc3MsDQogICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRUcmVlOiB0cmVlRm9ySW5zZXJ0aW9uDQogICAgICAgICAgICAgICAgfSk7DQogICAgICAgICAgICAgICAgYnJlYWs7DQoNCiAgICAgICAgICAgIGNhc2UgJ2NoZWNrX2Rlc2NlbmRhbnQnOg0KICAgICAgICAgICAgICAgIGNvbnN0IGlzRGVzY2VuZGFudCA9IHdvcmtlckNvcmUuaXNOb2RlRGVzY2VuZGFudCgNCiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC50cmVlRGF0YSwNCiAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5hbmNlc3RvcklkLA0KICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLmRlc2NlbmRhbnRJZA0KICAgICAgICAgICAgICAgICk7DQogICAgICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7DQogICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjaGVja19kZXNjZW5kYW50X3Jlc3VsdCcsDQogICAgICAgICAgICAgICAgICAgIGlkOiBpZCwNCiAgICAgICAgICAgICAgICAgICAgaXNEZXNjZW5kYW50OiBpc0Rlc2NlbmRhbnQNCiAgICAgICAgICAgICAgICB9KTsNCiAgICAgICAgICAgICAgICBicmVhazsNCg0KICAgICAgICAgICAgY2FzZSAnZmluZF9ub2RlJzoNCiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZE5vZGUgPSB3b3JrZXJDb3JlLmZpbmROb2RlQnlJZChwYXlsb2FkLm5vZGVzLCBwYXlsb2FkLm5vZGVJZCk7DQogICAgICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7DQogICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmaW5kX25vZGVfcmVzdWx0JywNCiAgICAgICAgICAgICAgICAgICAgaWQ6IGlkLA0KICAgICAgICAgICAgICAgICAgICBub2RlOiBmb3VuZE5vZGUNCiAgICAgICAgICAgICAgICB9KTsNCiAgICAgICAgICAgICAgICBicmVhazsNCg0KICAgICAgICAgICAgZGVmYXVsdDoNCiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbWVzc2FnZSB0eXBlOiAke3R5cGV9YCk7DQogICAgICAgIH0NCiAgICB9IGNhdGNoIChlcnJvcikgew0KICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsNCiAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsDQogICAgICAgICAgICBpZDogaWQsDQogICAgICAgICAgICBlcnJvcjogew0KICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UsDQogICAgICAgICAgICAgICAgc3RhY2s6IGVycm9yLnN0YWNrDQogICAgICAgICAgICB9DQogICAgICAgIH0pOw0KICAgIH0NCn07DQoNCi8vIFdvcmtlciByZWFkeSBzaWduYWwNCnNlbGYucG9zdE1lc3NhZ2UoeyB0eXBlOiAncmVhZHknIH0pOw0K", import.meta.url).href;
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
    this.treeContainer = this.container.querySelector("#tree-container");
    this.viewport = this.container.querySelector("#tree-viewport");
    this.spacer = this.container.querySelector("#tree-spacer");
    this.contentLayer = this.container.querySelector("#tree-content-layer");
    this.searchInput = this.container.querySelector("#tree-search");
    this.countDisplay = this.container.querySelector("#tree-count");
    this.viewport.addEventListener("scroll", () => {
      this.state.scrollTop = this.viewport.scrollTop;
      this.render();
    });
    this.searchInput.addEventListener("input", (e) => {
      this.setState({ searchTerm: e.target.value, scrollTop: 0 });
      this.viewport.scrollTop = 0;
    });
    this.contentLayer.addEventListener("click", (e) => {
      if (e.target.closest(".tree-checkbox")) {
        const nodeEl2 = e.target.closest("[data-id]");
        if (nodeEl2) {
          e.stopPropagation();
          this.handleCheckboxClick(nodeEl2.dataset.id, e);
        }
        return;
      }
      const nodeEl = e.target.closest("[data-id]");
      if (nodeEl) {
        const nodeId = nodeEl.dataset.id;
        this.handleNodeClick(nodeId, e);
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
    this.treeContainer.addEventListener("keydown", (e) => {
      this.handleKeyDown(e);
    });
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
          if (this.options.cascadeSelect) {
            this.cascadeDeselectChildren(node);
          }
        } else {
          this.state.selectedIds.add(nodeId);
          if (this.options.cascadeSelect) {
            this.cascadeSelectChildren(node);
          }
        }
      } else {
        this.state.selectedIds.clear();
        this.state.selectedIds.add(nodeId);
        if (this.options.cascadeSelect) {
          this.cascadeSelectChildren(node);
        }
      }
      this.state.focusedId = nodeId;
      this.state.focusedIndex = this.state.visibleNodes.findIndex((n) => n.id === nodeId);
      if (this.options.onSelect) {
        this.options.onSelect(this.getSelectedNodes());
      }
      this.render();
    }
    if (this.state.expandedIds.has(nodeId)) {
      this.state.expandedIds.delete(nodeId);
      if (this.options.onCollapse) {
        this.options.onCollapse(node);
      }
      this.setState({});
    } else {
      if (this.options.lazy && node.hasChildren && !node.children) {
        this.state.loadingIds.add(nodeId);
        this.render();
        try {
          const newChildren = await this.options.onLoadData(node);
          const updateRecursive = (list) => {
            return list.map((n) => {
              if (n.id === nodeId) return { ...n, children: newChildren };
              if (n.children) return { ...n, children: updateRecursive(n.children) };
              return n;
            });
          };
          this.state.treeData = updateRecursive(this.state.treeData);
          this.state.expandedIds.add(nodeId);
          if (this.options.checkbox && this.state.checkedIds.has(nodeId)) {
            const checkNewChildren = (children) => {
              children.forEach((child) => {
                this.state.checkedIds.add(child.id);
                if (child.children) {
                  checkNewChildren(child.children);
                }
              });
            };
            checkNewChildren(newChildren);
          }
          if (this.options.selectable && this.options.cascadeSelect && this.state.selectedIds.has(nodeId)) {
            const selectNewChildren = (children) => {
              children.forEach((child) => {
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
  // Checkbox click handler
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
    this.render();
  }
  // Drag and drop handlers
  handleDragStart(event, nodeId) {
    this.state.draggingNode = nodeId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", nodeId);
  }
  handleDragOver(event, nodeId) {
    if (this.state.draggingNode === nodeId) return;
    event.dataTransfer.dropEffect = "move";
    if (this.state.dragOverNode !== nodeId) {
      this.state.dragOverNode = nodeId;
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
      console.log("Found nodes:", { draggedNode, targetNode });
      if (draggedNode && targetNode) {
        if (this.options.enableDefaultDragDrop) {
          console.log("Default drag-drop enabled:", this.options.enableDefaultDragDrop);
          const isDescendant = this.isNodeDescendant(draggedNode.id, targetNode.id);
          console.log("Is descendant?", isDescendant);
          if (!isDescendant) {
            console.log("Removing node:", draggedNode.id);
            const removed = this.removeNodeFromTree(this.state.treeData, draggedNode.id);
            console.log("Removed node:", removed);
            if (removed) {
              console.log("Inserting node into:", targetNode.id);
              const inserted = this.insertNodeInTree(this.state.treeData, targetNode.id, removed, "inside");
              console.log("Insert result:", inserted);
              this.updateVisibleNodes();
              console.log("✅ Node moved successfully!");
            } else {
              console.error("❌ Failed to remove node");
            }
          } else {
            console.warn("⚠️ Cannot drop node onto its descendant");
          }
        }
        if (this.options.onDrop) {
          this.options.onDrop(draggedNode, targetNode, "inside");
        }
      } else {
        console.error("❌ Could not find dragged or target node");
      }
    }
    this.state.draggingNode = null;
    this.state.dragOverNode = null;
    this.render();
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
  // Highlight search term
  getHighlightedText(text) {
    if (!this.state.searchTerm) return text;
    const regex = new RegExp(`(${this.state.searchTerm})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }
  // Actual DOM rendering
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
    this.contentLayer.innerHTML = displayNodes.map((node) => {
      const isExpanded = this.state.expandedIds.has(node.id) || this.state.searchTerm && !node.isMatch;
      const isLoading = this.state.loadingIds.has(node.id);
      const hasChildren = node.children || this.options.lazy && node.hasChildren;
      const isSelected = this.state.selectedIds.has(node.id);
      const isFocused = this.state.focusedId === node.id;
      const isChecked = this.state.checkedIds.has(node.id);
      const isDragOver = this.state.dragOverNode === node.id;
      const content = this.options.renderNode ? this.options.renderNode(node, this.state.searchTerm) : `
          <div class="flex items-center gap-2 overflow-hidden">
            ${hasChildren ? `<svg class="w-4 h-4 ${isExpanded ? "fill-blue-100 text-blue-500" : "text-slate-400"}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>` : `<svg class="w-4 h-4 text-slate-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`}
            <span class="text-sm text-slate-700 select-none truncate">${this.getHighlightedText(node.label)}</span>
          </div>
        `;
      return `
        <div 
          data-id="${node.id}"
          class="flex items-center px-2 hover:bg-blue-50/50 cursor-pointer transition-colors ${node.isMatch ? "bg-blue-50/30" : ""} ${isSelected ? "bg-blue-100 border-l-2 border-blue-500" : ""} ${isFocused ? "ring-1 ring-blue-400" : ""} ${isDragOver ? "bg-green-100" : ""}"
          style="height: ${rowHeight}px; padding-left: ${node.level * 20 + 8}px"
          ${this.options.draggable ? 'draggable="true"' : ""}
        >
          ${this.options.checkbox ? `
            <div class="tree-checkbox mr-2">
              <input type="checkbox" ${isChecked ? "checked" : ""} class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer">
            </div>
          ` : ""}
          
          <div class="w-5 h-5 flex items-center justify-center mr-1">
            ${isLoading ? `<svg class="w-3 h-3 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>` : hasChildren ? `<svg class="w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isExpanded ? '<path d="m6 9 6 6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>'}</svg>` : ""}
          </div>
          ${content}
        </div>
      `;
    }).join("");
  }
  // ========== Public API ==========
  // Find node by ID
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
  // Check node
  checkNode(nodeId, cascade = false) {
    if (!this.options.checkbox) return;
    this.state.checkedIds.add(nodeId);
    if (cascade) {
      const node = this.findNodeById(nodeId);
      if (node && node.children) {
        const checkChildren = (children) => {
          children.forEach((child) => {
            this.state.checkedIds.add(child.id);
            if (child.children) {
              checkChildren(child.children);
            }
          });
        };
        checkChildren(node.children);
      }
    }
  }
  // Uncheck node
  uncheckNode(nodeId, cascade = false) {
    if (!this.options.checkbox) return;
    this.state.checkedIds.delete(nodeId);
    if (cascade) {
      const node = this.findNodeById(nodeId);
      if (node && node.children) {
        const uncheckChildren = (children) => {
          children.forEach((child) => {
            this.state.checkedIds.delete(child.id);
            if (child.children) {
              uncheckChildren(child.children);
            }
          });
        };
        uncheckChildren(node.children);
      }
    }
  }
  // Get checked nodes
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
