/* ============================================================
   PandaTools Script.js (Final + PDF-to-JPG Page Selection)
   - Reorder, viewer, gallery, drag & touch reorder
   - 25MB limit per tool | 50MB for compress-pdf
   - Fixed download button + reorder system
   - ADDED: PDF → JPG PAGE INPUT + VALIDATION
============================================================ */

document.addEventListener("DOMContentLoaded", initTools);

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* ===========================
   GLOBAL FILE SIZE LIMITS
=========================== */
const LIMITS = {
  "compress-pdf": 50 * 1024 * 1024,
  "default": 25 * 1024 * 1024
};
const safeLimit = tool => LIMITS[tool] || LIMITS.default;

/* ---------------- Helper ---------------- */
const $id = id => document.getElementById(id);

/* ---------------- State ---------------- */
let galleryOrder = [];
let originalFiles = [];
let reorderMode = false;
let touchStartIndex = null;

/* ==========================
   TOOL LOADING + UI SETUP
========================== */
function initTools() {
  document.body.classList.add("ready");

  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (tool && $id("toolName"))
    $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();

  const fileInput = $id("fileInput");
  if (!fileInput) return;

  fileInput.addEventListener("change", updateFileList);

  if (["merge-pdf", "jpg-to-pdf"].includes(tool))
    fileInput.multiple = true;

  if (["protect-pdf", "unlock-pdf"].includes(tool))
    $id("passwordInput").style.display = "block";

  if (tool === "split-pdf") $id("rangeInput").style.display = "block";
  if (tool === "rotate-pdf") $id("angleInput").style.display = "block";
  if (tool === "compress-pdf") {
  $id("compressLevel").style.display = "block";
}

  /* 🔥 SHOW PAGE INPUT FOR PDF → JPG */
  if (tool === "pdf-to-jpg" && $id("pagesInput")) {
    $id("pagesInput").style.display = "block";
  }

  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.addEventListener("click", openViewer);

  const btn = $id("download-btn");
btn.style.display = "none";



  const closeBtn = $id("close-viewer");
  if (closeBtn)
    closeBtn.onclick = () => ($id("pdf-viewer-popup").style.display = "none");
}

/* ============================================================
   FILE LIST + SIZE VALIDATION
============================================================ */
function updateFileList() {
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");
  const hint = $id("reorder-hint");
  const tool = new URLSearchParams(window.location.search).get("tool");

  if (!list) return;

  list.innerHTML = "";
  if (viewBtn) viewBtn.style.display = "none";

  if (!input.files.length) {
    list.innerHTML = "<p style='color:#777;'>No files selected</p>";
    if (hint) hint.style.display = "none";
    return;
  }

  const files = [...input.files];

  if (!validateSize(files, tool)) {
    input.value = "";
    list.innerHTML = "<p style='color:red;'>File too large. Reduce size.</p>";
    return;
  }

  if (viewBtn) viewBtn.style.display = "block";

  files.forEach((file, index) => {
    const sizeKB = Math.round(file.size / 1024);
    const div = document.createElement("div");
    div.className = "file-item";
    div.innerHTML = `
      <svg viewBox="0 0 24 24" width="20"><path d="M14 2H6v16h12V8z"/></svg>
      <span class="file-name">${escapeHtml(file.name)}</span>
      <span class="file-meta">${sizeKB} KB</span>
      <button class="remove-btn" data-index="${index}">×</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll(".remove-btn").forEach(btn => {
    btn.onclick = () => removeFile(parseInt(btn.dataset.index));
  });

  const allImgs = files.every(f => f.type?.startsWith("image/"));
  const allPDFs = files.every(f => /\.pdf$/i.test(f.name));

  if (hint) {
    hint.style.display =
      (tool === "jpg-to-pdf" && files.length > 1 && allImgs) ||
      (tool === "merge-pdf" && files.length > 1 && allPDFs)
        ? "block"
        : "none";
  }
}

function validateSize(files, tool) {
  const max = safeLimit(tool);
  let total = 0;
  for (let f of files) {
    total += f.size;
    if (total > max) {
      showError(`Maximum allowed size is ${(max / 1024 / 1024).toFixed(1)} MB`);
      return false;
    }
  }
  return true;
}

function removeFile(index) {
  const input = $id("fileInput");
  const dt = new DataTransfer();
  [...input.files].forEach((f, i) => i !== index && dt.items.add(f));
  input.files = dt.files;
  updateFileList();
}

/* ============================================================
   VIEWER + REORDER MODE
============================================================ */
function openViewer() {
  const input = $id("fileInput");
  if (!input.files.length) return;

  originalFiles = [...input.files];

  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");
  const gallery = $id("img-gallery");
  const info = $id("viewer-info");

  const tool = new URLSearchParams(window.location.search).get("tool");
  const first = originalFiles[0];
  const isPDF = /\.pdf$/i.test(first.name);

  const allImgs = originalFiles.every(f => f.type?.startsWith("image/"));
  const allPDFs = originalFiles.every(f => /\.pdf$/i.test(f.name));

  if (tool === "merge-pdf" && allPDFs && originalFiles.length > 1) {
    popup.style.display = "flex";
    frame.style.display = "none";
    img.style.display = "none";
    gallery.style.display = "block";
    info.style.display = "none";

    galleryOrder = [...originalFiles];
    reorderMode = false;
    showReorderToggle();
    renderGallery(gallery);
    return;
  }

  if (isPDF) {
    window.open(URL.createObjectURL(first), "_blank");
    return;
  }

  popup.style.display = "flex";

  frame.style.display = "none";
  img.style.display = "none";
  gallery.innerHTML = "";
  gallery.style.display = "none";
  info.style.display = "none";

  if (allImgs && originalFiles.length > 1) {
    galleryOrder = [...originalFiles];
    gallery.style.display = "flex";
    showReorderToggle();
    renderGallery(gallery);
    return;
  }

  if (first.type?.startsWith("image/")) {
    img.src = URL.createObjectURL(first);
    img.style.display = "block";
    return;
  }

  info.innerHTML = `<p>Preview not supported for ${escapeHtml(first.name)}</p>`;
  info.style.display = "block";
}

/* ============================================================
   RENDER GALLERY + DRAG
============================================================ */

function showReorderToggle() {
  const toggle = $id("reorder-toggle");
  const status = $id("reorder-status");

  if (galleryOrder.length < 2) return;

  toggle.style.display = "inline-flex";

  toggle.onclick = () => {
    reorderMode = !reorderMode;
    toggle.setAttribute("aria-pressed", reorderMode);
    status.style.display = reorderMode ? "inline-block" : "none";

    // 🔥 ADD THIS
    renderGallery($id("img-gallery"));
  };
}


function renderGallery(container) {
  container.innerHTML = "";
  const tool = new URLSearchParams(window.location.search).get("tool");

  let i = 0;
  const total = galleryOrder.length;

  function renderChunk() {
    const CHUNK = 20;
    const frag = document.createDocumentFragment();

    for (let end = Math.min(i + CHUNK, total); i < end; i++) {
      const file = galleryOrder[i];
      const div = document.createElement("div");
      div.dataset.index = i;
      div.draggable = reorderMode;

      if (tool === "merge-pdf") {
        div.className = "pdf-item";
        const sizeKB = Math.round(file.size / 1024);
        div.innerHTML = `
          <span class="pdf-icon">📄</span>
          <div class="pdf-info">
            <span class="pdf-name">${escapeHtml(file.name)}</span>
            <span class="pdf-meta">${sizeKB} KB</span>
          </div>
          <button class="pdf-view-btn">View</button>
        `;
        div.querySelector(".pdf-view-btn").onclick = () =>
          window.open(file._url || (file._url = URL.createObjectURL(file)));
      } else {
  div.className = "img-item";
  const im = document.createElement("img");
  im.src = file._url || (file._url = URL.createObjectURL(file));
  im.loading = "lazy";
  div.appendChild(im);
}

frag.appendChild(div);

    }

    container.appendChild(frag);

    if (i < total) requestAnimationFrame(renderChunk);
    else if (reorderMode) enableDrag(container);
  }

  requestAnimationFrame(renderChunk);
}

function enableDrag(container) {
  container.querySelectorAll("[data-index]").forEach(item => {
    item.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", item.dataset.index);
      item.classList.add("dragging");
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.classList.add("drag-over");
    });

    item.addEventListener("drop", e => {
      e.preventDefault();
      const a = parseInt(e.dataTransfer.getData("text/plain"));
      const b = parseInt(item.dataset.index);
      swapImages(a, b, container);
    });

    item.addEventListener("dragleave", () =>
      item.classList.remove("drag-over")
    );
  });
}

function swapImages(a, b, container) {
  if (a === b) return;

  const temp = galleryOrder[a];
  galleryOrder[a] = galleryOrder[b];
  galleryOrder[b] = temp;

  // 🔥 Re-render and re-bind indexes
  renderGallery(container);
}

function applyReorderToInput() {
  const tool = new URLSearchParams(window.location.search).get("tool");
  if (!["jpg-to-pdf", "merge-pdf"].includes(tool)) return;

  const input = $id("fileInput");
  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));
  input.files = dt.files;
  updateFileList();
}

/* ============================================================
   PROCESS FILE (UPLOAD + RESPONSE)
============================================================ */
async function processFile() {
  // 🔥 Wake backend (Render sleep fix)
  try {
    await fetch(`${API_BASE}/`);
  } catch {}

  applyReorderToInput();

  const tool = new URLSearchParams(window.location.search).get("tool");
  const input = $id("fileInput");

  if (!input.files.length) return showError("Please select a file.");

  const files = [...input.files];
  if (!validateSize(files, tool)) return;

  const fd = new FormData();

  if (["merge-pdf", "jpg-to-pdf"].includes(tool)) {
    files.forEach(f => fd.append("files", f));
  } else {
    fd.append("file", files[0]);
  }

  if (tool === "split-pdf") fd.append("ranges", $id("rangeInput").value);
  if (tool === "rotate-pdf") fd.append("angle", $id("angleInput").value);
  if (["protect-pdf", "unlock-pdf"].includes(tool))
    fd.append("password", $id("passwordInput").value);
  if (tool === "compress-pdf") {
  fd.append("level", $id("compressLevel").value);
}

  // PDF → JPG pages
  if (tool === "pdf-to-jpg") {
    const pages = ($id("pagesInput").value || "").trim();
    if (pages && !/^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/.test(pages)) {
      return showError("Invalid format. Example: 1,3,5-7");
    }
    fd.append("pages", pages);
  }

  resetProgress();
  updateProgress(5);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_BASE}/${tool}`);
  xhr.responseType = "blob";

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      updateProgress(Math.round((e.loaded / e.total) * 80));
    }
  };

  xhr.onload = () => {
    if (xhr.status !== 200) {
      readErrorMessage(xhr.response);
      return;
    }

    updateProgress(90);

    // ✅ EXTRACT TEXT (SAFE)
    if (tool === "extract-text") {
      const reader = new FileReader();
reader.onload = () => {
  const data = JSON.parse(reader.result);
  const textBlob = new Blob([data.text], { type: "text/plain" });
  const url = URL.createObjectURL(textBlob);

  const filename = data.filename || "output.txt";

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  const btn = $id("download-btn");
  btn.href = url;
  btn.download = filename;
  btn.innerText = "⬇ Download Text";
  btn.style.display = "flex";
};
reader.readAsText(xhr.response);

      return;
    }

    // ✅ ALL OTHER TOOLS
    const blob = xhr.response;
const url = URL.createObjectURL(blob);

// ✅ Read filename from backend
let filename =
  xhr.getResponseHeader("X-Filename") ||
  getDefaultName(tool, files[0].name);

const a = document.createElement("a");
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
a.remove();

const btn = $id("download-btn");
btn.href = url;
btn.download = filename;
btn.innerText = "⬇ Download File";
btn.style.display = "flex";

updateProgress(100);

  };

  xhr.onerror = () => showError("Network error");
  xhr.send(fd);
}


/* ============================================================
   PROGRESS BAR
============================================================ */
function resetProgress() {
  $id("progress-wrapper").style.display = "block";
  $id("progress-bar").style.width = "0%";
  $id("progress-percent").innerText = "0%";
}

function updateProgress(p) {
  $id("progress-bar").style.width = `${p}%`;
  $id("progress-percent").innerText = `${p}%`;
}

/* ============================================================
   EXTRACT TEXT
============================================================ */
function handleExtractText(blob) {
  const reader = new FileReader();

  reader.onload = () => {
    let data;

    try {
      data = JSON.parse(reader.result);
    } catch {
      showError("Failed to read extracted text");
      return;
    }

    if (!data.text) {
      showError("No text found in document");
      return;
    }

    const txtBlob = new Blob([data.text], { type: "text/plain" });
    const url = URL.createObjectURL(txtBlob);

    // 🔥 AUTO DOWNLOAD (prevents 404 issues)
    const a = document.createElement("a");
    a.href = url;
    a.download = "output.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Optional: still show download button
    const btn = $id("download-btn");
    if (btn) {
      btn.href = url;
      btn.download = "output.txt";
      btn.style.display = "flex";
    }
  };

  reader.readAsText(blob);
}


/* ============================================================
   DOWNLOAD NAME MAP
============================================================ */

/* ============================================================
   UTILITIES
============================================================ */
function showError(msg) {
  const box = $id("status-msg");
  box.className = "error-msg";
  box.innerText = "⚠️ " + msg;
  box.style.display = "block";
}

function readErrorMessage(blob) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      showError(json.error || "Something went wrong");
    } catch {
      const clean = reader.result.replace(/<[^>]+>/g, "").trim();
      showError(clean || "Something went wrong.");
    }
  };
  reader.readAsText(blob);
}


function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function openTool(t) {
  location.href = `tool.html?tool=${t}`;
}
function getDefaultName(tool, originalName) {
  const base = originalName.replace(/\.[^/.]+$/, "");

  const map = {
    "ppt-to-pdf": `${base}.pdf`,
    "word-to-pdf": `${base}.pdf`,
    "pdf-to-word": `${base}.docx`,
    "jpg-to-pdf": `${base}.pdf`,
    "merge-pdf": "merged.pdf",
    "split-pdf": "split.zip",
    "compress-pdf": `${base}_compressed.pdf`,
    "pdf-to-jpg": `${base}_images.zip`,
    "rotate-pdf": `${base}_rotated.pdf`,
  };

  return map[tool] || `${base}.pdf`;
}
