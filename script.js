/* script.js
   Single combined script for index.html + tool.html
   - File list UI
   - Viewer popup (PDF / single image / gallery)
   - Reorder (drag + touch), reorder-mode toggle to avoid accidental reorder while scrolling
   - AJAX upload with progress
   - Safe: silently no-op on pages missing elements
*/

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* ---------- Lightweight DOM helpers ---------- */
function $id(id) { return document.getElementById(id); }
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

/* ---------- App state ---------- */
let galleryOrder = [];     // File objects in order for images
let originalFiles = [];    // snapshot when viewer opened
let reorderMode = false;   // whether reorder-mode is enabled in popup
let openObjectURLs = [];   // track created object URLs to revoke

/* ---------- Cleanup helper for object URLs ---------- */
function createObjectURL(file) {
  const url = URL.createObjectURL(file);
  openObjectURLs.push(url);
  return url;
}
function revokeAllObjectURLs() {
  openObjectURLs.forEach(u => URL.revokeObjectURL(u));
  openObjectURLs = [];
}

/* ---------- DOMContentLoaded setup ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Dynamic page title (tool param)
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");
  if (tool && $id("toolName")) $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();

  // Wire input change
  const fileInput = $id("fileInput");
  if (fileInput) fileInput.addEventListener("change", updateFileList);

  // Wire view button
  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.addEventListener("click", openViewer);

  // Wire process button (single global handler attached in HTML: onclick="processFile()")
  // Wire close viewer
  const closeViewer = $id("close-viewer");
  if (closeViewer) {
    closeViewer.addEventListener("click", closeViewerPopup);
  }

  // Keyboard: Escape closes viewer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeViewerPopup();
  });

  // Reorder toggle button (exists inside viewer markup)
  const reorderToggle = $id("reorder-toggle");
  if (reorderToggle) {
    reorderToggle.addEventListener("click", () => {
      reorderMode = !reorderMode;
      reorderToggle.setAttribute("aria-pressed", String(reorderMode));
      updateReorderUI();
    });
  }
});

/* ---------- Update file list UI ---------- */
function updateFileList() {
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");
  const reorderHint = $id("reorder-hint");

  if (!input || !list) return;

  list.innerHTML = "";
  if (viewBtn) viewBtn.style.display = "none";
  if (reorderHint) reorderHint.style.display = "none";

  if (!input.files || !input.files.length) {
    list.innerHTML = "<p style='color:#777;margin:6px 0;'>No files selected</p>";
    return;
  }

  // Show view button
  if (viewBtn) viewBtn.style.display = "block";

  [...input.files].forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const sizeKB = Math.round(file.size / 1024);
    item.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 
        2 0 0 0 2 2h12a2 2 0 0 
        0 2-2V8l-6-6zm1 7h5.5L15 
        3.5V9z"/>
      </svg>
      <span class="file-name" aria-label="${file.name}">${file.name}</span>
      <span class="file-meta" aria-hidden="true">${sizeKB} KB</span>
      <button class="remove-btn" data-index="${index}" title="Remove file">×</button>
    `;
    list.appendChild(item);
  });

  // Wire remove buttons (event delegation would also work, but this is simple)
  qsa(".remove-btn", list).forEach(btn => {
    btn.addEventListener("click", (ev) => {
      const idx = parseInt(ev.currentTarget.dataset.index, 10);
      removeFile(idx);
    });
  });

  // Show reorder hint only when >1 images
  if (reorderHint) {
    const files = [...input.files];
    const allImages = files.length > 1 && files.every(f => {
      return (f.type && f.type.startsWith("image/")) || /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name);
    });
    if (allImages) reorderHint.style.display = "block";
    else reorderHint.style.display = "none";
  }
}

/* ---------- Remove file from input ---------- */
function removeFile(index) {
  const input = $id("fileInput");
  if (!input || !input.files) return;

  const dt = new DataTransfer();
  let files = [...input.files];
  if (index < 0 || index >= files.length) return;
  files.splice(index, 1);
  files.forEach(f => dt.items.add(f));
  input.files = dt.files;

  // update UI
  updateFileList();
}

/* ---------- Open viewer (PDF / image(s) / unsupported) ---------- */
function openViewer() {
  const input = $id("fileInput");
  if (!input || !input.files || !input.files.length) return;

  // clean previously created URLs
  revokeAllObjectURLs();
  galleryOrder = [];
  originalFiles = [...input.files];

  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");
  const gallery = $id("img-gallery");
  const infoBox = $id("viewer-info");
  const reorderToggle = $id("reorder-toggle");
  const reorderStatus = $id("reorder-status");

  if (!popup) return;
  popup.style.display = "flex";
  popup.setAttribute("aria-hidden", "false");

  // reset internal displays
  if (frame) frame.style.display = "none";
  if (img) { img.style.display = "none"; img.src = ""; }
  if (gallery) { gallery.style.display = "none"; gallery.innerHTML = ""; }
  if (infoBox) { infoBox.style.display = "none"; infoBox.innerHTML = ""; }
  if (reorderToggle) { reorderToggle.style.display = "none"; reorderToggle.setAttribute("aria-pressed", "false"); }
  if (reorderStatus) reorderStatus.style.display = "none";
  reorderMode = false;

  const first = originalFiles[0];
  if (!first) return;

  // PDF logic
  if (first.type === "application/pdf") {
    const blobURL = createObjectURL(first);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Mobile: open PDF in new tab for best native rendering
      window.open(blobURL, "_blank");
      // keep popup closed in mobile for PDF use-case
      popup.style.display = "none";
      return;
    }

    if (frame) {
      frame.style.display = "block";
      try { frame.src = blobURL; } catch (err) {
        console.error("PDF preview error:", err);
        if (infoBox) {
          infoBox.style.display = "block";
          infoBox.innerHTML = `<p>Could not preview PDF. Selected: <strong>${first.name}</strong></p>`;
        }
      }
    }
    return;
  }

  // Images: single vs multiple
  const allImages = originalFiles.every(f => (f.type && f.type.startsWith("image/")) || /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
  if (originalFiles.length > 1 && allImages) {
    if (!gallery) return;
    gallery.style.display = "flex";
    gallery.style.flexDirection = "column";

    // Setup gallery order and render
    galleryOrder = originalFiles.map(f => f);
    renderGallery(gallery);

    // Show reorder toggle & status
    if ($id("reorder-toggle")) {
      $id("reorder-toggle").style.display = "inline-flex";
      $id("reorder-status").style.display = "inline-block";
      $id("reorder-status").innerText = "Reorder OFF — toggle to enable";
      $id("reorder-toggle").setAttribute("aria-pressed", "false");
    }
    return;
  }

  // Single image
  if (first.type && first.type.startsWith("image/")) {
    if (img) {
      img.src = createObjectURL(first);
      img.style.display = "block";
    }
    return;
  }

  // Unsupported preview
  if (infoBox) {
    infoBox.style.display = "block";
    infoBox.innerHTML = `
      <div style="padding:12px;">
        <p><strong>Preview not supported for this file type.</strong></p>
        <p>Selected file: <em>${first.name}</em></p>
        <p>The file is ready for processing — you can proceed with the tool.</p>
      </div>
    `;
  }
}

/* ---------- Close viewer ---------- */
function closeViewerPopup() {
  const popup = $id("pdf-viewer-popup");
  if (!popup) return;
  popup.style.display = "none";
  popup.setAttribute("aria-hidden", "true");

  // clear gallery and revoke URLs
  const gallery = $id("img-gallery");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");

  if (gallery) gallery.innerHTML = "";
  if (frame) frame.src = "";
  if (img) img.src = "";
  revokeAllObjectURLs();

  // reset reorder mode
  reorderMode = false;
  const reorderToggle = $id("reorder-toggle");
  if (reorderToggle) reorderToggle.setAttribute("aria-pressed", "false");
  updateReorderUI();
}

/* ---------- Render gallery (no page reload) ---------- */
function renderGallery(container) {
  // container is #img-gallery
  if (!container) return;
  container.innerHTML = "";

  galleryOrder.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "img-item";
    row.dataset.index = index;
    row.setAttribute("role", "listitem");
    row.style.margin = "0";
    row.style.padding = "0";

    // accessible label
    row.setAttribute("aria-label", `Image ${index + 1}: ${file.name}`);

    const img = document.createElement("img");
    img.src = createObjectURL(file);
    img.alt = file.name || `image-${index + 1}`;
    img.style.display = "block";
    img.draggable = false;

    row.appendChild(img);
    container.appendChild(row);
  });

  // initialize drag/touch only when reorderMode true (we still attach enabling handlers so toggle flips behavior)
  initDragHandlers(container);
  updateReorderUI();
}

/* ---------- Update reorder UI affordances ---------- */
function updateReorderUI() {
  const popupInner = document.querySelector(".popup-inner");
  const reorderStatus = $id("reorder-status");
  const reorderToggle = $id("reorder-toggle");

  if (!popupInner) return;

  if (reorderMode) {
    popupInner.classList.add("reorder-mode");
    if (reorderStatus) reorderStatus.innerText = "Drag to reorder (Reorder ON)";
    if (reorderToggle) reorderToggle.setAttribute("aria-pressed", "true");
  } else {
    popupInner.classList.remove("reorder-mode");
    if (reorderStatus) reorderStatus.innerText = "Reorder OFF — toggle to enable";
    if (reorderToggle) reorderToggle.setAttribute("aria-pressed", "false");
  }
}

/* ---------- Init drag & touch handlers (attached per render) ---------- */
function initDragHandlers(container) {
  if (!container) return;

  // Remove any previous listeners by replacing nodes (safe simple approach)
  // We'll re-create handlers by cloning the container (lightweight).
  // But to keep references stable we instead add listeners to each .img-item but guard with reorderMode.

  qsa(".img-item", container).forEach(item => {
    // avoid adding duplicate listeners by using a flag
    if (item._dragBound) return;
    item._dragBound = true;

    // DESKTOP: standard HTML5 drag
    item.draggable = true;
    item.addEventListener("dragstart", (e) => {
      if (!reorderMode) { e.preventDefault(); return; }
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.dataset.index);
    });

    item.addEventListener("dragend", () => item.classList.remove("dragging"));

    item.addEventListener("dragover", (e) => {
      if (!reorderMode) return;
      e.preventDefault();
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });

    item.addEventListener("drop", (e) => {
      if (!reorderMode) return;
      e.preventDefault();
      item.classList.remove("drag-over");
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const toIndex = parseInt(item.dataset.index, 10);
      if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
        swapImages(fromIndex, toIndex);
      }
    });

    // MOBILE TOUCH: only active when reorderMode === true
    // We'll track a small threshold before considering it a drag so normal scroll isn't prevented.
    let touchStartY = 0;
    let touchStartX = 0;
    let touchMoved = false;
    const THRESH = 12;

    item.addEventListener("touchstart", (ev) => {
      if (!reorderMode) return;
      const t = ev.touches[0];
      touchStartY = t.clientY;
      touchStartX = t.clientX;
      touchMoved = false;
    }, { passive: true });

    item.addEventListener("touchmove", (ev) => {
      if (!reorderMode) return;
      const t = ev.touches[0];
      const dy = Math.abs(t.clientY - touchStartY);
      const dx = Math.abs(t.clientX - touchStartX);

      // Consider it a drag only if vertical move sufficiently large and more vertical than horizontal
      if (dy > THRESH && dy > dx) {
        touchMoved = true;
        ev.preventDefault(); // prevent page scroll while dragging
      }
    }, { passive: false });

    item.addEventListener("touchend", (ev) => {
      if (!reorderMode) return;
      if (!touchMoved) return; // was a tap/scroll

      const t = ev.changedTouches[0];
      const dropEl = document.elementFromPoint(t.clientX, t.clientY);
      if (!dropEl) return;

      const dropItem = dropEl.closest(".img-item");
      if (!dropItem) return;

      const fromIndex = parseInt(item.dataset.index, 10);
      const toIndex = parseInt(dropItem.dataset.index, 10);
      if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
        swapImages(fromIndex, toIndex);
      }
    }, { passive: false });
  });
}

/* ---------- Swap images in galleryOrder and re-render (no page reload) ---------- */
function swapImages(a, b) {
  if (!galleryOrder || galleryOrder.length <= Math.max(a, b)) return;
  const tmp = galleryOrder[a];
  galleryOrder[a] = galleryOrder[b];
  galleryOrder[b] = tmp;
  // re-render gallery and apply to input
  const gallery = $id("img-gallery");
  renderGallery(gallery);
  applyReorderToInput();
}

/* ---------- Apply reordered images to the real file input (no refresh) ---------- */
function applyReorderToInput() {
  if (!galleryOrder || !galleryOrder.length) return;
  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));
  const fileInput = $id("fileInput");
  if (!fileInput) return;
  fileInput.files = dt.files;
  // update file list UI to reflect new order
  updateFileList();
}

/* ---------- AJAX upload / processFile (XHR for progress) ---------- */
async function processFile() {
  // Ensure reorder applied first
  applyReorderToInput();

  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool") || "jpg-to-pdf"; // fallback in dev

  const input = $id("fileInput");
  const inputFiles = input && input.files ? [...input.files] : [];

  // Basic validation
  if (!inputFiles.length) return showError("Please select files.");

  const wrapper = $id("progress-wrapper");
  const bar = $id("progress-bar");
  const percent = $id("progress-percent");
  const downloadBtn = $id("download-btn");
  const msgBox = $id("status-msg");

  // Reset UI
  if (wrapper) wrapper.style.display = "block";
  if (bar) bar.style.width = "0%";
  if (percent) percent.innerText = "0%";
  if (downloadBtn) downloadBtn.style.display = "none";
  if (msgBox) msgBox.style.display = "none";

  const fd = new FormData();
  if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    inputFiles.forEach(f => fd.append("files", f));
  } else {
    fd.append("file", inputFiles[0]);
  }

  // optional tool-specific fields
  if (tool === "split-pdf") fd.append("ranges", $id("rangeInput") ? $id("rangeInput").value : "");
  if (tool === "rotate-pdf") fd.append("angle", $id("angleInput") ? $id("angleInput").value : "");
  if (tool === "protect-pdf" || tool === "unlock-pdf") fd.append("password", $id("passwordInput") ? $id("passwordInput").value : "");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${tool}`);
    xhr.responseType = "blob";

    xhr.upload.onprogress = (e) => {
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

      if (bar) bar.style.width = "100%";
      if (percent) percent.innerText = "100%";

      const blob = xhr.response;
      const url = URL.createObjectURL(blob);

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
        "extract-text": "output.txt"
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

/* ---------- Error / helper ---------- */
function showError(msg) {
  const msgBox = $id("status-msg");
  if (!msgBox) {
    alert(msg);
    return;
  }
  msgBox.className = "error-msg";
  msgBox.innerText = "⚠️ " + msg;
  msgBox.style.display = "block";
}

/* ---------- Read server error blob text ---------- */
function readErrorMessage(blob) {
  if (!blob) {
    showError("Something went wrong.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result || "";
    const match = text.match(/<p>(.*?)<\/p>/i);
    if (match && match[1]) return showError(match[1]);
    const clean = text.replace(/<[^>]+>/g, "").trim();
    if (clean.length) return showError(clean);
    showError("Something went wrong.");
  };
  reader.readAsText(blob);
}

/* ---------- Expose for HTML onclick usage (if needed) ---------- */
window.processFile = processFile;
window.openViewer = openViewer;
window.closeViewerPopup = closeViewerPopup;
