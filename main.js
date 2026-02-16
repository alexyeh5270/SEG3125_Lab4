(() => {
  const LG_MIN = 992;
  const margin = 16;

  const sidebar = document.getElementById("sidebar");
  const col = document.getElementById("sidebarCol");
  const spacer = document.getElementById("sidebarSpacer");
  const nav = document.querySelector(".navbar.sticky-top");

  console.log("[sidebar] script loaded", { sidebar, col, spacer });

  if (!sidebar || !col || !spacer) {
    console.warn("[sidebar] Missing #sidebar / #sidebarCol / #sidebarSpacer. Sidebar will not follow.");
    return;
  }

  function reset() {
    sidebar.style.position = "";
    sidebar.style.left = "";
    sidebar.style.width = "";
    sidebar.style.bottom = "";
    sidebar.style.top = "";
    sidebar.style.zIndex = "";
    spacer.style.height = "0px";
  }

  function place() {
    if (window.innerWidth < LG_MIN) {
      reset();
      return;
    }

    const navH = nav ? nav.getBoundingClientRect().height : 0;

    const sidebarH = sidebar.offsetHeight;
    spacer.style.height = sidebarH + "px";

    const colRect = col.getBoundingClientRect();
    const colTop = colRect.top + window.scrollY;
    const colLeft = colRect.left + window.scrollX;
    const colWidth = colRect.width;
    const colBottom = colTop + col.offsetHeight;

    // Start sticking only after the column reaches under navbar
    const viewportTop = window.scrollY + navH + margin;
    if (viewportTop < colTop) {
      reset();
      return;
    }

    // Desired top if we anchor sidebar to viewport bottom
    const desiredTop = window.scrollY + window.innerHeight - margin - sidebarH;

    // Max top allowed so sidebar never extends beyond the column
    const maxTop = colBottom - margin - sidebarH;

    if (desiredTop >= maxTop) {
      // Park at bottom of column
      sidebar.style.position = "absolute";
      sidebar.style.left = "";
      sidebar.style.width = "";
      sidebar.style.top = (maxTop - colTop) + "px";
      sidebar.style.bottom = "";
      sidebar.style.zIndex = "";
      return;
    }

    // Fixed to viewport bottom
    sidebar.style.position = "fixed";
    sidebar.style.left = colLeft + "px";
    sidebar.style.width = colWidth + "px";
    sidebar.style.bottom = margin + "px";
    sidebar.style.top = "";
    sidebar.style.zIndex = "1010";
  }

  window.addEventListener("scroll", place, { passive: true });
  window.addEventListener("resize", place);
  window.addEventListener("load", place);
  place();
})();
