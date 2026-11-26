// Coco Villa Unawatuna - Official Document Logic & Calculations

(function () {
  const DOC_TYPES = {
    stay_invoice: {
      title: "STAY INVOICE",
      breakfastOnlyTitle: "BREAKFAST INVOICE",
      badgeText: "UNPAID — DUE AT CHECK-IN",
      badgeClass: "unpaid",
      prefix: "INV",
      defaultChannel: "Booking.com",
      showOta: true,
      showAdvancePct: false,
      showAdvancePaid: false,
      convertibleTo: "payment_receipt"
    },
    payment_receipt: {
      title: "PAYMENT RECEIPT",
      breakfastOnlyTitle: "BREAKFAST PAYMENT RECEIPT",
      badgeText: "PAID IN FULL",
      badgeClass: "paid",
      prefix: "REC",
      defaultChannel: "Booking.com",
      showOta: true,
      showAdvancePct: false,
      showAdvancePaid: false,
      convertibleTo: null
    },
    advance_request: {
      title: "ADVANCE PAYMENT REQUEST",
      breakfastOnlyTitle: "ADVANCE PAYMENT REQUEST",
      badgeText: "PRO-FORMA QUOTE — ADVANCE REQUIRED",
      badgeClass: "unpaid",
      prefix: "REQ",
      defaultChannel: "Direct Reservation",
      showOta: false,
      showAdvancePct: true,
      showAdvancePaid: false,
      convertibleTo: "advance_receipt"
    },
    advance_receipt: {
      title: "ADVANCE PAYMENT RECEIPT",
      breakfastOnlyTitle: "ADVANCE PAYMENT RECEIPT",
      badgeText: "ADVANCE PAID — CONFIRMED",
      badgeClass: "partial",
      prefix: "ADV",
      defaultChannel: "Direct Reservation",
      showOta: false,
      showAdvancePct: false,
      showAdvancePaid: true,
      convertibleTo: null
    }
  };

  const BLANK_GUEST_LINE = "-------------------------------------";

  let state = {
    docType: "stay_invoice",
    billingScope: "room_only", // "room_only", "room_breakfast", "breakfast_only"
    currencyMode: "USD",       // "USD" (USD -> LKR), "USD_ONLY", "LKR"
    breakfastRows: []          // [{ date: "YYYY-MM-DD", guests: 2 }]
  };

  // DOM References
  const el = {
    presetGrid: document.getElementById("presetGrid"),
    billingScopeToggle: document.getElementById("billingScopeToggle"),
    currencyToggle: document.getElementById("currencyToggle"),
    guestName: document.getElementById("guestName"),
    guestCountry: document.getElementById("guestCountry"),
    bookingChannel: document.getElementById("bookingChannel"),
    bookingNumber: document.getElementById("bookingNumber"),
    bookingNumGroup: document.getElementById("bookingNumGroup"),
    roomStaySection: document.getElementById("roomStaySection"),
    checkInDate: document.getElementById("checkInDate"),
    checkOutDate: document.getElementById("checkOutDate"),
    guestsCount: document.getElementById("guestsCount"),
    unitsCount: document.getElementById("unitsCount"),
    priceInputMode: document.getElementById("priceInputMode"),
    priceValue: document.getElementById("priceValue"),
    priceValueLabel: document.getElementById("priceValueLabel"),
    exchangeRateRow: document.getElementById("exchangeRateRow"),
    sellingRate: document.getElementById("sellingRate"),
    breakfastSection: document.getElementById("breakfastSection"),
    breakfastRateLkr: document.getElementById("breakfastRateLkr"),
    bfSellingRateGroup: document.getElementById("bfSellingRateGroup"),
    bfSellingRate: document.getElementById("bfSellingRate"),
    breakfastRowsContainer: document.getElementById("breakfastRowsContainer"),
    btnAddBreakfastRow: document.getElementById("btnAddBreakfastRow"),
    advanceSection: document.getElementById("advanceSection"),
    advancePercentRow: document.getElementById("advancePercentRow"),
    advancePercent: document.getElementById("advancePercent"),
    advancePaidRow: document.getElementById("advancePaidRow"),
    advancePaidLkr: document.getElementById("advancePaidLkr"),
    advancePaidLabel: document.getElementById("advancePaidLabel"),
    checkInTime: document.getElementById("checkInTime"),
    checkOutTime: document.getElementById("checkOutTime"),
    docRefOverride: document.getElementById("docRefOverride"),
    docDate: document.getElementById("docDate"),
    optNetflix: document.getElementById("optNetflix"),
    optShowBreakfastNote: document.getElementById("optShowBreakfastNote"),
    btnPrintPdf: document.getElementById("btnPrintPdf"),
    btnConvertReceipt: document.getElementById("btnConvertReceipt"),
    btnCopyWa: document.getElementById("btnCopyWa"),
    btnReset: document.getElementById("btnReset"),
    waPreview: document.getElementById("waPreview"),
    historySection: document.getElementById("historySection"),
    recentSelect: document.getElementById("recentSelect")
  };

  // Formatting Helpers
  function fmtNum(val) {
    return Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function fmtDateDisplay(isoStr) {
    if (!isoStr) return "—";
    const [y, m, d] = isoStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${days[dt.getDay()]}, ${dd}/${mm}/${y}`;
  }

  function calcNights(inStr, outStr) {
    if (!inStr || !outStr) return 0;
    const [y1, m1, d1] = inStr.split("-").map(Number);
    const [y2, m2, d2] = outStr.split("-").map(Number);
    const diff = (new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / (1000 * 60 * 60 * 24);
    return diff > 0 ? Math.round(diff) : 0;
  }

  function parseDefaultGuestCount() {
    const match = (el.guestsCount.value || "").match(/\d+/);
    return match ? Math.max(1, parseInt(match[0], 10)) : 2;
  }

  function getActiveSellingRate() {
    if (state.billingScope === "breakfast_only") {
      return parseFloat(el.bfSellingRate.value) || parseFloat(el.sellingRate.value) || VILLA_CONFIG.defaultSellingRate;
    }
    return parseFloat(el.sellingRate.value) || VILLA_CONFIG.defaultSellingRate;
  }

  // Check if advance payment applies (either Advance Payment Request OR Direct Reservation Stay-Only Invoice)
  function requiresAdvanceBreakdown() {
    if (state.docType === "advance_request") return true;
    if (
      state.docType === "stay_invoice" &&
      el.bookingChannel.value === "Direct Reservation" &&
      state.billingScope === "room_only"
    ) {
      return true;
    }
    return false;
  }

  function generateRefNumber() {
    if (el.docRefOverride.value.trim()) return el.docRefOverride.value.trim();
    const cfg = DOC_TYPES[state.docType];
    const scopeTag = state.billingScope === "breakfast_only" ? "BF" :
                     el.bookingChannel.value === "Booking.com" ? "BDC" :
                     el.bookingChannel.value === "Airbnb" ? "ABB" : "DIR";
    const baseDate = state.billingScope === "breakfast_only"
      ? (state.breakfastRows[0]?.date || el.docDate.value || new Date().toISOString().slice(0, 10))
      : (el.checkInDate.value || new Date().toISOString().slice(0, 10));
    const year = baseDate.slice(0, 4);
    const bNum = el.bookingNumber.value.trim();
    if (bNum && cfg.showOta && state.billingScope !== "breakfast_only") {
      return `${cfg.prefix}-${scopeTag}-${year}-${bNum.slice(-4)}`;
    }
    const mmdd = baseDate.slice(5, 10).replace("-", "");
    return `${cfg.prefix}-${scopeTag}-${year}-${mmdd}`;
  }

  // Breakfast Rows Management
  function addBreakfastRow(dateStr, guestsNum) {
    const defaultDate = dateStr || el.checkInDate.value || el.docDate.value || new Date().toISOString().slice(0, 10);
    const defaultGuests = guestsNum !== undefined ? guestsNum : parseDefaultGuestCount();
    state.breakfastRows.push({ date: defaultDate, guests: defaultGuests });
    renderBreakfastInputs();
  }

  function renderBreakfastInputs() {
    el.breakfastRowsContainer.innerHTML = "";
    state.breakfastRows.forEach((row, idx) => {
      const div = document.createElement("div");
      div.className = "bf-entry-row";
      div.innerHTML = `
        <input type="date" class="bf-date-input" data-idx="${idx}" value="${row.date}" />
        <span class="bf-entry-label">Guests:</span>
        <input type="number" class="bf-guests-input" data-idx="${idx}" min="1" max="20" value="${row.guests}" />
        ${state.breakfastRows.length > 1 ? `<button type="button" class="btn-remove-row" data-idx="${idx}" title="Remove">&times;</button>` : ""}
      `;
      el.breakfastRowsContainer.appendChild(div);
    });
  }

  // Initialize Static Property Details
  function initBranding() {
    document.getElementById("docLogo").src = VILLA_CONFIG.logoDataUri;
    document.getElementById("propName").textContent = VILLA_CONFIG.propertyName.toUpperCase();
    document.getElementById("propAddress").textContent = VILLA_CONFIG.address;
    document.getElementById("propContact").textContent = `Tel / WhatsApp: ${VILLA_CONFIG.phone}  |  Web: ${VILLA_CONFIG.website}`;
    document.getElementById("footerSub").textContent = `${VILLA_CONFIG.propertyName}  •  ${VILLA_CONFIG.address}  •  ${VILLA_CONFIG.phone}  •  ${VILLA_CONFIG.website}`;

    const todayIso = new Date().toISOString().slice(0, 10);
    el.docDate.value = todayIso;
    el.checkInDate.value = todayIso;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    el.checkOutDate.value = tomorrow.toISOString().slice(0, 10);

    const savedRate = localStorage.getItem("coco_selling_rate");
    const initRate = savedRate ? parseFloat(savedRate).toFixed(2) : VILLA_CONFIG.defaultSellingRate.toFixed(2);
    el.sellingRate.value = initRate;
    el.bfSellingRate.value = initRate;
    el.breakfastRateLkr.value = VILLA_CONFIG.breakfastPriceLkr;
    el.advancePercent.value = String(VILLA_CONFIG.defaultAdvancePercent);

    addBreakfastRow(todayIso, 2);
    loadHistoryDropdown();
  }

  function updateFormVisibility() {
    const cfg = DOC_TYPES[state.docType];
    const isBreakfastOnly = state.billingScope === "breakfast_only";
    const hasBreakfast = state.billingScope === "room_breakfast" || isBreakfastOnly;
    const showAdvPct = requiresAdvanceBreakdown();

    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.type === state.docType);
    });

    document.querySelectorAll(".seg-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.scope === state.billingScope);
    });

    el.roomStaySection.style.display = isBreakfastOnly ? "none" : "flex";
    el.breakfastSection.style.display = hasBreakfast ? "flex" : "none";
    el.bookingNumGroup.style.display = (cfg.showOta && !isBreakfastOnly) ? "block" : "none";
    el.bfSellingRateGroup.style.display = (isBreakfastOnly && state.currencyMode === "USD_ONLY") ? "block" : "none";

    el.advanceSection.style.display = (showAdvPct || cfg.showAdvancePaid) ? "flex" : "none";
    el.advancePercentRow.style.display = showAdvPct ? "flex" : "none";
    el.advancePaidRow.style.display = cfg.showAdvancePaid ? "flex" : "none";

    if (cfg.convertibleTo) {
      el.btnConvertReceipt.style.display = "inline-block";
      el.btnConvertReceipt.textContent = state.docType === "stay_invoice"
        ? "Mark Paid →"
        : "Record Deposit →";
    } else {
      el.btnConvertReceipt.style.display = "none";
    }

    document.querySelectorAll(".curr-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.curr === state.currencyMode);
    });

    const isUsd = state.currencyMode !== "LKR";
    const modeText = el.priceInputMode.value === "nightly" ? "Per Night Rate" : "Total Room Price";
    el.priceValueLabel.textContent = `${modeText} (${isUsd ? "USD" : "LKR"}) *`;
    el.exchangeRateRow.style.display = state.currencyMode === "USD" ? "flex" : "none";
    el.advancePaidLabel.textContent = state.currencyMode === "USD_ONLY"
      ? "Actual Advance Paid (USD) *"
      : "Actual Advance Paid (LKR) *";
  }

  function computeFinancials() {
    const isBreakfastOnly = state.billingScope === "breakfast_only";
    const hasBreakfast = state.billingScope === "room_breakfast" || isBreakfastOnly;
    const hasAdvanceReq = requiresAdvanceBreakdown();

    const nights = isBreakfastOnly ? 0 : calcNights(el.checkInDate.value, el.checkOutDate.value);
    const rawVal = isBreakfastOnly ? 0 : (parseFloat(el.priceValue.value) || 0);
    const rate = getActiveSellingRate();
    const isNightly = el.priceInputMode.value === "nightly";

    let roomUsd = 0, nightlyUsd = 0, roomLkr = 0, nightlyLkr = 0;
    if (!isBreakfastOnly) {
      if (state.currencyMode === "LKR") {
        roomLkr = isNightly ? rawVal * nights : rawVal;
        nightlyLkr = nights > 0 ? roomLkr / nights : rawVal;
      } else {
        roomUsd = isNightly ? rawVal * nights : rawVal;
        nightlyUsd = nights > 0 ? roomUsd / nights : rawVal;
        roomLkr = Math.round(roomUsd * rate * 100) / 100;
        nightlyLkr = nights > 0 ? roomLkr / nights : roomLkr;
      }
    }

    const bfRateLkr = el.breakfastRateLkr.value !== ""
      ? Math.max(0, parseFloat(el.breakfastRateLkr.value) || 0)
      : VILLA_CONFIG.breakfastPriceLkr;

    let bfTotalGuests = 0;
    let bfTotalLkr = 0;
    const bfLineItems = [];

    if (hasBreakfast) {
      state.breakfastRows.forEach(row => {
        const g = Math.max(0, parseInt(row.guests, 10) || 0);
        const lineLkr = Math.round(g * bfRateLkr * 100) / 100;
        const lineUsd = rate > 0 ? Math.round((lineLkr / rate) * 100) / 100 : 0;
        bfTotalGuests += g;
        bfTotalLkr += lineLkr;
        bfLineItems.push({ date: row.date, guests: g, lineLkr, lineUsd });
      });
    }

    const bfTotalUsd = rate > 0 ? Math.round((bfTotalLkr / rate) * 100) / 100 : 0;
    const grandTotalLkr = Math.round((roomLkr + bfTotalLkr) * 100) / 100;
    const grandTotalUsd = Math.round((roomUsd + bfTotalUsd) * 100) / 100;

    const advPct = parseFloat(el.advancePercent.value) || VILLA_CONFIG.defaultAdvancePercent;
    const reqAdvUsd = Math.round(grandTotalUsd * (advPct / 100) * 100) / 100;
    const reqRemUsd = Math.round((grandTotalUsd - reqAdvUsd) * 100) / 100;
    const reqAdvLkr = Math.round(grandTotalLkr * (advPct / 100) * 100) / 100;
    const reqRemLkr = Math.round((grandTotalLkr - reqAdvLkr) * 100) / 100;

    const paidInput = parseFloat(el.advancePaidLkr.value) || 0;
    let paidLkr = 0, paidUsd = 0, remLkr = 0, remUsd = 0;

    if (state.currencyMode === "USD_ONLY") {
      paidUsd = paidInput;
      remUsd = Math.max(0, Math.round((grandTotalUsd - paidUsd) * 100) / 100);
    } else {
      paidLkr = paidInput;
      remLkr = Math.max(0, Math.round((grandTotalLkr - paidLkr) * 100) / 100);
      if (state.currencyMode === "USD" && rate > 0) {
        paidUsd = Math.round((paidLkr / rate) * 100) / 100;
        remUsd = Math.round((remLkr / rate) * 100) / 100;
      }
    }

    return {
      isBreakfastOnly, hasBreakfast, hasAdvanceReq,
      nights, rate,
      roomUsd, nightlyUsd, roomLkr, nightlyLkr,
      bfRateLkr, bfTotalGuests, bfTotalLkr, bfTotalUsd, bfLineItems,
      grandTotalLkr, grandTotalUsd,
      advPct, reqAdvUsd, reqRemUsd, reqAdvLkr, reqRemLkr,
      paidLkr, paidUsd, remLkr, remUsd
    };
  }

  function renderPreview() {
    updateFormVisibility();
    const cfg = DOC_TYPES[state.docType];
    const calc = computeFinancials();
    const rawGuestName = el.guestName.value.trim();
    const displayGuestName = rawGuestName || BLANK_GUEST_LINE;
    const refNum = generateRefNumber();

    // Header & Meta
    const badge = document.getElementById("docBadge");
    if (state.docType === "stay_invoice" && calc.hasAdvanceReq) {
      badge.textContent = `${calc.advPct}% ADVANCE REQUIRED TO CONFIRM`;
    } else {
      badge.textContent = cfg.badgeText;
    }
    badge.className = `status-badge ${cfg.badgeClass}`;
    document.getElementById("docTitle").textContent = calc.isBreakfastOnly ? cfg.breakfastOnlyTitle : cfg.title;
    document.getElementById("viewDocRef").textContent = refNum;
    document.getElementById("viewIssueDate").textContent = fmtDateDisplay(el.docDate.value);
    document.getElementById("viewChannel").textContent = el.bookingChannel.value;

    const bRow = document.getElementById("viewBookingRow");
    if (cfg.showOta && !calc.isBreakfastOnly && el.bookingNumber.value.trim()) {
      bRow.style.display = "table-row";
      document.getElementById("viewBookingNum").textContent = `#${el.bookingNumber.value.trim()}`;
    } else {
      bRow.style.display = "none";
    }

    // Guest Card (uses "-------------------------------------" if blank)
    document.getElementById("viewGuestName").textContent = displayGuestName;
    const country = el.guestCountry.value.trim();
    const cRow = document.getElementById("viewCountryRow");
    if (country) {
      cRow.style.display = "table-row";
      document.getElementById("viewGuestCountry").textContent = country;
    } else {
      cRow.style.display = "none";
    }

    // Schedule Card
    const scheduleTitle = document.getElementById("scheduleCardTitle");
    const scheduleBody = document.getElementById("scheduleCardBody");

    if (calc.isBreakfastOnly) {
      document.getElementById("viewGuestsUnits").textContent = `Breakfast Service (${calc.bfTotalGuests} ${calc.bfTotalGuests === 1 ? "Guest" : "Guests"})`;
      scheduleTitle.textContent = "BREAKFAST SCHEDULE";
      const rowsHtml = calc.bfLineItems.map(item => `
        <tr>
          <td class="kv-key">${fmtDateDisplay(item.date)}:</td>
          <td class="kv-val">${item.guests} ${item.guests === 1 ? "Guest" : "Guests"}</td>
        </tr>
      `).join("");
      scheduleBody.innerHTML = `<table class="mini-kv-table">${rowsHtml}</table>`;
    } else {
      document.getElementById("viewGuestsUnits").textContent = `${el.guestsCount.value} • ${el.unitsCount.value}`;
      scheduleTitle.textContent = "RESERVATION SCHEDULE";
      scheduleBody.innerHTML = `
        <table class="mini-kv-table">
          <tr>
            <td class="kv-key">Check-in:</td>
            <td class="kv-val">${fmtDateDisplay(el.checkInDate.value)} (${el.checkInTime.value})</td>
          </tr>
          <tr>
            <td class="kv-key">Check-out:</td>
            <td class="kv-val">${fmtDateDisplay(el.checkOutDate.value)} (${el.checkOutTime.value})</td>
          </tr>
          <tr>
            <td class="kv-key">Duration:</td>
            <td class="kv-val">${calc.nights} ${calc.nights === 1 ? "Night" : "Nights"}</td>
          </tr>
        </table>
      `;
    }

    // Itemized Table Rows
    const itemsBody = document.getElementById("itemsBody");
    let rowsHtml = "";

    if (!calc.isBreakfastOnly) {
      const mealLabel = calc.hasBreakfast ? "Room + Breakfast Plan" : "Room Only";
      const rateDisplay = state.currencyMode === "LKR"
        ? `LKR ${fmtNum(calc.nightlyLkr)}`
        : `US$ ${fmtNum(calc.nightlyUsd)}`;
      const amtDisplay = state.currencyMode === "LKR"
        ? `LKR ${fmtNum(calc.roomLkr)}`
        : `US$ ${fmtNum(calc.roomUsd)}`;

      rowsHtml += `
        <tr>
          <td>
            <strong>Private Villa Room Accommodation</strong><br />
            <span class="item-sub">${mealLabel} &bull; All Taxes &amp; Service Charges Included</span>
          </td>
          <td class="num-col">${calc.nights} ${calc.nights === 1 ? "Night" : "Nights"}</td>
          <td class="num-col">${rateDisplay}</td>
          <td class="num-col"><strong>${amtDisplay}</strong></td>
        </tr>
      `;
    }

    if (calc.hasBreakfast) {
      calc.bfLineItems.forEach(item => {
        const bfUnitDisplay = state.currencyMode === "USD_ONLY"
          ? `US$ ${fmtNum(calc.rate > 0 ? calc.bfRateLkr / calc.rate : 0)}`
          : `LKR ${fmtNum(calc.bfRateLkr)}`;
        const bfLineDisplay = state.currencyMode === "USD_ONLY"
          ? `US$ ${fmtNum(item.lineUsd)}`
          : `LKR ${fmtNum(item.lineLkr)}`;

        rowsHtml += `
          <tr>
            <td>
              <strong>Fresh Villa Breakfast &mdash; ${fmtDateDisplay(item.date)}</strong><br />
              <span class="item-sub">Prepared fresh for ${item.guests} ${item.guests === 1 ? "guest" : "guests"} @ LKR ${fmtNum(calc.bfRateLkr)} / guest</span>
            </td>
            <td class="num-col">${item.guests} ${item.guests === 1 ? "Guest" : "Guests"}</td>
            <td class="num-col">${bfUnitDisplay}</td>
            <td class="num-col"><strong>${bfLineDisplay}</strong></td>
          </tr>
        `;
      });
    }

    itemsBody.innerHTML = rowsHtml;

    // Policy & Amenities
    const policyBox = document.getElementById("viewPolicyBox");
    const policyText = document.getElementById("viewPolicyText");
    if (state.docType === "payment_receipt") {
      policyBox.style.borderLeftColor = "#16a34a";
      policyBox.style.background = "#f0fdf4";
      policyBox.style.borderColor = "#bbf7d0";
      policyText.textContent = "Settled in full via LKR Cash. Thank you for your payment!";
    } else if (state.docType === "advance_receipt") {
      policyBox.style.borderLeftColor = "#0284c7";
      policyBox.style.background = "#f0f9ff";
      policyBox.style.borderColor = "#bae6fd";
      policyText.textContent = `Advance deposit received. Remaining balance is payable in LKR Cash upon check-in. (${VILLA_CONFIG.cashOnlyNotice})`;
    } else if (calc.hasAdvanceReq) {
      policyBox.style.borderLeftColor = "#d97706";
      policyBox.style.background = "#fffbeb";
      policyBox.style.borderColor = "#fde68a";
      policyText.textContent = `A ${calc.advPct}% advance payment is required to confirm your reservation dates. Remaining balance is due at check-in. (${VILLA_CONFIG.cashOnlyNotice})`;
    } else {
      policyBox.style.borderLeftColor = "#d97706";
      policyBox.style.background = "#fffbeb";
      policyBox.style.borderColor = "#fde68a";
      policyText.textContent = VILLA_CONFIG.cashOnlyNotice;
    }

    const incItems = [];
    if (el.optNetflix.checked && !calc.isBreakfastOnly) {
      incItems.push("✓ Complimentary Netflix included in room");
    }
    if (el.optShowBreakfastNote.checked) {
      if (calc.hasBreakfast) {
        incItems.push(`✓ Breakfast Rate Applied: LKR ${fmtNum(calc.bfRateLkr)} per guest`);
      } else {
        incItems.push(`✓ Breakfast Info: Available on request at LKR ${fmtNum(calc.bfRateLkr)} per guest`);
      }
    }
    const incBox = document.getElementById("viewInclusionsBox");
    incBox.style.display = incItems.length ? "block" : "none";
    incBox.innerHTML = incItems.join("<br />");

    renderTotalsTable(calc);
    renderWhatsAppMessage(calc, rawGuestName, refNum);
  }

  function renderTotalsTable(calc) {
    const tbl = document.getElementById("totalsTable");
    let rows = "";

    if (state.currencyMode === "USD") {
      if (!calc.isBreakfastOnly) {
        rows += `<tr><td>Room Subtotal (USD)</td><td>US$ ${fmtNum(calc.roomUsd)}</td></tr>`;
        rows += `<tr><td>Room in LKR (@ ${fmtNum(calc.rate)})</td><td>LKR ${fmtNum(calc.roomLkr)}</td></tr>`;
      }
      if (calc.hasBreakfast) {
        rows += `<tr><td>Breakfast (${calc.bfTotalGuests} ${calc.bfTotalGuests === 1 ? "Guest" : "Guests"})</td><td>LKR ${fmtNum(calc.bfTotalLkr)}</td></tr>`;
      }
      rows += `<tr class="grand-total"><td>TOTAL AMOUNT (LKR)</td><td>LKR ${fmtNum(calc.grandTotalLkr)}</td></tr>`;
      rows += `<tr class="sub-equiv"><td>USD Equivalent</td><td>US$ ${fmtNum(calc.grandTotalUsd)}</td></tr>`;

      if (state.docType === "payment_receipt") {
        rows += `<tr class="highlight-row"><td>Paid in Full (LKR Cash)</td><td>LKR ${fmtNum(calc.grandTotalLkr)}</td></tr>`;
        rows += `<tr><td>Balance Due</td><td>LKR 0.00</td></tr>`;
      } else if (calc.hasAdvanceReq) {
        rows += `<tr class="due-row"><td>${calc.advPct}% Advance Required</td><td>LKR ${fmtNum(calc.reqAdvLkr)} (US$ ${fmtNum(calc.reqAdvUsd)})</td></tr>`;
        rows += `<tr><td>Balance at Check-in</td><td>LKR ${fmtNum(calc.reqRemLkr)} (US$ ${fmtNum(calc.reqRemUsd)})</td></tr>`;
      } else if (state.docType === "advance_receipt") {
        rows += `<tr class="highlight-row"><td>Advance Paid</td><td>LKR ${fmtNum(calc.paidLkr)} (US$ ${fmtNum(calc.paidUsd)})</td></tr>`;
        rows += `<tr class="due-row"><td>Remaining Balance Due</td><td>LKR ${fmtNum(calc.remLkr)} (US$ ${fmtNum(calc.remUsd)})</td></tr>`;
      }
    } else if (state.currencyMode === "USD_ONLY") {
      if (!calc.isBreakfastOnly) {
        rows += `<tr><td>Room Subtotal (USD)</td><td>US$ ${fmtNum(calc.roomUsd)}</td></tr>`;
      }
      if (calc.hasBreakfast) {
        rows += `<tr><td>Breakfast (${calc.bfTotalGuests} ${calc.bfTotalGuests === 1 ? "Guest" : "Guests"})</td><td>US$ ${fmtNum(calc.bfTotalUsd)}</td></tr>`;
      }
      rows += `<tr class="grand-total"><td>TOTAL AMOUNT (USD)</td><td>US$ ${fmtNum(calc.grandTotalUsd)}</td></tr>`;

      if (state.docType === "payment_receipt") {
        rows += `<tr class="highlight-row"><td>Paid in Full</td><td>US$ ${fmtNum(calc.grandTotalUsd)}</td></tr>`;
        rows += `<tr><td>Balance Due</td><td>US$ 0.00</td></tr>`;
      } else if (calc.hasAdvanceReq) {
        rows += `<tr class="due-row"><td>${calc.advPct}% Advance Required</td><td>US$ ${fmtNum(calc.reqAdvUsd)}</td></tr>`;
        rows += `<tr><td>Balance at Check-in</td><td>US$ ${fmtNum(calc.reqRemUsd)}</td></tr>`;
      } else if (state.docType === "advance_receipt") {
        rows += `<tr class="highlight-row"><td>Advance Paid</td><td>US$ ${fmtNum(calc.paidUsd)}</td></tr>`;
        rows += `<tr class="due-row"><td>Remaining Balance Due</td><td>US$ ${fmtNum(calc.remUsd)}</td></tr>`;
      }
    } else {
      if (!calc.isBreakfastOnly && calc.hasBreakfast) {
        rows += `<tr><td>Room Subtotal (LKR)</td><td>LKR ${fmtNum(calc.roomLkr)}</td></tr>`;
      }
      if (calc.hasBreakfast) {
        rows += `<tr><td>Breakfast (${calc.bfTotalGuests} ${calc.bfTotalGuests === 1 ? "Guest" : "Guests"})</td><td>LKR ${fmtNum(calc.bfTotalLkr)}</td></tr>`;
      }
      rows += `<tr class="grand-total"><td>TOTAL AMOUNT (LKR)</td><td>LKR ${fmtNum(calc.grandTotalLkr)}</td></tr>`;

      if (state.docType === "payment_receipt") {
        rows += `<tr class="highlight-row"><td>Paid in Full (LKR Cash)</td><td>LKR ${fmtNum(calc.grandTotalLkr)}</td></tr>`;
        rows += `<tr><td>Balance Due</td><td>LKR 0.00</td></tr>`;
      } else if (calc.hasAdvanceReq) {
        rows += `<tr class="due-row"><td>${calc.advPct}% Advance Required</td><td>LKR ${fmtNum(calc.reqAdvLkr)}</td></tr>`;
        rows += `<tr><td>Balance at Check-in</td><td>LKR ${fmtNum(calc.reqRemLkr)}</td></tr>`;
      } else if (state.docType === "advance_receipt") {
        rows += `<tr class="highlight-row"><td>Advance Paid (LKR)</td><td>LKR ${fmtNum(calc.paidLkr)}</td></tr>`;
        rows += `<tr class="due-row"><td>Remaining Balance Due</td><td>LKR ${fmtNum(calc.remLkr)}</td></tr>`;
      }
    }

    tbl.innerHTML = rows;
  }

  function renderWhatsAppMessage(calc, rawGuestName, refNum) {
    const greetingName = rawGuestName ? rawGuestName.split(" ")[0] : "Guest";
    const inDate = fmtDateDisplay(el.checkInDate.value);
    const outDate = fmtDateDisplay(el.checkOutDate.value);
    const bNum = el.bookingNumber.value.trim();
    const bTag = bNum ? ` (#${bNum})` : "";
    let msg = "";

    // 1. Breakfast-Only Messages
    if (calc.isBreakfastOnly) {
      const bfDatesSummary = calc.bfLineItems
        .map(item => `${fmtDateDisplay(item.date)} (${item.guests} ${item.guests === 1 ? "guest" : "guests"})`)
        .join(", ");
      const totalStr = state.currencyMode === "USD_ONLY"
        ? `*US$ ${fmtNum(calc.grandTotalUsd)}*`
        : `*LKR ${fmtNum(calc.grandTotalLkr)}*`;

      if (state.docType === "payment_receipt") {
        msg = `Dear ${greetingName}, 🌿✨

` +
              `Thank you so much for your payment! We are pleased to confirm that we have received *${totalStr}* in LKR cash for your breakfast service on *${bfDatesSummary}*.

` +
              `Attached is your official payment receipt (${refNum}). We hope you enjoyed your breakfast and wish you a wonderful day ahead at *${VILLA_CONFIG.propertyName}*! ☕🥞🌴`;
      } else {
        msg = `Warm greetings from *${VILLA_CONFIG.propertyName}*, ${greetingName}! 🌿✨

` +
              `Attached is the invoice (${refNum}) for your breakfast service on *${bfDatesSummary}* at *LKR ${fmtNum(calc.bfRateLkr)} per guest* (Total: ${totalStr}).

` +
              `Whenever is most convenient for you, we kindly request that you settle this amount in *LKR cash*, as we currently accept cash payments only. Please let us know if you need anything at all! ☕🥞🌴`;
      }
      el.waPreview.value = msg;
      return;
    }

    // 2. Room Stay / Room + Breakfast Messages tailored by Document Type
    const bfClause = calc.hasBreakfast
      ? ` including breakfast for ${calc.bfTotalGuests} ${calc.bfTotalGuests === 1 ? "guest" : "guests"} (LKR ${fmtNum(calc.bfTotalLkr)})`
      : "";

    const totalAmtStr = state.currencyMode === "LKR"
      ? `*LKR ${fmtNum(calc.grandTotalLkr)}*`
      : state.currencyMode === "USD_ONLY"
      ? `*US$ ${fmtNum(calc.grandTotalUsd)}*`
      : `*LKR ${fmtNum(calc.grandTotalLkr)}* (US$ ${fmtNum(calc.grandTotalUsd)} at Sampath Bank's USD selling rate of ${fmtNum(calc.rate)} LKR)`;

    const advAmtStr = state.currencyMode === "LKR"
      ? `*LKR ${fmtNum(calc.reqAdvLkr)}*`
      : state.currencyMode === "USD_ONLY"
      ? `*US$ ${fmtNum(calc.reqAdvUsd)}*`
      : `*US$ ${fmtNum(calc.reqAdvUsd)} (LKR ${fmtNum(calc.reqAdvLkr)})*`;

    const remAmtStr = state.currencyMode === "LKR"
      ? `*LKR ${fmtNum(calc.reqRemLkr)}*`
      : state.currencyMode === "USD_ONLY"
      ? `*US$ ${fmtNum(calc.reqRemUsd)}*`
      : `*US$ ${fmtNum(calc.reqRemUsd)} (LKR ${fmtNum(calc.reqRemLkr)})*`;

    if (state.docType === "stay_invoice") {
      if (calc.hasAdvanceReq) {
        // Direct Reservation Stay-Only Invoice requiring advance deposit
        msg = `Warm greetings from *${VILLA_CONFIG.propertyName}*, ${greetingName}! 🌿✨

` +
              `Thank you for choosing to stay with us from *${inDate}* to *${outDate}* (${calc.nights} ${calc.nights === 1 ? "night" : "nights"}). Attached is your official Stay Invoice (${refNum}) for a total of ${totalAmtStr} (all taxes included).

` +
              `To confirm and secure your reservation dates, we kindly request a *${calc.advPct}% advance payment of ${advAmtStr}*, with the remaining balance of ${remAmtStr} payable in *LKR cash* upon check-in.

` +
              `Please let us know once you are ready to proceed, and we will be delighted to assist you. Looking forward to welcoming you to Unawatuna! 😊🌴`;
      } else {
        // Standard OTA / Check-in Stay Invoice
        msg = `Warm greetings from *${VILLA_CONFIG.propertyName}*, ${greetingName}! 🌿✨

` +
              `We hope you are having a wonderful stay with us! Attached is the official Stay Invoice (${refNum}) for your ${el.bookingChannel.value} reservation${bTag} from *${inDate}* to *${outDate}* (${calc.nights} ${calc.nights === 1 ? "night" : "nights"}${bfClause}) for ${totalAmtStr}.

` +
              `Whenever you have a free moment today, could you kindly help us settle the balance in *LKR cash* (as we currently accept cash payments only)? Thank you so much for your kind cooperation, and please let us know if there is anything we can do to make your stay even more comfortable! 😊🌴`;
      }
    } else if (state.docType === "payment_receipt") {
      const paidStr = state.currencyMode === "USD_ONLY"
        ? `*US$ ${fmtNum(calc.grandTotalUsd)}*`
        : `*LKR ${fmtNum(calc.grandTotalLkr)}*`;

      msg = `Dear ${greetingName}, 🌿✨

` +
            `Thank you so much! We are pleased to confirm that we have received your full cash payment of ${paidStr} for your stay at *${VILLA_CONFIG.propertyName}* (${inDate} – ${outDate}).

` +
            `Attached is your official Payment Receipt (${refNum}) for your records. Also, to help us plan smoothly for your departure, could you kindly let us know roughly what time you plan to check out (our standard check-out time is *${el.checkOutTime.value}*)? Wishing you safe travels and a wonderful rest of your trip! 😊🌴`;
    } else if (state.docType === "advance_request") {
      msg = `Warm greetings from *${VILLA_CONFIG.propertyName}*, ${greetingName}! 🌿✨

` +
            `We would be delighted to host you from *${inDate}* to *${outDate}* (${calc.nights} ${calc.nights === 1 ? "night" : "nights"}${bfClause}). Attached is your Advance Payment Request (${refNum}) with the full stay breakdown:

` +
            `• *Total Stay Amount:* ${totalAmtStr} *(all taxes & service charges included)*
` +
            `• *${calc.advPct}% Advance Deposit Required:* ${advAmtStr}
` +
            `• *Remaining Balance at Check-in:* ${remAmtStr} *(payable in LKR cash)*

` +
            `To lock in your dates, please arrange the *${calc.advPct}% advance payment* at your earliest convenience. Please feel free to reach out if you have any questions—we look forward to welcoming you! 😊🌴`;
    } else if (state.docType === "advance_receipt") {
      const paidLine = state.currencyMode === "USD_ONLY"
        ? `*US$ ${fmtNum(calc.paidUsd)}*`
        : state.currencyMode === "LKR"
        ? `*LKR ${fmtNum(calc.paidLkr)}*`
        : `*LKR ${fmtNum(calc.paidLkr)}* (US$ ${fmtNum(calc.paidUsd)})`;

      const remLine = state.currencyMode === "USD_ONLY"
        ? `*US$ ${fmtNum(calc.remUsd)}*`
        : state.currencyMode === "LKR"
        ? `*LKR ${fmtNum(calc.remLkr)}*`
        : `*LKR ${fmtNum(calc.remLkr)}* (US$ ${fmtNum(calc.remUsd)})`;

      msg = `Dear ${greetingName}, 🌿✨

` +
            `Thank you so much! We have safely received your advance payment of ${paidLine}, and your reservation at *${VILLA_CONFIG.propertyName}* is now officially confirmed!

` +
            `• *Check-in:* ${inDate} (from ${el.checkInTime.value})
` +
            `• *Check-out:* ${outDate} (by ${el.checkOutTime.value})
` +
            `• *Advance Received:* ${paidLine}
` +
            `• *Remaining Balance:* ${remLine} — payable in *LKR cash* upon check-in

` +
            `Attached is your official Advance Payment Receipt (${refNum}). We truly look forward to welcoming you to Unawatuna! 😊🌴`;
    }

    el.waPreview.value = msg;
  }

  // Save & Load Recent Guest Records
  function saveCurrentRecord() {
    const guest = el.guestName.value.trim();
    if (!guest) return;
    const record = {
      id: Date.now(),
      docType: state.docType,
      billingScope: state.billingScope,
      currencyMode: state.currencyMode,
      guestName: guest,
      guestCountry: el.guestCountry.value,
      bookingChannel: el.bookingChannel.value,
      bookingNumber: el.bookingNumber.value,
      checkInDate: el.checkInDate.value,
      checkOutDate: el.checkOutDate.value,
      guestsCount: el.guestsCount.value,
      unitsCount: el.unitsCount.value,
      priceInputMode: el.priceInputMode.value,
      priceValue: el.priceValue.value,
      sellingRate: el.sellingRate.value,
      breakfastRateLkr: el.breakfastRateLkr.value,
      breakfastRows: JSON.parse(JSON.stringify(state.breakfastRows)),
      advancePercent: el.advancePercent.value,
      advancePaidLkr: el.advancePaidLkr.value,
      checkInTime: el.checkInTime.value,
      checkOutTime: el.checkOutTime.value
    };

    localStorage.setItem("coco_selling_rate", el.sellingRate.value);
    let history = JSON.parse(localStorage.getItem("coco_doc_history") || "[]");
    history = history.filter(item => !(item.guestName === guest && item.checkInDate === record.checkInDate && item.billingScope === record.billingScope));
    history.unshift(record);
    history = history.slice(0, 12);
    localStorage.setItem("coco_doc_history", JSON.stringify(history));
    loadHistoryDropdown();
  }

  function loadHistoryDropdown() {
    const history = JSON.parse(localStorage.getItem("coco_doc_history") || "[]");
    if (history.length === 0) {
      el.historySection.style.display = "none";
      return;
    }
    el.historySection.style.display = "block";
    el.recentSelect.innerHTML = `<option value="">-- Load saved guest (${history.length}) --</option>`;
    history.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      const tag = item.billingScope === "breakfast_only" ? " [Breakfast]" : "";
      opt.textContent = `${item.guestName}${tag} (${item.checkInDate})`;
      el.recentSelect.appendChild(opt);
    });
  }

  // Event Listeners
  el.presetGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".preset-btn");
    if (!btn) return;
    state.docType = btn.dataset.type;
    if (state.billingScope !== "breakfast_only") {
      el.bookingChannel.value = DOC_TYPES[state.docType].defaultChannel;
    }
    renderPreview();
  });

  el.billingScopeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.billingScope = btn.dataset.scope;
    if (state.billingScope === "breakfast_only") {
      el.bookingChannel.value = "In-House Guest";
      if (state.currencyMode === "USD") {
        state.currencyMode = "LKR";
      }
    }
    renderPreview();
  });

  el.currencyToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".curr-btn");
    if (!btn) return;
    state.currencyMode = btn.dataset.curr;
    renderPreview();
  });

  el.btnAddBreakfastRow.addEventListener("click", () => {
    const lastRow = state.breakfastRows[state.breakfastRows.length - 1];
    let nextDate = el.checkInDate.value || el.docDate.value;
    if (lastRow && lastRow.date) {
      const [y, m, d] = lastRow.date.split("-").map(Number);
      const dt = new Date(y, m - 1, d + 1);
      nextDate = dt.toISOString().slice(0, 10);
    }
    addBreakfastRow(nextDate, lastRow ? lastRow.guests : parseDefaultGuestCount());
    renderPreview();
  });

  el.breakfastRowsContainer.addEventListener("input", (e) => {
    const idx = e.target.dataset.idx;
    if (idx === undefined) return;
    if (e.target.classList.contains("bf-date-input")) {
      state.breakfastRows[Number(idx)].date = e.target.value;
    } else if (e.target.classList.contains("bf-guests-input")) {
      state.breakfastRows[Number(idx)].guests = parseInt(e.target.value, 10) || 0;
    }
    renderPreview();
  });

  el.breakfastRowsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-remove-row");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    state.breakfastRows.splice(idx, 1);
    renderBreakfastInputs();
    renderPreview();
  });

  el.btnConvertReceipt.addEventListener("click", () => {
    const nextType = DOC_TYPES[state.docType].convertibleTo;
    if (!nextType) return;
    state.docType = nextType;
    renderPreview();
  });

  el.recentSelect.addEventListener("change", () => {
    const idx = el.recentSelect.value;
    if (idx === "") return;
    const history = JSON.parse(localStorage.getItem("coco_doc_history") || "[]");
    const rec = history[Number(idx)];
    if (!rec) return;

    state.docType = rec.docType || "stay_invoice";
    state.billingScope = rec.billingScope || "room_only";
    state.currencyMode = rec.currencyMode || "USD";
    el.guestName.value = rec.guestName || "";
    el.guestCountry.value = rec.guestCountry || "";
    el.bookingChannel.value = rec.bookingChannel || "Booking.com";
    el.bookingNumber.value = rec.bookingNumber || "";
    el.checkInDate.value = rec.checkInDate || "";
    el.checkOutDate.value = rec.checkOutDate || "";
    el.guestsCount.value = rec.guestsCount || "2 Adults";
    el.unitsCount.value = rec.unitsCount || "1 Villa Room";
    el.priceInputMode.value = rec.priceInputMode || "total";
    el.priceValue.value = rec.priceValue || "";
    el.sellingRate.value = rec.sellingRate || VILLA_CONFIG.defaultSellingRate;
    el.breakfastRateLkr.value = rec.breakfastRateLkr !== undefined ? rec.breakfastRateLkr : VILLA_CONFIG.breakfastPriceLkr;
    state.breakfastRows = rec.breakfastRows && rec.breakfastRows.length
      ? rec.breakfastRows
      : [{ date: el.checkInDate.value, guests: 2 }];
    el.advancePercent.value = String(rec.advancePercent || VILLA_CONFIG.defaultAdvancePercent);
    el.advancePaidLkr.value = rec.advancePaidLkr || "";
    el.checkInTime.value = rec.checkInTime || VILLA_CONFIG.defaultCheckInTime;
    el.checkOutTime.value = rec.checkOutTime || VILLA_CONFIG.defaultCheckOutTime;
    renderBreakfastInputs();
    renderPreview();
  });

  el.btnPrintPdf.addEventListener("click", () => {
    saveCurrentRecord();
    const guestClean = (el.guestName.value.trim() || "Guest").replace(/[^a-zA-Z0-9]/g, "_");
    const origTitle = document.title;
    document.title = `${DOC_TYPES[state.docType].prefix}_${guestClean}`;
    window.print();
    document.title = origTitle;
  });

  el.btnCopyWa.addEventListener("click", () => {
    saveCurrentRecord();
    el.waPreview.select();
    navigator.clipboard.writeText(el.waPreview.value);
    const orig = el.btnCopyWa.textContent;
    el.btnCopyWa.textContent = "Copied! ✓";
    setTimeout(() => { el.btnCopyWa.textContent = orig; }, 1800);
  });

  el.btnReset.addEventListener("click", () => {
    el.guestName.value = "";
    el.guestCountry.value = "";
    el.bookingNumber.value = "";
    el.priceValue.value = "";
    el.advancePaidLkr.value = "";
    el.docRefOverride.value = "";
    el.advancePercent.value = String(VILLA_CONFIG.defaultAdvancePercent);
    el.breakfastRateLkr.value = VILLA_CONFIG.breakfastPriceLkr;
    state.breakfastRows = [{ date: el.checkInDate.value || el.docDate.value, guests: parseDefaultGuestCount() }];
    renderBreakfastInputs();
    renderPreview();
  });

  document.getElementById("docForm").addEventListener("input", renderPreview);
  document.getElementById("docForm").addEventListener("change", renderPreview);

  initBranding();
  renderPreview();
})();
