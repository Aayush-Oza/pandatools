/* ============================================================
   PandaTools Script.js (Rewritten Fast Edition)
   - All features KEPT (reorder, viewer, merge, gallery, drag)
   - 25MB per tool | 50MB for compress-pdf
   - Faster rendering, cleaner structure
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("ready");
});

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* ===========================
   GLOBAL FILE SIZE LIMITS
=========================== */
const LIMITS = {
    "compress-pdf": 50 * 1024 * 1024,
    "default": 25 * 1024 * 1024
};

function safeLimit(tool) {
    return LIMITS[tool] || LIMITS.default;
}

/* ---------------- Helper ---------------- */
const $id = id => document.getElementById(id);

/* ==========================
   TOOL LOADING + UI SETUP
========================== */
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool");

    if (tool && $id("toolName"))
        $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();

    const fileInput = $id("fileInput");
    if (!fileInput) return; // index.html doesn't have tools

    fileInput.addEventListener("change", updateFileList);

    if (["merge-pdf", "jpg-to-pdf"].includes(tool))
        fileInput.multiple = true;

    if (["protect-pdf", "unlock-pdf"].includes(tool))
        $id("passwordInput").style.display = "block";

    if (tool === "split-pdf") $id("rangeInput").style.display = "block";
    if (tool === "rotate-pdf") $id("angleInput").style.display = "block";

    const viewBtn = $id("view-btn");
    if (viewBtn) viewBtn.addEventListener("click", openViewer);
});

/* ============================================================
   FILE LIST + SIZE VALIDATION
============================================================ */
function updateFileList() {
    const input = $id("fileInput");
    const list = $id("fileList");
    const viewBtn = $id("view-btn");
    const hint = $id("reorder-hint");
    const tool = new URLSearchParams(window.location.search).get("tool");

    list.innerHTML = "";
    if (viewBtn) viewBtn.style.display = "none";

    if (!input.files.length) {
        list.innerHTML = "<p style='color:#777;'>No files selected</p>";
        if (hint) hint.style.display = "none";
        return;
    }

    const files = [...input.files];

    // 🔥 Size Check
    if (!validateSize(files, tool)) {
        input.value = "";
        list.innerHTML = "<p style='color:red;'>File too large. Reduce size.</p>";
        return;
    }

    if (viewBtn) viewBtn.style.display = "block";

    files.forEach((file, index) => {
        const div = document.createElement("div");
        const sizeKB = Math.round(file.size / 1024);

        div.className = "file-item";
        div.innerHTML = `
            <svg viewBox="0 0 24 24" width="20"><path d="M14 2H6v16h12V8z"/></svg>
            <span class="file-name">${file.name}</span>
            <span class="file-meta">${sizeKB} KB</span>
            <button class="remove-btn" onclick="removeFile(${index})">×</button>
        `;
        list.appendChild(div);
    });

    const allImages = files.every(f => f.type.startsWith("image/"));
    const allPDFs = files.every(f => /\.pdf$/i.test(f.name));

    if (hint) {
        hint.style.display =
            (tool === "jpg-to-pdf" && files.length > 1 && allImages) ||
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
            showError(
                `Maximum allowed size is ${(max / 1024 / 1024).toFixed(1)} MB`
            );
            return false;
        }
    }
    return true;
}

function removeFile(index) {
    const input = $id("fileInput");
    const dt = new DataTransfer();

    [...input.files]
        .filter((_, i) => i !== index)
        .forEach(f => dt.items.add(f));

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
    const allImages = originalFiles.every(f => f.type.startsWith("image/"));
    const allPDFs = originalFiles.every(f => /\.pdf$/i.test(f.name));

    // MERGE PDF
    if (tool === "merge-pdf" && allPDFs && originalFiles.length > 1) {
        popup.style.display = "flex";
        frame.style.display = "none";
        img.style.display = "none";
        info.style.display = "none";

        gallery.style.display = "block";
        gallery.innerHTML = "";

        galleryOrder = [...originalFiles];
        reorderMode = false;

        showReorderToggle();
        renderGallery(gallery);
        return;
    }

    // Single PDF
    if (isPDF) {
        window.open(URL.createObjectURL(first), "_blank");
        return;
    }

    // Popup Image Viewer
    popup.style.display = "flex";
    frame.style.display = "none";
    img.style.display = "none";
    gallery.innerHTML = "";
    gallery.style.display = "none";
    info.style.display = "none";

    if (allImages && originalFiles.length > 1) {
        galleryOrder = [...originalFiles];
        gallery.style.display = "flex";
        showReorderToggle();
        renderGallery(gallery);
        return;
    }

    if (first.type.startsWith("image/")) {
        img.src = URL.createObjectURL(first);
        img.style.display = "block";
        return;
    }

    info.innerHTML = `<p>Preview not supported for ${first.name}</p>`;
    info.style.display = "block";
}

function showReorderToggle() {
    const toggle = $id("reorder-toggle");
    const status = $id("reorder-status");
    if (!toggle) return;

    toggle.style.display = "inline-flex";

    toggle.onclick = () => {
        reorderMode = !reorderMode;
        toggle.setAttribute("aria-pressed", reorderMode);
        status.style.display = reorderMode ? "inline-block" : "none";

        renderGallery($id("img-gallery"));
    };
}

/* ============================================================
   GALLERY RENDERING (FAST)
============================================================ */
function renderGallery(container) {
    if (!container) return;

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
                div.innerHTML = `
                    <span class="pdf-icon">📄</span>
                    <div class="pdf-info">
                        <span class="pdf-name">${file.name}</span>
                        <span class="pdf-meta">${Math.round(file.size/1024)} KB</span>
                    </div>
                    <button class="pdf-view-btn">View</button>
                `;
                div.querySelector(".pdf-view-btn").onclick = () =>
                    window.open(file._url || (file._url = URL.createObjectURL(file)), "_blank");
            } else {
                div.className = "img-item";
                const im = document.createElement("img");
                if (!file._url) file._url = URL.createObjectURL(file);
                im.src = file._url;
                im.loading = "lazy";
                im.decoding = "async";
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

/* ============================================================
   DRAG & DROP REORDER
============================================================ */
function enableDrag(container) {
    let dragIndex = null;

    container.querySelectorAll("[data-index]").forEach(item => {
        item.addEventListener("dragstart", () => {
            dragIndex = parseInt(item.dataset.index);
        });

        item.addEventListener("dragover", e => e.preventDefault());

        item.addEventListener("drop", e => {
            const dropIndex = parseInt(item.dataset.index);
            swapImages(dragIndex, dropIndex, container);
        });
    });
}

function swapImages(a, b, container) {
    if (a === b) return;
    [galleryOrder[a], galleryOrder[b]] = [galleryOrder[b], galleryOrder[a]];
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
   CLOSE VIEWER
============================================================ */
$id("close-viewer").onclick = () => {
    $id("pdf-viewer-popup").style.display = "none";
};

/* ============================================================
   PROCESS FILE (UPLOAD + RESPONSE)
============================================================ */
async function processFile() {
    applyReorderToInput();

    const tool = new URLSearchParams(window.location.search).get("tool");
    const input = $id("fileInput");
    if (!input.files.length) return showError("Please select a file.");

    const files = [...input.files];

    if (!validateSize(files, tool)) return;

    const fd = new FormData();

    if (["merge-pdf", "jpg-to-pdf"].includes(tool))
        files.forEach(f => fd.append("files", f));
    else
        fd.append("file", files[0]);

    if (tool === "split-pdf") fd.append("ranges", $id("rangeInput").value);
    if (tool === "rotate-pdf") fd.append("angle", $id("angleInput").value);
    if (["protect-pdf", "unlock-pdf"].includes(tool))
        fd.append("password", $id("passwordInput").value);

    resetProgress();

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${tool}`);
    xhr.responseType = "blob";

    xhr.upload.onprogress = e => {
        if (e.lengthComputable) updateProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
        if (xhr.status !== 200) return readErrorMessage(xhr.response);

        updateProgress(100);

        if (tool === "extract-text") return handleExtractText(xhr.response);

        const url = URL.createObjectURL(xhr.response);
        const downloadBtn = $id("download-btn");

        downloadBtn.href = url;
        downloadBtn.download = getDownloadName(tool);
        downloadBtn.style.display = "flex";
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
   EXTRACT TEXT SPECIAL HANDLING
============================================================ */
function handleExtractText(blob) {
    const reader = new FileReader();
    reader.onload = () => {
        const json = JSON.parse(reader.result);
        const txtBlob = new Blob([json.text], { type: "text/plain" });
        const url = URL.createObjectURL(txtBlob);

        const btn = $id("download-btn");
        btn.href = url;
        btn.download = "output.txt";
        btn.style.display = "flex";
    };
    reader.readAsText(blob);
}

/* ============================================================
   DOWNLOAD NAME MAP
============================================================ */
function getDownloadName(tool) {
    return {
        "pdf-to-word": "output.docx",
        "pdf-to-jpg": "images.zip",
        "jpg-to-pdf": "output.pdf",
        "merge-pdf": "merged.pdf",
        "split-pdf": "split.zip",
        "rotate-pdf": "rotated.pdf",
        "compress-pdf": "compressed.pdf",
        "word-to-pdf": "output.pdf",
        "ppt-to-pdf": "output.pdf",
        "extract-text": "output.txt"
    }[tool] || "output.pdf";
}

/* ============================================================
   ERROR HANDLING
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
        const clean = reader.result.replace(/<[^>]+>/g, "").trim();
        showError(clean || "Something went wrong.");
    };
    reader.readAsText(blob);
}

function openTool(t) {
    window.location.href = `tool.html?tool=${t}`;
}
