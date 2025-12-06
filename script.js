/* ============================================================
   PandaTools Script.js (with reorder + mobile fixes)
   - JPG to PDF: image gallery + reorder
   - Merge PDF : draggable PDF list + reorder
   - Fixed pdf-to-word download name
============================================================ */

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* ---------------- Helper ---------------- */
function $id(id) {
  return document.getElementById(id);
}

/* ---------------- Open Tool ---------------- */
function openTool(tool) {
  window.location.href = `tool.html?tool=${tool}`;
}

/* ---------------- On Load ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (tool && $id("toolName")) {
    $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
  }

  const fileInput = $id("fileInput");
  if (!fileInput) return; // index page (no tool)

  fileInput.addEventListener("change", updateFileList);

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") fileInput.multiple = true;
  if (tool === "protect-pdf" || tool === "unlock-pdf") {
    const pw = $id("passwordInput");
    if (pw) pw.style.display = "block";
  }
  if (tool === "split-pdf") {
    const r = $id("rangeInput");
    if (r) r.style.display = "block";
  }
  if (tool === "rotate-pdf") {
    const a = $id("angleInput");
    if (a) a.style.display = "block";
  }

  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.addEventListener("click", openViewer);
});

/* ============================================================
   FILE LIST
============================================================ */
function updateFileList() {
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");
  const reorderHint = $id("reorder-hint");
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (!input || !list) return;

  list.innerHTML = "";
  if (viewBtn) viewBtn.style.display = "none";

  if (!input.files || !input.files.length) {
    list.innerHTML = "<p style='color:#777;'>No files selected</p>";
    if (reorderHint) reorderHint.style.display = "none";
    return;
  }

  if (viewBtn) viewBtn.style.display = "block";

  [...input.files].forEach((file, index) => {
    const div = document.createElement("div");
    div.className = "file-item";

    const sizeKB = Math.round(file.size / 1024);
    div.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M14 2H6v16h12V8z"/>
      </svg>
      <span class="file-name">${file.name}</span>
      <span class="file-meta">${sizeKB} KB</span>
      <button class="remove-btn" onclick="removeFile(${index})">×</button>
    `;
    list.appendChild(div);
  });

  const files = [...input.files];

  const allImages = files.every(f => f.type.startsWith("image/"));
  const allPDFs = files.every(
    f =>
      f.type === "application/pdf" ||
      /\.pdf$/i.test(f.name)
  );

  // Show hint for JPG→PDF (images) and MERGE PDF (pdf list)
  if (reorderHint) {
    if (
      (tool === "jpg-to-pdf" && files.length > 1 && allImages) ||
      (tool === "merge-pdf" && files.length > 1 && allPDFs)
    ) {
      reorderHint.style.display = "block";
    } else {
      reorderHint.style.display = "none";
    }
  }
}

function removeFile(index) {
  const input = $id("fileInput");
  if (!input || !input.files) return;

  const dt = new DataTransfer();
  let arr = [...input.files];
  arr.splice(index, 1);
  arr.forEach(f => dt.items.add(f));

  input.files = dt.files;
  updateFileList();
}

/* ============================================================
   VIEWER + REORDER MODE
============================================================ */
let galleryOrder = [];
let originalFiles = [];
let reorderMode = false;

function openViewer() {
  const input = $id("fileInput");
  if (!input || !input.files || !input.files.length) return;

  originalFiles = [...input.files];

  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");
  const gallery = $id("img-gallery");
  const info = $id("viewer-info");
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  const first = originalFiles[0];
  const isPDF =
    first.type === "application/pdf" || /\.pdf$/i.test(first.name);
  const allImages = originalFiles.every(f => f.type.startsWith("image/"));
  const allPDFs = originalFiles.every(
    f =>
      f.type === "application/pdf" ||
      /\.pdf$/i.test(f.name)
  );

  /* --------------------------------------------------------
     MERGE PDF → draggable list of PDFs (no iframe preview)
  -------------------------------------------------------- */
  if (tool === "merge-pdf" && allPDFs && originalFiles.length > 1) {
    if (!popup || !gallery || !info) return;

    popup.style.display = "flex";

    if (frame) frame.style.display = "none";
    if (img) img.style.display = "none";

    gallery.style.display = "block";
    gallery.innerHTML = "";
    info.style.display = "none";

    galleryOrder = [...originalFiles];
    reorderMode = true; // always in reorder mode for merge-pdf list
    showReorderToggle(); // shows toggle; user can turn it off if they want
    renderGallery(gallery);
    return;
  }

  /* --------------------------------------------------------
     Any other single PDF → open in new tab (best compatibility)
  -------------------------------------------------------- */
  if (isPDF) {
    const url = URL.createObjectURL(first);
    window.open(url, "_blank");
    return;
  }

  /* --------------------------------------------------------
     For images or unsupported → use popup viewer
  -------------------------------------------------------- */
  if (!popup || !frame || !img || !gallery || !info) return;

  popup.style.display = "flex";
  frame.style.display = "none";
  img.style.display = "none";
  gallery.style.display = "none";
  gallery.innerHTML = "";
  info.style.display = "none";

  /* ---- Multi Images (JPG→PDF etc.) ---- */
  if (originalFiles.length > 1 && allImages) {
    galleryOrder = [...originalFiles];
    gallery.style.display = "flex";
    showReorderToggle();
    renderGallery(gallery);
    return;
  }

  /* ---- Single Image ---- */
  if (first.type.startsWith("image/")) {
    img.src = URL.createObjectURL(first);
    img.style.display = "block";
    return;
  }

  /* ---- Unsupported ---- */
  info.style.display = "block";
  info.innerHTML = `<p>Preview not supported for ${first.name}</p>`;
}

/* ============================================================
   REORDER MODE BUTTON
============================================================ */
function showReorderToggle() {
  const toggle = $id("reorder-toggle");
  const status = $id("reorder-status");
  if (!toggle || !status) return;

  toggle.style.display = "inline-flex";

  toggle.onclick = () => {
    reorderMode = !reorderMode;
    toggle.setAttribute("aria-pressed", reorderMode ? "true" : "false");
    status.style.display = reorderMode ? "inline-block" : "none";
    const gallery = $id("img-gallery");
    if (gallery) renderGallery(gallery);
  };
}

/* ============================================================
   RENDER GALLERY (images for JPG→PDF, list for MERGE PDF)
============================================================ */
function renderGallery(container) {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (!container) return;
  container.innerHTML = "";

  galleryOrder.forEach((file, i) => {
    const div = document.createElement("div");
    div.dataset.index = i;
    div.draggable = reorderMode;

    if (tool === "merge-pdf") {
      // Simple PDF row (best for desktop + mobile)
      div.className = "pdf-item";

      const sizeKB = Math.round(file.size / 1024);

      div.innerHTML = `
        <div class="pdf-item-inner">
          <span class="pdf-icon">📄</span>
          <div class="pdf-text">
            <span class="pdf-name">${file.name}</span>
            <span class="pdf-meta">${sizeKB} KB</span>
          </div>
          <button type="button" class="pdf-view-btn">View</button>
        </div>
      `;

      const viewBtn = div.querySelector(".pdf-view-btn");
      if (viewBtn) {
        viewBtn.addEventListener("click", () => {
          const url = URL.createObjectURL(file);
          window.open(url, "_blank");
        });
      }
    } else {
      // JPG→PDF: show actual image
      div.className = "img-item";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      div.appendChild(img);
    }

    container.appendChild(div);
  });

  if (reorderMode) enableDrag(container);
}

/* ============================================================
   DRAG / TOUCH REORDER
============================================================ */
function enableDrag(container) {
  let dragIndex = null;

  container.querySelectorAll("[data-index]").forEach(item => {
    item.addEventListener("dragstart", () => {
      dragIndex = parseInt(item.dataset.index, 10);
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
    });

    item.addEventListener("drop", e => {
      e.preventDefault();
      const dropIndex = parseInt(item.dataset.index, 10);
      if (isNaN(dragIndex) || isNaN(dropIndex)) return;
      swapImages(dragIndex, dropIndex, container);
    });

    /* Touch support */
    item.addEventListener("touchstart", e => {
      dragIndex = parseInt(item.dataset.index, 10);
    });

    item.addEventListener(
      "touchend",
      e => {
        const t = e.changedTouches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (!el) return;

        const dropItem = el.closest("[data-index]");
        if (!dropItem) return;

        const dropIndex = parseInt(dropItem.dataset.index, 10);
        if (isNaN(dropIndex)) return;

        swapImages(dragIndex, dropIndex, container);
      },
      { passive: false }
    );
  });
}

function swapImages(a, b, container) {
  if (a === b) return;
  const temp = galleryOrder[a];
  galleryOrder[a] = galleryOrder[b];
  galleryOrder[b] = temp;

  renderGallery(container);
}

/* ============================================================
   applyReorderToInput
   - Applies order for JPG→PDF and MERGE PDF only
============================================================ */
function applyReorderToInput() {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (tool !== "jpg-to-pdf" && tool !== "merge-pdf") return;
  if (!galleryOrder || galleryOrder.length < 1) return;

  const fileInput = $id("fileInput");
  if (!fileInput) return;

  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));

  fileInput.files = dt.files;
  updateFileList();
}

/* ============================================================
   CLOSE VIEWER
============================================================ */
const closeViewerBtn = $id("close-viewer");
if (closeViewerBtn) {
  closeViewerBtn.onclick = () => {
    const popup = $id("pdf-viewer-popup");
    if (popup) popup.style.display = "none";
  };
}

/* ============================================================
   PROCESS FILE
   - Uses correct file names for each tool
   - 100% progress when ready to download
============================================================ */
async function processFile() {
  // Apply reorder for JPG→PDF and MERGE PDF (safe)
  applyReorderToInput();

  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  const input = $id("fileInput");
  if (!input || !input.files || !input.files.length) {
    return showError("Please select a file.");
  }

  const files = [...input.files];
  const fd = new FormData();

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    files.forEach(f => fd.append("files", f));
  } else {
    fd.append("file", files[0]);
  }

  if (tool === "split-pdf") {
    const r = $id("rangeInput");
    fd.append("ranges", r ? r.value : "");
  }
  if (tool === "rotate-pdf") {
    const a = $id("angleInput");
    fd.append("angle", a ? a.value : "");
  }
  if (tool === "protect-pdf" || tool === "unlock-pdf") {
    const pw = $id("passwordInput");
    fd.append("password", pw ? pw.value : "");
  }

  const wrapper = $id("progress-wrapper");
  const bar = $id("progress-bar");
  const percent = $id("progress-percent");
  const downloadBtn = $id("download-btn");
  const msgBox = $id("status-msg");

  if (wrapper) wrapper.style.display = "block";
  if (bar) bar.style.width = "0%";
  if (percent) percent.innerText = "0%";
  if (downloadBtn) downloadBtn.style.display = "none";
  if (msgBox) msgBox.style.display = "none";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${tool}`);
    xhr.responseType = "blob";

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const p = Math.round((e.loaded / e.total) * 100);
      if (bar) bar.style.width = p + "%";
      if (percent) percent.innerText = p + "%";
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        readErrorMessage(xhr.response);
        return reject();
      }

      // Now response is ready → ensure 100%
      if (bar) bar.style.width = "100%";
      if (percent) percent.innerText = "100%";

      const blob = xhr.response;
      const url = URL.createObjectURL(blob);
      // Special handling for extract-text (returns JSON, not a file)
if (tool === "extract-text") {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const json = JSON.parse(reader.result);
            const textBlob = new Blob([json.text], { type: "text/plain" });
            const textUrl = URL.createObjectURL(textBlob);

            downloadBtn.href = textUrl;
            downloadBtn.download = "output.txt";
            downloadBtn.textContent = "⬇️ Download Extracted Text";
            downloadBtn.style.display = "flex";
        } catch (err) {
            showError("Failed to parse extracted text.");
        }
    };
    reader.readAsText(blob);
    return resolve();
}

      const names = {
        "pdf-to-word": "output.docx",
        "pdf-to-jpg": "output.jpg",
        "jpg-to-pdf": "output.pdf",
        "merge-pdf": "merged.pdf",
        "split-pdf": "split.zip",
        "rotate-pdf": "rotated.pdf",
        "compress-pdf": "compressed.pdf",
        "word-to-pdf": "output.pdf",
        "ppt-to-pdf": "output.pdf",
        "ppt-to-pdf-perfect": "output.pdf",
        "extract-text": "output.txt" // keep same name but must convert blob to text
      };

      if (downloadBtn) {
        downloadBtn.href = url;
        downloadBtn.download = names[tool] || "output.pdf";
        downloadBtn.textContent = "⬇️ Download File";
        downloadBtn.style.display = "flex";
      }

      resolve();
    };

    xhr.onerror = () => {
      showError("Network error. Try again.");
      reject();
    };

    xhr.send(fd);
  });
}

/* ============================================================
   ERROR HANDLING
============================================================ */
function showError(msg) {
  const msgBox = $id("status-msg");
  if (!msgBox) return;
  msgBox.className = "error-msg";
  msgBox.innerText = "⚠️ " + msg;
  msgBox.style.display = "block";
}

function readErrorMessage(blob) {
  if (!blob) {
    showError("Something went wrong.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result || "";
    const match = text.match(/<p>(.*?)<\/p>/i);
    if (match && match[1]) {
      showError(match[1]);
      return;
    }
    const clean = text.replace(/<[^>]+>/g, "").trim();
    if (clean.length) {
      showError(clean);
      return;
    }
    showError("Something went wrong.");
  };
  reader.readAsText(blob);
}
