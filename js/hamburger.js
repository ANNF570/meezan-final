/* ============================================================
   MEEZAN | js/hamburger.js
   Universal hamburger menu — works on EVERY page automatically.
   Just include <script src="../js/hamburger.js"></script>
   and make sure your sidebar has id="main-sidebar" and
   class="sidebar sidebar-drawer"
   ============================================================ */
(function () {

  function init() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btn     = document.getElementById('hamburger-btn');

    if (!sidebar || !overlay) return;

    /* ── Open ── */
    window.openSidebar = function () {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
      if (btn) btn.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    /* ── Close ── */
    window.closeSidebar = function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      if (btn) btn.classList.remove('open');
      document.body.style.overflow = '';
    };

    /* ── Toggle ── */
    window.toggleSidebar = function () {
      sidebar.classList.contains('open') ? window.closeSidebar() : window.openSidebar();
    };

    /* ── Hamburger button click ── */
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.toggleSidebar();
      });
    }

    /* ── Overlay click ── */
    overlay.addEventListener('click', window.closeSidebar);

    /* ── Nav links close sidebar on mobile/tablet ── */
    sidebar.querySelectorAll('.nav-item').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 1100) window.closeSidebar();
      });
    });

    /* ── ESC key ── */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') window.closeSidebar();
    });

    /* ── Swipe left to close ── */
    var touchStartX = 0;
    sidebar.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    sidebar.addEventListener('touchend', function (e) {
      if (touchStartX - e.changedTouches[0].clientX > 55) window.closeSidebar();
    }, { passive: true });

    /* ── Swipe right from left edge to open ── */
    document.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (touchStartX < 20 && e.changedTouches[0].clientX - touchStartX > 55) window.openSidebar();
    }, { passive: true });
  }

  /* Self-init after DOM */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
