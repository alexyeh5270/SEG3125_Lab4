// main.js (no <script> tags; JS only)
(() => {
  // ---------------- Optional: legacy sidebar-follow support (runs only if those IDs exist) ----------------
  (() => {
    const LG_MIN = 992;
    const margin = 16;

    const sidebar = document.getElementById("sidebar");
    const col = document.getElementById("sidebarCol");
    const spacer = document.getElementById("sidebarSpacer");
    const nav = document.querySelector(".navbar.sticky-top");

    if (!sidebar || !col || !spacer) return;

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

      const viewportTop = window.scrollY + navH + margin;
      if (viewportTop < colTop) {
        reset();
        return;
      }

      const desiredTop = window.scrollY + window.innerHeight - margin - sidebarH;
      const maxTop = colBottom - margin - sidebarH;

      if (desiredTop >= maxTop) {
        sidebar.style.position = "absolute";
        sidebar.style.left = "0";
        sidebar.style.width = "100%";
        sidebar.style.top = (maxTop - colTop) + "px";
        sidebar.style.bottom = "";
        sidebar.style.zIndex = "";
        return;
      }

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

  // ---------------- Booking + Admin logic (matches the refined <main>) ----------------
  const SERVICE_MAP = {
    "svc-basic":  { name: "Basic Tune-Up", price: "$79",  durationLabel: "~60 min",  durationMinutes: 60  },
    "svc-full":   { name: "Full Tune-Up",  price: "$149", durationLabel: "~120 min", durationMinutes: 120 },
    "svc-flat":   { name: "Flat Repair",   price: "$25+", durationLabel: "~30 min",  durationMinutes: 30  },
    "svc-brakes": { name: "Brake Service", price: "$35+", durationLabel: "~30–45 min", durationMinutes: 45 }
  };

  const KEY = "acs_bookings_v4";

  // Hours constraint: Mon–Sat 10:00–18:00
  const OPEN_MIN = 10 * 60;   // 600
  const CLOSE_MIN = 18 * 60;  // 1080
  const STEP_MIN = 15;

  const $ = (id) => document.getElementById(id);

  // Required elements (if any are missing, do nothing rather than crash)
  const radios = Array.from(document.querySelectorAll('input[name="service"]'));
  const dateEl = $("date");
  const timeEl = $("time");
  const pickupEl = $("pickup");
  const earliestPickupEl = $("earliestPickup");
  const pickupHintEl = $("pickupHint");

  const nameEl = $("name");
  const phoneEl = $("phone");
  const emailEl = $("email");
  const notesEl = $("notes");

  const btnNextService = $("btnNextService");
  const btnNextSchedule = $("btnNextSchedule");
  const confirmBtn = $("confirmBtn");
  const formAlert = $("formAlert");

  const summaryServiceLine = $("summaryServiceLine");
  const summaryDateLine = $("summaryDateLine");
  const summaryTimeLine = $("summaryTimeLine");
  const summaryPickupLine = $("summaryPickupLine");

  const dateHelp = $("dateHelp");

  const adminBody = $("adminBookingsBody");
  const clearAllBtn = $("clearAllBtn");

  const modalService = $("modalService");
  const modalDate = $("modalDate");
  const modalTime = $("modalTime");
  const modalPickup = $("modalPickup");
  const modalName = $("modalName");
  const confirmModalEl = $("confirmModal");

  const required = [
    dateEl, timeEl, pickupEl, earliestPickupEl, pickupHintEl,
    nameEl, phoneEl, emailEl, notesEl,
    btnNextService, btnNextSchedule, confirmBtn, formAlert,
    summaryServiceLine, summaryDateLine, summaryTimeLine, summaryPickupLine,
    adminBody, clearAllBtn
  ];
  if (required.some(x => !x)) return;

  // ---- Date constraints: no past dates, no Sundays ----
  const today = new Date();
  dateEl.min = today.toISOString().slice(0, 10);

  function isBusinessDayStr(yyyyMmDd) {
    if (!yyyyMmDd) return false;
    const d = new Date(yyyyMmDd + "T00:00:00");
    const day = d.getDay(); // 0=Sun ... 6=Sat
    return day >= 1 && day <= 6; // Mon–Sat
  }

  // ---- Time helpers ----
  function parseTimeToMinutes(t) {
    if (!t || !/^\d{2}:\d{2}$/.test(t)) return null;
    const [hh, mm] = t.split(":").map(Number);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function minutesToTimeStr(min) {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function isWithinHours(mins) {
    return mins !== null && mins >= OPEN_MIN && mins <= CLOSE_MIN;
  }

  // Build dropdown options (15-min steps)
  function buildTimeOptions(selectEl, startMin, endMin, stepMin, includeBlank, blankLabel) {
    selectEl.innerHTML = "";
    if (includeBlank) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = blankLabel || "Auto (earliest pickup)";
      selectEl.appendChild(opt);
    }
    for (let m = startMin; m <= endMin; m += stepMin) {
      const t = minutesToTimeStr(m);
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      selectEl.appendChild(opt);
    }
  }

  function getSelectedService() {
    const sel = radios.find(r => r.checked);
    if (!sel) return null;
    return { id: sel.id, ...SERVICE_MAP[sel.id] };
  }

  function setEnabledAnchor(a, enabled) {
    a.classList.toggle("disabled", !enabled);
    a.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function showAlert(msg) {
    formAlert.textContent = msg;
    formAlert.classList.remove("d-none");
  }

  function clearAlert() {
    formAlert.classList.add("d-none");
    formAlert.textContent = "";
  }

  function isDateValid() {
    return dateEl.value && dateEl.checkValidity() && isBusinessDayStr(dateEl.value);
  }

  function isTimeValid() {
    const m = parseTimeToMinutes(timeEl.value);
    return timeEl.checkValidity() && isWithinHours(m);
  }

  function computeEarliestPickupMinutes() {
    const svc = getSelectedService();
    const startMin = parseTimeToMinutes(timeEl.value);
    if (!svc || startMin === null) return null;

    const endMin = startMin + svc.durationMinutes;
    if (startMin < OPEN_MIN) return null;
    if (endMin > CLOSE_MIN) return null;

    return endMin;
  }

  function isPickupValidOrEmpty(earliestPickupMin) {
    if (!pickupEl.value) return true;
    const p = parseTimeToMinutes(pickupEl.value);
    return pickupEl.checkValidity()
      && isWithinHours(p)
      && earliestPickupMin !== null
      && p >= earliestPickupMin
      && p <= CLOSE_MIN;
  }

  function isContactValid() {
    return nameEl.checkValidity() && phoneEl.checkValidity() && emailEl.checkValidity();
  }

  function rebuildStartTimes() {
    const svc = getSelectedService();
    const maxStart = svc ? (CLOSE_MIN - svc.durationMinutes) : CLOSE_MIN;
    buildTimeOptions(timeEl, OPEN_MIN, maxStart, STEP_MIN, false);
    if (!timeEl.value) timeEl.value = ""; // keep blank until user chooses
  }

  function updateEarliestPickupUI() {
    const earliest = computeEarliestPickupMinutes();

    if (earliest === null) {
      earliestPickupEl.textContent = "—";
      buildTimeOptions(pickupEl, OPEN_MIN, CLOSE_MIN, STEP_MIN, true, "Auto (earliest pickup)");
      pickupHintEl.textContent = "";
      return;
    }

    const earliestStr = minutesToTimeStr(earliest);
    earliestPickupEl.textContent = earliestStr;

    // pickup options: blank (auto) + 15-min times from earliest -> close
    buildTimeOptions(pickupEl, earliest, CLOSE_MIN, STEP_MIN, true, `Auto (${earliestStr})`);
    pickupHintEl.textContent = "Pickup must be at/after earliest pickup and within 10:00–18:00 (15-min steps).";
  }

  function updateSummary() {
    const svc = getSelectedService();

    summaryServiceLine.innerHTML = svc
      ? `<i class="bi bi-check2 me-1"></i>${svc.name} — ${svc.price} <span class="text-secondary">(${svc.durationLabel})</span>`
      : `<i class="bi bi-dash me-1"></i>Select a service below`;

    summaryDateLine.innerHTML = isDateValid()
      ? `<i class="bi bi-calendar3 me-1"></i>${dateEl.value}`
      : `<i class="bi bi-dash me-1"></i>Selected date will appear here`;

    summaryTimeLine.innerHTML = isTimeValid()
      ? `<i class="bi bi-clock me-1"></i>${timeEl.value}`
      : `<i class="bi bi-dash me-1"></i>Selected start time will appear here`;

    const earliest = computeEarliestPickupMinutes();
    if (pickupEl.value) {
      summaryPickupLine.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i>${pickupEl.value}`;
    } else if (earliest !== null) {
      summaryPickupLine.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i>(auto) ${minutesToTimeStr(earliest)}`;
    } else {
      summaryPickupLine.innerHTML = `<i class="bi bi-dash me-1"></i>Pickup time (auto if blank) will appear here`;
    }
  }

  function updateDateHelp() {
    if (!dateHelp) return;

    if (dateEl.value && !isBusinessDayStr(dateEl.value)) {
      dateHelp.classList.remove("text-secondary");
      dateHelp.classList.add("text-danger");
      dateHelp.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Sunday is not available. Please choose Mon–Sat.';
    } else {
      dateHelp.classList.remove("text-danger");
      dateHelp.classList.add("text-secondary");
      dateHelp.innerHTML = '<i class="bi bi-info-circle me-1"></i>Choose a future date. Sunday is not available.';
    }
  }

  function updateControls() {
    clearAlert();

    const hasSvc = !!getSelectedService();
    setEnabledAnchor(btnNextService, hasSvc);

    updateDateHelp();
    rebuildPickupIfNeeded();

    const hasSchedule = isDateValid() && isTimeValid();
    setEnabledAnchor(btnNextSchedule, hasSchedule);

    const earliest = computeEarliestPickupMinutes();
    const pickupOK = isPickupValidOrEmpty(earliest);

    const readyToConfirm = hasSvc && hasSchedule && pickupOK && isContactValid();
    confirmBtn.disabled = !readyToConfirm;

    updateSummary();
  }

  function rebuildPickupIfNeeded() {
    // Keep pickup options synced with service/time changes
    updateEarliestPickupUI();
  }

  // ---- Admin storage ----
  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function saveBookings(bookings) {
    localStorage.setItem(KEY, JSON.stringify(bookings));
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function wouldConflict(newDate, newStartMin, newEndMin) {
    const bookings = loadBookings();
    for (const b of bookings) {
      if (b.date !== newDate) continue;
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      if (bStart === null || bEnd === null) continue;
      if (overlaps(newStartMin, newEndMin, bStart, bEnd)) return b;
    }
    return null;
  }

  function renderBookings() {
    const bookings = loadBookings();
    adminBody.innerHTML = "";

    if (bookings.length === 0) {
      adminBody.innerHTML = `<tr><td colspan="8" class="text-secondary">No appointments yet.</td></tr>`;
      return;
    }

    for (const b of bookings) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="fw-semibold">${b.serviceName}</div>
          <div class="text-secondary small">${b.servicePrice} • ${b.durationLabel}</div>
        </td>
        <td>${b.date}</td>
        <td>${b.startTime}</td>
        <td>${b.earliestPickupTime}</td>
        <td>${b.pickupTime}</td>
        <td>
          <div class="fw-semibold">${b.name}</div>
          <div class="text-secondary small">${b.phone} • ${b.email}</div>
        </td>
        <td class="text-secondary small">${b.notes ? b.notes : "—"}</td>
        <td class="text-end">
          <button type="button" class="btn btn-outline-danger btn-sm" data-del="${b.id}">
            <i class="bi bi-x-circle me-1"></i>Delete
          </button>
        </td>
      `;
      adminBody.appendChild(tr);
    }
  }

  function createBookingOrError() {
    const svc = getSelectedService();
    if (!svc) return { error: "Please select a service." };

    if (!isDateValid()) return { error: "Please select a valid date (Mon–Sat only; no past dates)." };

    if (!isTimeValid()) {
      return { error: "Start time must be within 10:00–18:00 (15-minute options)." };
    }

    const startMin = parseTimeToMinutes(timeEl.value);
    const endMin = startMin + svc.durationMinutes;
    if (endMin > CLOSE_MIN) {
      return { error: "This service would end after 18:00. Please choose an earlier start time." };
    }

    const earliestPickupMin = endMin;
    const earliestPickupStr = minutesToTimeStr(earliestPickupMin);

    let pickupStr = pickupEl.value;
    if (!pickupStr) pickupStr = earliestPickupStr;

    const pickupMin = parseTimeToMinutes(pickupStr);
    if (pickupMin === null || pickupMin < earliestPickupMin) {
      return { error: `Pickup must be at/after earliest pickup (${earliestPickupStr}).` };
    }
    if (!isWithinHours(pickupMin)) {
      return { error: "Pickup time must be within 10:00–18:00." };
    }

    if (!isContactValid()) return { error: "Please complete your contact info (name/phone/email)." };

    const conflict = wouldConflict(dateEl.value, startMin, endMin);
    if (conflict) {
      return { error: `Time conflict: another appointment overlaps (${conflict.startTime}–${conflict.endTime}).` };
    }

    return {
      booking: {
        id: String(Date.now()),
        serviceId: svc.id,
        serviceName: svc.name,
        servicePrice: svc.price,
        durationMinutes: svc.durationMinutes,
        durationLabel: svc.durationLabel,
        date: dateEl.value,
        startTime: timeEl.value,
        endTime: minutesToTimeStr(endMin),
        earliestPickupTime: earliestPickupStr,
        pickupTime: pickupStr,
        name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        email: emailEl.value.trim(),
        notes: (notesEl.value || "").trim(),
        createdAt: new Date().toISOString()
      }
    };
  }

  // ---- Events ----
  radios.forEach(r => r.addEventListener("change", () => {
    rebuildStartTimes();
    updateControls();
  }));

  dateEl.addEventListener("change", updateControls);
  timeEl.addEventListener("change", updateControls);
  pickupEl.addEventListener("change", updateControls);

  [nameEl, phoneEl, emailEl, notesEl].forEach(el => {
    el.addEventListener("input", updateControls);
  });

  confirmBtn.addEventListener("click", () => {
    clearAlert();
    updateControls();

    const res = createBookingOrError();
    if (res.error) { showAlert(res.error); return; }

    const bookings = loadBookings();
    bookings.unshift(res.booking);
    saveBookings(bookings);
    renderBookings();

    // Modal (if present)
    if (confirmModalEl && window.bootstrap && window.bootstrap.Modal) {
      if (modalService) modalService.textContent = `${res.booking.serviceName} (${res.booking.servicePrice})`;
      if (modalDate) modalDate.textContent = res.booking.date;
      if (modalTime) modalTime.textContent = res.booking.startTime;
      if (modalPickup) modalPickup.textContent = res.booking.pickupTime;
      if (modalName) modalName.textContent = res.booking.name;

      new bootstrap.Modal(confirmModalEl).show();
    }
  });

  adminBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;

    const id = btn.getAttribute("data-del");
    const bookings = loadBookings().filter(b => b.id !== id);
    saveBookings(bookings);
    renderBookings();
  });

  clearAllBtn.addEventListener("click", () => {
    saveBookings([]);
    renderBookings();
  });

  // ---- Init ----
  renderBookings();
  rebuildStartTimes();
  updateControls();
})();