/* tool.js
   Improved file viewer + reorder logic for Panda Tools
   Option A behavior: preview only for PDFs/images; other files show "preview not supported" message.
*/

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* -----------------------------------------------------
   Helper: safe DOM getter
----------------------------------------------------- */
function $id(id) {
  return document.getElementById(id);
}

/* -----------------------------------------------------
   Open Tool Page
----------------------------------------------------- */
function openTool(tool) {
  window.location.href = `tool.html?tool=${tool}`;
}

/* -----------------------------------------------------
   On Page Load → Set Tool Title & Configure Inputs
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (tool && $id("toolName")) {
    $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
  }

  const fileInput = $id("fileInput");
  if (!fileInput) return;

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

  // Ensure view button exists and is wired
  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.addEventListener("click", openViewer);
});

/* -----------------------------------------------------
   FILE LIST UI + VIEW BUTTON
----------------------------------------------------- */
function updateFileList() {
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");
  const reorderHint = $id("reorder-hint");   // <-- NEW

  if (!input || !list) return;

  list.innerHTML = "";
  if (viewBtn) viewBtn.style.display = "none";

  if (!input.files || !input.files.length) {
    list.innerHTML = "<p style='color:#777;'>No files selected</p>";
    if (reorderHint) reorderHint.style.display = "none";   // hide when empty
    return;
  }

  // Show view button for ANY selection (Option A)
  if (viewBtn) viewBtn.style.display = "block";

  [...input.files].forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const sizeKB = Math.round(file.size / 1024);
    item.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 
        2 0 0 0 2 2h12a2 2 0 0 
        0 2-2V8l-6-6zm1 7h5.5L15 
        3.5V9z"/>
      </svg>

      <span class="file-name">${file.name}</span>
      <span class="file-meta">${sizeKB} KB</span>

      <button class="remove-btn" onclick="removeFile(${index})">×</button>
    `;

    list.appendChild(item);
  });

  /* ------------------------------------------
        SHOW REORDER HINT (ONLY FOR IMAGES)
  -------------------------------------------*/
  if (reorderHint) {
    const files = [...input.files];
    const allImages = files.every(f =>
    f.type.startsWith("image/") ||
    /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name)
);


    if (files.length > 1 && allImages) {
      reorderHint.style.display = "block";   // show hint
    } else {
      reorderHint.style.display = "none";    // hide otherwise
    }
  }
}

function removeFile(index) {
  const input = $id("fileInput");
  if (!input || !input.files) return;

  const dt = new DataTransfer();
  let files = [...input.files];

  files.splice(index, 1);
  files.forEach(f => dt.items.add(f));

  input.files = dt.files;
  // refresh UI
  updateFileList();
}

/* -----------------------------------------------------
   VIEWER + DRAG REORDER SYSTEM
----------------------------------------------------- */
let galleryOrder = [];      // array of File objects in current order (for images)
let originalFiles = [];     // snapshot of files when opening viewer

// Open viewer (wired to view-btn)
function openViewer() {
  const input = $id("fileInput");
  if (!input || !input.files || !input.files.length) return;

  originalFiles = [...input.files];

  // Get popup elements (make sure HTML ids exist)
  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");       // <iframe> or <embed> for pdf
  const img = $id("img-preview");       // <img> for single image
  const gallery = $id("img-gallery");   // container for multiple images
  const infoBox = $id("viewer-info");   // area to show messages for unsupported files

  if (!popup) return;
  popup.style.display = "flex";

  // Reset inner states
  if (frame) frame.style.display = "none";
  if (img) { img.style.display = "none"; img.src = ""; }
  if (gallery) { gallery.style.display = "none"; gallery.innerHTML = ""; }
  if (infoBox) { infoBox.style.display = "none"; infoBox.innerHTML = ""; }

  const first = originalFiles[0];

  // PDF preview
if (first.type === "application/pdf") {
  const blobURL = URL.createObjectURL(first);

  // detect mobile (Android / iPhone / iPad)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Mobile → always open in new tab (safe)
    window.open(blobURL, "_blank");
    return;
  }

  // Desktop → show in iframe popup (your existing behavior)
  if (frame) {
    frame.style.display = "block";
    try {
      frame.src = blobURL;
    } catch (err) {
      console.error("PDF preview error:", err);
      if (infoBox) {
        infoBox.style.display = "block";
        infoBox.innerHTML = `<p>Could not preview PDF. Selected: <strong>${first.name}</strong></p>`;
      }
    }
  }

  return;
}


  // MULTIPLE IMAGES -> draggable gallery
  const allImages = originalFiles.every(f => f.type.startsWith("image/"));
  if (originalFiles.length > 1 && allImages) {
    if (!gallery) return;
    gallery.style.display = "flex";
gallery.style.flexDirection = "column";
gallery.style.alignItems = "center";

    galleryOrder = [...originalFiles];
    renderGallery(gallery);
    return;
  }

  // SINGLE IMAGE
  if (first.type.startsWith("image/")) {
    if (img) {
      img.src = URL.createObjectURL(first);
      img.style.display = "block";
    }
    return;
  }

  // Unsupported preview (DOCX/PPT/others) — Option A behavior
  if (infoBox) {
    infoBox.style.display = "block";
    infoBox.innerHTML = `
      <div style="padding:12px;">
        <p><strong>Preview not supported for this file type.</strong></p>
        <p>Selected file: <em>${first.name}</em> (${first.type || "unknown"})</p>
        <p>The file is ready for processing — you can proceed with the tool.</p>
      </div>
    `;
  }
}

/* Render draggable gallery */
function renderGallery(container) {
  container.innerHTML = "";
  container.style.display = "block";       // ensure no grid layout

  galleryOrder.forEach((file, index) => {
    const div = document.createElement("div");
    div.className = "img-item";
    div.draggable = true;
    div.dataset.index = index;

    div.style.margin = "15px 0";           // space between rows
    div.style.display = "block";           // full width row

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "100%";              // full width
    img.style.height = "auto";
    img.style.maxHeight = "350px";         // limit height
    img.style.objectFit = "contain";
    img.style.borderRadius = "10px";

    div.appendChild(img);
    container.appendChild(div);
  });

  enableDrag(container);
}


function enableDrag(container) {
  let dragIndex = null;
  let touchDragging = false;
  let startY = 0;
  let moveY = 0;
  const DRAG_THRESHOLD = 15; // px — prevents scroll interference

  container.querySelectorAll(".img-item").forEach(item => {

    /* ---------------- DESKTOP DRAG ---------------- */
    item.addEventListener("dragstart", e => {
      dragIndex = parseInt(item.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.style.opacity = "0.6";
    });

    item.addEventListener("dragleave", () => {
      item.style.opacity = "1";
    });

    item.addEventListener("drop", e => {
      e.preventDefault();
      item.style.opacity = "1";

      const dropIndex = parseInt(item.dataset.index, 10);
      if (!isNaN(dragIndex) && !isNaN(dropIndex)) {
        swapImages(dragIndex, dropIndex, container);
      }
    });


    /* ---------------- MOBILE TOUCH DRAG ---------------- */
    item.addEventListener("touchstart", e => {
      dragIndex = parseInt(item.dataset.index, 10);
      startY = e.touches[0].clientY;
      moveY = 0;
      touchDragging = false;   // will turn true only if user actually drags
    });

    item.addEventListener("touchmove", e => {
      moveY = e.touches[0].clientY - startY;

      // If user moves finger vertically less than threshold → allow scrolling
      if (Math.abs(moveY) < DRAG_THRESHOLD) {
        touchDragging = false;
        return; // allow normal scroll
      }

      // Beyond threshold → now we consider it dragging
      touchDragging = true;
      e.preventDefault(); // stops scrolling ONLY when dragging
    }, { passive: false });

    item.addEventListener("touchend", e => {
      if (!touchDragging) return; // do not reorder during normal scroll

      const t = e.changedTouches[0];
      const dropElement = document.elementFromPoint(t.clientX, t.clientY);
      if (!dropElement) return;

      const dropItem = dropElement.closest(".img-item");
      if (!dropItem) return;

      const dropIndex = parseInt(dropItem.dataset.index, 10);

      if (!isNaN(dropIndex) && dragIndex !== dropIndex) {
        swapImages(dragIndex, dropIndex, container);
      }
    });
  });
}

/* Clean helper */
function swapImages(a, b, container) {
  const temp = galleryOrder[a];
  galleryOrder[a] = galleryOrder[b];
  galleryOrder[b] = temp;

  renderGallery(container);
  applyReorderToInput();
}


/* Apply reordered images to the real input */
function applyReorderToInput() {
  if (!galleryOrder || !galleryOrder.length) return;

  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));
  const fileInput = $id("fileInput");
  if (!fileInput) return;
  fileInput.files = dt.files;

  // Update the file list UI to reflect new order (names etc.)
  updateFileList();
}

/* Close viewer (wire this to close button) */
const closeViewer = $id("close-viewer");
if (closeViewer) {
  closeViewer.addEventListener("click", () => {
    const popup = $id("pdf-viewer-popup");
    if (popup) popup.style.display = "none";
  });
}

/* -----------------------------------------------------
   PROCESS FILE (Progress + Errors)
----------------------------------------------------- */
async function processFile() {
  applyReorderToInput();

  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  let fd = new FormData();
  const input = $id("fileInput");
  const inputFiles = input && input.files ? [...input.files] : [];

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    if (!inputFiles.length) return showError("Please select files.");
    inputFiles.forEach(f => fd.append("files", f));
  } else {
    const f = inputFiles[0];
    if (!f) return showError("Please select a file.");
    fd.append("file", f);
  }

  if (tool === "split-pdf") fd.append("ranges", $id("rangeInput").value);
  if (tool === "rotate-pdf") fd.append("angle", $id("angleInput").value);
  if (tool === "protect-pdf" || tool === "unlock-pdf")
    fd.append("password", $id("passwordInput").value);

  const wrapper = $id("progress-wrapper");
  const bar = $id("progress-bar");
  const percent = $id("progress-percent");
  const downloadBtn = $id("download-btn");
  const msgBox = $id("status-msg");

  wrapper.style.display = "block";
  bar.style.width = "0%";
  percent.innerText = "0%";
  downloadBtn.style.display = "none";
  msgBox.style.display = "none";

  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${tool}`);
    xhr.responseType = "blob";

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const p = Math.round((e.loaded / e.total) * 100);
      bar.style.width = p + "%";
      percent.innerText = p + "%";
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        readErrorMessage(xhr.response);
        return reject();
      }

      bar.style.width = "100%";
      percent.innerText = "100%";

      // ❌ SUCCESS MESSAGE REMOVED COMPLETELY

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

      downloadBtn.href = url;
      downloadBtn.download = names[tool] || "output.pdf";
      downloadBtn.textContent = "⬇️ Download File";
      downloadBtn.style.display = "flex";

      resolve();
    };

    xhr.onerror = () => {
      showError("Network error. Try again.");
      reject();
    };

    xhr.send(fd);
  });
}

/* -----------------------------------------------------
   ERROR & SUCCESS HELPERS
----------------------------------------------------- */
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
  let reader = new FileReader();
  reader.onload = () => {
    let text = reader.result || "";
    let match = text.match(/<p>(.*?)<\/p>/i);
    if (match && match[1]) return showError(match[1]);

    let clean = text.replace(/<[^>]+>/g, "").trim();
    if (clean.length) return showError(clean);

    showError("Something went wrong.");
  };
  reader.readAsText(blob);
}
