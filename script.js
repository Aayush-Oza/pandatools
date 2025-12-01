const API_BASE = "https://pdf-tools-backend-1.onrender.com";

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

    if (tool && document.getElementById("toolName")) {
        document.getElementById("toolName").innerText =
            tool.replace(/-/g, " ").toUpperCase();
    }

    const fileInput = document.getElementById("fileInput");
    if (!fileInput) return;

    fileInput.addEventListener("change", updateFileList);

    if (tool === "merge-pdf" || tool === "jpg-to-pdf")
        fileInput.multiple = true;

    if (tool === "protect-pdf" || tool === "unlock-pdf")
        document.getElementById("passwordInput").style.display = "block";

    if (tool === "split-pdf")
        document.getElementById("rangeInput").style.display = "block";

    if (tool === "rotate-pdf")
        document.getElementById("angleInput").style.display = "block";
});

/* -----------------------------------------------------
   FILE LIST UI
----------------------------------------------------- */
function updateFileList() {
    const input = document.getElementById("fileInput");
    const list = document.getElementById("fileList");

    list.innerHTML = "";

    if (!input.files.length) {
        list.innerHTML = "<p style='color:#777;'>No files selected</p>";
        return;
    }

    [...input.files].forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "file-item";

        item.innerHTML = `
            <svg viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 
              2 0 0 0 2 2h12a2 2 0 0 
              0 2-2V8l-6-6zm1 7h5.5L15 
              3.5V9z"/>
            </svg>

            <span class="file-name">${file.name}</span>
            <button class="remove-btn" onclick="removeFile(${index})">×</button>
        `;

        list.appendChild(item);
    });
}

function removeFile(index) {
    const input = document.getElementById("fileInput");
    const dt = new DataTransfer();
    let files = [...input.files];

    files.splice(index, 1);

    files.forEach(f => dt.items.add(f));
    input.files = dt.files;

    updateFileList();
}

/* -----------------------------------------------------
   PROCESS FILE — WITH REAL ERROR MESSAGE + PROGRESS
----------------------------------------------------- */
async function processFile() {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool");

    let fd = new FormData();

    /* MULTIPLE FILE TOOLS */
    if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
        const files = document.getElementById("fileInput").files;

        if (!files.length)
            return showError("Please select at least one file.");

        if (tool === "merge-pdf" && files.length < 2)
            return showError("Merging requires at least 2 PDFs.");

        for (let f of files) fd.append("files", f);
    } else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) return showError("Please select a file.");
        fd.append("file", file);
    }

    /* OTHER TOOL INPUTS */
    if (tool === "split-pdf") {
        fd.append("ranges", document.getElementById("rangeInput").value);
    }

    if (tool === "rotate-pdf") {
        fd.append("angle", document.getElementById("angleInput").value);
    }

    if (tool === "protect-pdf" || tool === "unlock-pdf") {
        fd.append("password", document.getElementById("passwordInput").value);
    }

    /* UI ELEMENTS */
    const wrapper = document.getElementById("progress-wrapper");
    const bar = document.getElementById("progress-bar");
    const percent = document.getElementById("progress-percent");
    const downloadBtn = document.getElementById("download-btn");
    const msgBox = document.getElementById("status-msg");

    msgBox.style.display = "none";
    downloadBtn.style.display = "none";

    wrapper.style.display = "block";
    bar.style.width = "0%";
    percent.innerText = "0%";

    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/${tool}`);
        xhr.responseType = "blob";

        /* PROGRESS */
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                let p = Math.round((e.loaded / e.total) * 100);
                bar.style.width = p + "%";
                percent.innerText = p + "%";
            }
        };

        /* RESPONSE */
        xhr.onload = () => {

            if (xhr.status !== 200) {
                readErrorMessage(xhr.response);
                return reject();
            }

            bar.style.width = "100%";
            percent.innerText = "100%";
            showSuccess("File converted successfully!");

            let blob = xhr.response;
            let url = URL.createObjectURL(blob);

            const fileNames = {
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
            downloadBtn.download = fileNames[tool] || "output.pdf";
            downloadBtn.textContent = "⬇️ Download File";
            downloadBtn.style.display = "flex";

            resolve();
        };

        xhr.onerror = () => {
            showError("Network error. Please try again.");
            reject();
        };

        xhr.send(fd);
    });
}

/* -----------------------------------------------------
   SHOW ERROR MESSAGE (NO ALERT)
----------------------------------------------------- */
function showError(msg) {
    const msgBox = document.getElementById("status-msg");
    msgBox.className = "error-msg";
    msgBox.innerText = "⚠️ " + msg;
    msgBox.style.display = "block";
}

/* -----------------------------------------------------
   SHOW SUCCESS MESSAGE
----------------------------------------------------- */
function showSuccess(msg) {
    const msgBox = document.getElementById("status-msg");
    msgBox.className = "success-msg";
    msgBox.innerText = "✅ " + msg;
    msgBox.style.display = "block";
}

/* -----------------------------------------------------
   PARSE BACKEND ERROR MESSAGE (PDF LOCK, ETC)
----------------------------------------------------- */
function readErrorMessage(blob) {
    let reader = new FileReader();
    reader.onload = () => {
        let text = reader.result || "";

        // Try extracting text inside <p>…</p>
        let match = text.match(/<p>(.*?)<\/p>/i);

        if (match && match[1]) {
            showError(match[1]);   // Clean message
            return;
        }

        // Try finding any readable sentence
        let fallback = text.replace(/<[^>]+>/g, "").trim();

        if (fallback.length > 0) {
            showError(fallback);
        } else {
            showError("Something went wrong.");
        }
    };

    reader.readAsText(blob);
}
