(function () {
  "use strict";

  const STORAGE_PREFIX = "abstract-screening-session";

  const state = {
    fileName: "",
    sessionKey: "",
    records: [],
    order: [],
    cursor: 0,
    decisions: [],
  };

  const elements = {
    risFile: document.getElementById("risFile"),
    loadBtn: document.getElementById("loadBtn"),
    restartBtn: document.getElementById("restartBtn"),
    statusText: document.getElementById("statusText"),
    screeningPanel: document.getElementById("screeningPanel"),
    progressText: document.getElementById("progressText"),
    progressFill: document.getElementById("progressFill"),
    acceptCount: document.getElementById("acceptCount"),
    unsureCount: document.getElementById("unsureCount"),
    declineCount: document.getElementById("declineCount"),
    recordTitle: document.getElementById("recordTitle"),
    recordMeta: document.getElementById("recordMeta"),
    recordDoi: document.getElementById("recordDoi"),
    recordAbstract: document.getElementById("recordAbstract"),
    acceptBtn: document.getElementById("acceptBtn"),
    unsureBtn: document.getElementById("unsureBtn"),
    declineBtn: document.getElementById("declineBtn"),
    decisionButtons: document.getElementById("decisionButtons"),
    completePanel: document.getElementById("completePanel"),
    completeSummary: document.getElementById("completeSummary"),
    downloadCsvBtn: document.getElementById("downloadCsvBtn"),
    downloadJsonBtn: document.getElementById("downloadJsonBtn"),
    downloadCsvBtnTop: document.getElementById("downloadCsvBtnTop"),
    downloadJsonBtnTop: document.getElementById("downloadJsonBtnTop"),
  };

  wireEvents();
  render();

  function wireEvents() {
    elements.loadBtn.addEventListener("click", loadSelectedFile);
    elements.restartBtn.addEventListener("click", restartSession);
    elements.acceptBtn.addEventListener("click", function () {
      recordDecision("accept");
    });
    elements.unsureBtn.addEventListener("click", function () {
      recordDecision("unsure");
    });
    elements.declineBtn.addEventListener("click", function () {
      recordDecision("decline");
    });
    elements.downloadCsvBtn.addEventListener("click", downloadCsv);
    elements.downloadJsonBtn.addEventListener("click", downloadJson);
    elements.downloadCsvBtnTop.addEventListener("click", downloadCsv);
    elements.downloadJsonBtnTop.addEventListener("click", downloadJson);
    document.addEventListener("keydown", handleKeyboardDecision);
  }

  function handleKeyboardDecision(event) {
    if (!state.records.length || state.cursor >= state.order.length) {
      return;
    }
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "a" || key === "1") {
      recordDecision("accept");
    } else if (key === "u" || key === "2") {
      recordDecision("unsure");
    } else if (key === "d" || key === "3") {
      recordDecision("decline");
    }
  }

  function loadSelectedFile() {
    const file = elements.risFile.files && elements.risFile.files[0];
    if (!file) {
      setStatus("Choose a .ris file first.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const text = String(event.target && event.target.result ? event.target.result : "");
        const records = parseRis(text);
        if (!records.length) {
          throw new Error("No RIS records found.");
        }

        state.fileName = file.name;
        state.sessionKey = buildSessionKey(file);
        const restored = tryRestoreSession(records.length);
        if (!restored) {
          startNewSession(records);
        }
        setStatus("Loaded " + state.records.length + " records from " + state.fileName + ".");
        render();
      } catch (error) {
        setStatus("Failed to parse RIS: " + (error && error.message ? error.message : "Unknown error"));
      }
    };
    reader.onerror = function () {
      setStatus("Unable to read the selected file.");
    };
    reader.readAsText(file, "utf-8");
  }

  function tryRestoreSession(expectedCount) {
    const raw = localStorage.getItem(state.sessionKey);
    if (!raw) {
      return false;
    }

    try {
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.records) || !Array.isArray(saved.order) || !Array.isArray(saved.decisions)) {
        return false;
      }
      if (saved.records.length !== expectedCount) {
        return false;
      }

      const shouldRestore = window.confirm(
        "A saved session was found for this file. Press OK to resume, or Cancel to start over."
      );
      if (!shouldRestore) {
        localStorage.removeItem(state.sessionKey);
        return false;
      }

      state.records = saved.records;
      state.order = saved.order;
      state.cursor = Number.isInteger(saved.cursor) ? saved.cursor : 0;
      state.decisions = saved.decisions;
      return true;
    } catch (_ignored) {
      return false;
    }
  }

  function startNewSession(records) {
    state.records = records;
    state.order = shuffle(records.map(function (_item, index) { return index; }));
    state.cursor = 0;
    state.decisions = [];
    persistSession();
  }

  function restartSession() {
    if (!state.records.length) {
      return;
    }
    const confirmed = window.confirm("Restart and clear all decisions for this file?");
    if (!confirmed) {
      return;
    }
    state.order = shuffle(state.records.map(function (_item, index) { return index; }));
    state.cursor = 0;
    state.decisions = [];
    persistSession();
    setStatus("Session restarted.");
    render();
  }

  function recordDecision(decision) {
    if (!state.records.length || state.cursor >= state.order.length) {
      return;
    }

    const recordIndex = state.order[state.cursor];
    const record = state.records[recordIndex];
    state.decisions.push({
      screen_order: state.cursor + 1,
      decision: decision,
      decided_at: new Date().toISOString(),
      record_id: record.recordId,
      title: record.title,
      doi: record.doi,
      doi_url: record.doi ? doiToUrl(record.doi) : "",
      year: record.year,
      journal: record.journal,
      authors: record.authors.join("; "),
      abstract: record.abstract,
    });
    state.cursor += 1;
    persistSession();
    render();
  }

  function render() {
    const total = state.records.length;
    const screened = Math.min(state.cursor, total);

    elements.screeningPanel.classList.toggle("hidden", total === 0);
    elements.completePanel.classList.toggle("hidden", !(total > 0 && screened >= total));
    elements.restartBtn.disabled = total === 0;

    const counts = getDecisionCounts();
    elements.acceptCount.textContent = "Accept: " + counts.accept;
    elements.unsureCount.textContent = "Unsure: " + counts.unsure;
    elements.declineCount.textContent = "Decline: " + counts.decline;
    elements.progressText.textContent = screened + " / " + total + " screened";
    elements.progressFill.style.width = total ? ((screened / total) * 100).toFixed(2) + "%" : "0%";

    if (!total) {
      elements.recordTitle.textContent = "Title";
      elements.recordMeta.textContent = "";
      elements.recordDoi.textContent = "";
      elements.recordAbstract.textContent = "Abstract text";
      return;
    }

    if (screened >= total) {
      elements.decisionButtons.classList.add("hidden");
      elements.completeSummary.textContent =
        "Accepted: " +
        counts.accept +
        ", Unsure: " +
        counts.unsure +
        ", Declined: " +
        counts.decline +
        ".";
      return;
    }

    elements.decisionButtons.classList.remove("hidden");
    const current = state.records[state.order[state.cursor]];
    renderRecord(current);
  }

  function renderRecord(record) {
    const metaParts = [];
    if (record.year) {
      metaParts.push(record.year);
    }
    if (record.journal) {
      metaParts.push(record.journal);
    }
    if (record.authors.length) {
      metaParts.push(record.authors.join(", "));
    }

    elements.recordTitle.textContent = record.title || "(No title in RIS record)";
    elements.recordMeta.textContent = metaParts.join(" | ");
    elements.recordAbstract.textContent = record.abstract || "(No abstract available for this record.)";

    if (record.doi) {
      const url = doiToUrl(record.doi);
      elements.recordDoi.innerHTML =
        'DOI: <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(record.doi) + "</a>";
    } else if (record.url) {
      elements.recordDoi.innerHTML =
        'Link: <a href="' + escapeHtml(record.url) + '" target="_blank" rel="noopener noreferrer">Open article link</a>';
    } else {
      elements.recordDoi.textContent = "DOI: not available";
    }
  }

  function getDecisionCounts() {
    const counts = { accept: 0, unsure: 0, decline: 0 };
    for (let i = 0; i < state.decisions.length; i += 1) {
      const choice = state.decisions[i].decision;
      if (Object.prototype.hasOwnProperty.call(counts, choice)) {
        counts[choice] += 1;
      }
    }
    return counts;
  }

  function persistSession() {
    if (!state.sessionKey) {
      return;
    }
    localStorage.setItem(
      state.sessionKey,
      JSON.stringify({
        records: state.records,
        order: state.order,
        cursor: state.cursor,
        decisions: state.decisions,
      })
    );
  }

  function parseRis(text) {
    const lines = text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").split("\n");
    const parsedRecords = [];
    let rawRecord = {};
    let currentTag = "";

    function flushRecord() {
      if (!Object.keys(rawRecord).length) {
        return;
      }
      parsedRecords.push(normalizeRecord(rawRecord, parsedRecords.length + 1));
      rawRecord = {};
      currentTag = "";
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const tagMatch = line.match(/^([A-Z0-9]{2})\s*-\s?(.*)$/);
      if (tagMatch) {
        const tag = tagMatch[1];
        const value = (tagMatch[2] || "").trim();
        if (tag === "ER") {
          flushRecord();
          continue;
        }
        if (!rawRecord[tag]) {
          rawRecord[tag] = [];
        }
        rawRecord[tag].push(value);
        currentTag = tag;
      } else if (line.trim() === "") {
        continue;
      } else if (currentTag) {
        const values = rawRecord[currentTag];
        values[values.length - 1] = (values[values.length - 1] + " " + line.trim()).trim();
      }
    }
    flushRecord();
    return parsedRecords;
  }

  function normalizeRecord(rawRecord, fallbackIndex) {
    const title = firstValue(rawRecord, ["TI", "T1", "CT"]);
    const abstractText = firstValue(rawRecord, ["AB", "N2"]);
    const journal = firstValue(rawRecord, ["JO", "JF", "JA", "T2"]);
    const yearField = firstValue(rawRecord, ["PY", "Y1"]);
    const year = extractYear(yearField);
    const authors = values(rawRecord, ["AU", "A1"]);
    const url = firstValue(rawRecord, ["UR", "L1"]);

    let doi = firstValue(rawRecord, ["DO"]);
    if (!doi) {
      doi = extractDoi(url);
    }
    if (!doi && title) {
      doi = extractDoi(title);
    }
    doi = cleanDoi(doi);

    const idFromFile = firstValue(rawRecord, ["ID", "AN"]);
    const recordId = idFromFile || doi || String(fallbackIndex);

    return {
      recordId: recordId,
      title: title,
      abstract: abstractText,
      journal: journal,
      year: year,
      authors: authors,
      doi: doi,
      url: url,
    };
  }

  function firstValue(record, tags) {
    for (let i = 0; i < tags.length; i += 1) {
      const tag = tags[i];
      if (record[tag] && record[tag].length) {
        return record[tag].join(" ").trim();
      }
    }
    return "";
  }

  function values(record, tags) {
    for (let i = 0; i < tags.length; i += 1) {
      const tag = tags[i];
      if (record[tag] && record[tag].length) {
        return record[tag].map(function (entry) { return entry.trim(); }).filter(Boolean);
      }
    }
    return [];
  }

  function extractYear(value) {
    const match = String(value || "").match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : "";
  }

  function extractDoi(value) {
    if (!value) {
      return "";
    }
    const match = String(value).match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    return match ? match[0] : "";
  }

  function cleanDoi(doi) {
    return String(doi || "")
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/\s+/g, "")
      .replace(/[).,;]+$/, "")
      .trim();
  }

  function doiToUrl(doi) {
    return "https://doi.org/" + encodeURIComponent(doi);
  }

  function shuffle(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      const temp = result[i];
      result[i] = result[randomIndex];
      result[randomIndex] = temp;
    }
    return result;
  }

  function buildSessionKey(file) {
    return [STORAGE_PREFIX, file.name, file.size, file.lastModified].join("|");
  }

  function setStatus(message) {
    elements.statusText.textContent = message;
  }

  function downloadCsv() {
    if (!state.decisions.length) {
      setStatus("No decisions to export yet.");
      return;
    }
    const headers = [
      "screen_order",
      "decision",
      "decided_at",
      "record_id",
      "title",
      "doi",
      "doi_url",
      "year",
      "journal",
      "authors",
      "abstract",
    ];
    const lines = [headers.join(",")];
    for (let i = 0; i < state.decisions.length; i += 1) {
      const decision = state.decisions[i];
      const row = headers.map(function (key) {
        return csvValue(decision[key]);
      });
      lines.push(row.join(","));
    }
    const csv = lines.join("\n");
    const fileName = buildExportFileName("csv");
    triggerDownload(fileName, csv, "text/csv;charset=utf-8");
    setStatus("Exported CSV with " + state.decisions.length + " decisions.");
  }

  function downloadJson() {
    if (!state.decisions.length) {
      setStatus("No decisions to export yet.");
      return;
    }
    const text = JSON.stringify(state.decisions, null, 2);
    const fileName = buildExportFileName("json");
    triggerDownload(fileName, text, "application/json;charset=utf-8");
    setStatus("Exported JSON with " + state.decisions.length + " decisions.");
  }

  function buildExportFileName(extension) {
    const stem = (state.fileName || "screening-results")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 70);
    return stem + "_decisions." + extension;
  }

  function triggerDownload(fileName, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function csvValue(value) {
    const raw = String(value == null ? "" : value);
    return '"' + raw.replace(/"/g, '""') + '"';
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
