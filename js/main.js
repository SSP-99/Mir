// js/main.js
(function () {
  const CL = window.CL = window.CL || {};

  document.addEventListener("DOMContentLoaded", function () {
    const nav = document.getElementById("nav");
    const actions = document.getElementById("actions");
    const viewRoot = document.getElementById("view");

    let currentCleanup = null;
    let currentViewId = null;

    function sortedViews() {
      return (Array.isArray(CL.views) ? CL.views.slice() : []).sort(
        function (a, b) {
          return Number(a.order || 0) - Number(b.order || 0);
        }
      );
    }

    function sortedActions() {
      return (Array.isArray(CL.actions) ? CL.actions.slice() : []).sort(
        function (a, b) {
          return Number(a.order || 0) - Number(b.order || 0);
        }
      );
    }

    function buildNav() {
      if (!nav) return;

      nav.innerHTML = "";

      sortedViews().forEach(function (view) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "nav-btn";
        button.dataset.view = view.id;
        button.innerHTML =
          '<i data-lucide="' + CL.util.esc(view.icon) + '"></i>' +
          "<span>" + CL.util.esc(view.label) + "</span>";

        button.addEventListener("click", function () {
          navigate(view.id);
        });

        nav.appendChild(button);
      });

      CL.util.icons();
      updateActiveNav();
    }

    function buildActions() {
      if (!actions) return;

      actions.innerHTML = "";

      sortedActions().forEach(function (action) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "btn";
        button.dataset.action = action.id;
        button.innerHTML =
          '<i data-lucide="' + CL.util.esc(action.icon) + '"></i>' +
          "<span class=\"hidden sm:inline\">" +
          CL.util.esc(action.label) +
          "</span>";

        button.addEventListener("click", function (event) {
          try {
            action.onClick(event);
          } catch (err) {
            if (CL.ui && typeof CL.ui.toast === "function") {
              CL.ui.toast("Action could not be completed.", "error");
            }
          }
        });

        actions.appendChild(button);
      });

      CL.util.icons();
    }

    function updateActiveNav() {
      if (!nav) return;

      const active =
        currentViewId ||
        (CL.store &&
          CL.store.get &&
          CL.store.get().activeTab) ||
        "";

      Array.prototype.forEach.call(
        nav.querySelectorAll("[data-view]"),
        function (button) {
          button.classList.toggle(
            "active",
            button.dataset.view === active
          );
        }
      );
    }

    function noModulesMessage() {
      if (!viewRoot) return;

      viewRoot.innerHTML =
        '<div class="min-h-[55vh] flex items-center justify-center">' +
          '<div class="panel max-w-lg w-full p-8 text-center">' +
            '<div class="w-12 h-12 mx-auto mb-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] flex items-center justify-center">' +
              '<i data-lucide="layers-3" class="w-6 h-6 text-[var(--gold)]"></i>' +
            "</div>" +
            '<h1 class="text-lg font-semibold text-[var(--text)]">No modules loaded</h1>' +
            '<p class="mt-2 text-sm text-[var(--muted)]">CivicLens is ready, but no view modules are currently registered.</p>' +
          "</div>" +
        "</div>";

      CL.util.icons();
    }

    function resolveView(id) {
      const views = sortedViews();

      return views.find(function (view) {
        return view.id === id;
      }) || null;
    }

    function firstView() {
      const views = sortedViews();
      return views.length ? views[0] : null;
    }

    function getHashView() {
      const raw = window.location.hash.replace(/^#/, "").trim();

      if (!raw) return null;

      const decoded = decodeURIComponent(raw);
      return resolveView(decoded) ? decoded : null;
    }

    function setHash(id) {
      const target = "#" + encodeURIComponent(id);

      if (window.location.hash !== target) {
        window.location.hash = target;
      }
    }

    function navigate(id) {
      const target = resolveView(id);

      if (!target) {
        const fallback = firstView();

        if (fallback) {
          setHash(fallback.id);
        } else {
          noModulesMessage();
        }

        return;
      }

      if (currentViewId === target.id && currentCleanup) {
        updateActiveNav();
        return;
      }

      if (typeof currentCleanup === "function") {
        try {
          currentCleanup();
        } catch (err) {
          /* A previous view must not prevent navigation. */
        }
      }

      currentCleanup = null;
      currentViewId = target.id;

      if (viewRoot) {
        viewRoot.innerHTML = "";

        try {
          const cleanup = target.mount(viewRoot);
          currentCleanup =
            typeof cleanup === "function" ? cleanup : null;
        } catch (err) {
          viewRoot.innerHTML =
            '<div class="panel p-6">' +
              '<div class="flex items-center gap-3 text-[var(--bad)]">' +
                '<i data-lucide="triangle-alert" class="w-5 h-5"></i>' +
                '<span class="font-semibold">Module failed to load</span>' +
              "</div>" +
              '<p class="mt-2 text-sm text-[var(--muted)]">The selected module encountered an error while rendering.</p>' +
            "</div>";

          CL.util.icons();

          if (CL.ui && typeof CL.ui.toast === "function") {
            CL.ui.toast("The selected module could not be rendered.", "error");
          }
        }
      }

      if (CL.store && typeof CL.store.update === "function") {
        CL.store.update(function (state) {
          state.activeTab = target.id;
        });
      }

      updateActiveNav();
      CL.util.icons();
    }

    function handleHash() {
      const views = sortedViews();

      if (!views.length) {
        noModulesMessage();
        return;
      }

      const requested = getHashView();
      const target = requested || firstView();

      if (!requested && target) {
        setHash(target.id);
        return;
      }

      if (target) {
        navigate(target.id);
      }
    }

    buildNav();
    buildActions();

    window.addEventListener("hashchange", handleHash);

    if (CL.bus && typeof CL.bus.on === "function") {
      CL.bus.on("state", function () {
        updateActiveNav();
      });
    }

    handleHash();

    if (CL.bus && typeof CL.bus.emit === "function") {
      CL.bus.emit("ready", {
        view: currentViewId,
        views: sortedViews().map(function (view) {
          return view.id;
        })
      });
    }
  });
})();
