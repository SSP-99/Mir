// js/core.js
(function () {
  const CL = window.CL = window.CL || {};

  /* ------------------------------ Event Bus ------------------------------ */

  const listeners = Object.create(null);

  CL.bus = {
    on: function (evt, fn) {
      if (typeof fn !== "function") return function () {};
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);

      return function () {
        CL.bus.off(evt, fn);
      };
    },

    off: function (evt, fn) {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter(function (listener) {
        return listener !== fn;
      });
    },

    emit: function (evt, data) {
      const queue = listeners[evt] ? listeners[evt].slice() : [];
      queue.forEach(function (fn) {
        try {
          fn(data);
        } catch (err) {
          setTimeout(function () {
            throw err;
          }, 0);
        }
      });
    }
  };

  /* -------------------------------- Store -------------------------------- */

  const STORAGE_KEY = "civiclens.v1";
  let state = null;

  function cloneFallbackState() {
    return {
      budget: 90,
      anonymize: true,
      selectedIssueId: null,
      activeTab: "command",
      incidents: [],
      plan: {},
      audit: []
    };
  }

  function loadState() {
    let restored = null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch (err) {
      restored = null;
    }

    if (restored && typeof restored === "object" && !Array.isArray(restored)) {
      return restored;
    }

    if (
      CL.data &&
      typeof CL.data.seedState === "function"
    ) {
      try {
        const seeded = CL.data.seedState();
        if (seeded && typeof seeded === "object") return seeded;
      } catch (err) {
        /* Fall through to minimal state. */
      }
    }

    return cloneFallbackState();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* Storage can be unavailable in file:// or restricted contexts. */
    }
  }

  state = loadState();

  CL.store = {
    get: function () {
      return state;
    },

    update: function (mutatorFn) {
      if (typeof mutatorFn === "function") {
        try {
          mutatorFn(state);
        } catch (err) {
          CL.ui && typeof CL.ui.toast === "function"
            ? CL.ui.toast("State update failed.", "error")
            : null;
          throw err;
        }
      }

      persist();
      CL.bus.emit("state", state);
      return state;
    },

    reset: function () {
      let fresh = null;

      if (
        CL.data &&
        typeof CL.data.seedState === "function"
      ) {
        try {
          fresh = CL.data.seedState();
        } catch (err) {
          fresh = null;
        }
      }

      state = fresh && typeof fresh === "object"
        ? fresh
        : cloneFallbackState();

      persist();
      CL.bus.emit("state", state);
      return state;
    }
  };

  /* -------------------------------- Utils -------------------------------- */

  function fmt(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "0";

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(value);
  }

  function f1(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "0.0";

    return value.toFixed(1);
  }

  function esc(str) {
    if (str === null || str === undefined) return "";

    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function uid(prefix) {
    const p = prefix || "id";
    const random =
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36);

    return p + "-" + random;
  }

  function icons() {
    if (
      window.lucide &&
      typeof window.lucide.createIcons === "function"
    ) {
      try {
        window.lucide.createIcons();
      } catch (err) {
        /* Icon rendering is optional. */
      }
    }
  }

  function el(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();

    return template.content.firstElementChild || document.createElement("div");
  }

  function debounce(fn, ms) {
    let timer = null;

    return function () {
      const context = this;
      const args = arguments;

      clearTimeout(timer);

      timer = setTimeout(function () {
        fn.apply(context, args);
      }, Number(ms) || 0);
    };
  }

  function download(name, text, mime) {
    const blob = new Blob(
      [String(text === undefined || text === null ? "" : text)],
      {
        type: mime || "text/plain;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = name || "download.txt";
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  CL.util = {
    fmt: fmt,
    f1: f1,
    esc: esc,
    uid: uid,
    icons: icons,
    el: el,
    debounce: debounce,
    download: download
  };

  /* ---------------------------------- UI --------------------------------- */

  const overlays = Object.create(null);
  let activeOverlay = null;
  let activeOverlayName = null;
  let activeOverlayProps = null;
  let escapeBound = false;

  function ensureOverlayRoot() {
    let root = document.getElementById("overlay-root");

    if (!root) {
      root = document.createElement("div");
      root.id = "overlay-root";
      document.body.appendChild(root);
    }

    return root;
  }

  function toast(msg, type) {
    const root = document.getElementById("toast-root");

    if (!root) return;

    const toastType = ["info", "success", "warn", "error"].indexOf(type) >= 0
      ? type
      : "info";

    const item = document.createElement("div");
    item.className = "toast " + toastType;
    item.setAttribute("role", "status");

    const iconName = {
      info: "info",
      success: "check-circle-2",
      warn: "alert-triangle",
      error: "x-circle"
    }[toastType];

    item.innerHTML =
      '<i data-lucide="' + iconName + '" class="w-4 h-4 shrink-0 mt-0.5"></i>' +
      '<div class="flex-1 min-w-0">' + esc(msg) + "</div>" +
      '<button type="button" class="text-[var(--muted)] hover:text-[var(--text)]" aria-label="Dismiss">' +
      '<i data-lucide="x" class="w-4 h-4"></i>' +
      "</button>";

    const dismiss = item.querySelector("button");

    if (dismiss) {
      dismiss.addEventListener("click", function () {
        item.remove();
      });
    }

    root.appendChild(item);
    icons();

    setTimeout(function () {
      if (item.isConnected) item.remove();
    }, 4500);
  }

  function registerOverlay(name, definition) {
    if (!name || !definition || typeof definition.mount !== "function") {
      return;
    }

    overlays[name] = {
      mount: definition.mount,
      unmount:
        typeof definition.unmount === "function"
          ? definition.unmount
          : function () {}
    };
  }

  function close() {
    if (!activeOverlay) return;

    const current = activeOverlay;
    const currentName = activeOverlayName;

    try {
      if (
        overlays[currentName] &&
        typeof overlays[currentName].unmount === "function"
      ) {
        overlays[currentName].unmount();
      }
    } catch (err) {
      /* Overlay cleanup should never prevent closing. */
    }

    if (current.parentNode) {
      current.parentNode.removeChild(current);
    }

    activeOverlay = null;
    activeOverlayName = null;
    activeOverlayProps = null;
  }

  function open(name, props) {
    const definition = overlays[name];

    if (!definition) {
      toast("Overlay module is not available.", "warn");
      return;
    }

    close();

    const root = ensureOverlayRoot();
    const backdrop = document.createElement("div");
    const panel = document.createElement("section");

    backdrop.className =
      name === "portal" ? "drawer-backdrop" : "modal-backdrop";

    panel.className =
      name === "portal" ? "drawer" : "modal";

    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    root.appendChild(backdrop);
    root.appendChild(panel);

    const closeFromBackdrop = function (event) {
      if (event.target === backdrop) close();
    };

    backdrop.addEventListener("mousedown", closeFromBackdrop);

    activeOverlay = panel;
    activeOverlayName = name;
    activeOverlayProps = props || {};

    if (!escapeBound) {
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && activeOverlay) {
          close();
        }
      });
      escapeBound = true;
    }

    try {
      definition.mount(panel, props || {});
    } catch (err) {
      close();
      toast("Unable to open this module.", "error");
      return;
    }

    icons();
    return panel;
  }

  CL.ui = {
    toast: toast,
    registerOverlay: registerOverlay,
    open: open,
    close: close
  };

  /* ------------------------------ Registries ------------------------------ */

  CL.views = Array.isArray(CL.views) ? CL.views : [];
  CL.actions = Array.isArray(CL.actions) ? CL.actions : [];

  CL.registerView = function (id, definition) {
    if (!id || !definition || typeof definition.mount !== "function") {
      return;
    }

    const view = {
      id: String(id),
      label: definition.label || String(id),
      icon: definition.icon || "circle",
      order: Number.isFinite(Number(definition.order))
        ? Number(definition.order)
        : 9999,
      mount: definition.mount
    };

    const existingIndex = CL.views.findIndex(function (item) {
      return item.id === view.id;
    });

    if (existingIndex >= 0) {
      CL.views[existingIndex] = view;
    } else {
      CL.views.push(view);
    }
  };

  CL.registerAction = function (definition) {
    if (
      !definition ||
      !definition.id ||
      typeof definition.onClick !== "function"
    ) {
      return;
    }

    const action = {
      id: String(definition.id),
      label: definition.label || String(definition.id),
      icon: definition.icon || "circle",
      order: Number.isFinite(Number(definition.order))
        ? Number(definition.order)
        : 9999,
      onClick: definition.onClick
    };

    const existingIndex = CL.actions.findIndex(function (item) {
      return item.id === action.id;
    });

    if (existingIndex >= 0) {
      CL.actions[existingIndex] = action;
    } else {
      CL.actions.push(action);
    }
  };
})();
