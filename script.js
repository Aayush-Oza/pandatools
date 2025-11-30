const API_BASE = "https://pdf-tools-backend-4pcq.onrender.com";


function openTool(tool){
    window.location.href = `tool.html?tool=${tool}`;
}

const params = new URLSearchParams(window.location.search);
const tool = params.get("tool");

// Set Title
if (tool && document.getElementById("toolName")) {
    document.getElementById("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
}

// ---------------- SHOW EXTRA FIELDS BASED ON TOOL ----------------

if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    document.getElementById("fileInput").multiple = true;
}

if (tool === "protect-pdf" || tool === "unlock-pdf") {
    document.getElementById("passwordInput").style.display = "block";
}

if (tool === "split-pdf") {
    document.getElementById("rangeInput").style.display = "block";
}

if (tool === "rotate-pdf") {
    document.getElementById("angleInput").style.display = "block";
}

// ---------------- PROCESS FILE ----------------

async function processFile() {
    let fd = new FormData();

    // ------------ MULTIPLE FILE TOOLS ------------
    if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
        const files = document.getElementById("fileInput").files;

        if (!files.length) {
            alert("Please select at least one file");
            return;
        }

        if (tool === "merge-pdf" && files.length < 2) {
            alert("Select at least 2 PDFs to merge");
            return;
        }

        for (let f of files) {
            fd.append("files", f);
        }
    }

    // ------------ SINGLE FILE TOOLS ------------
    else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) {
            alert("Please choose a file");
            return;
        }
        fd.append("file", file);
    }

    // ------------ SPLIT PDF ------------
    if (tool === "split-pdf") {
        const ranges = document.getElementById("rangeInput").value;
        if (!ranges) {
            alert("Enter ranges: e.g. 1-3,5");
            return;
        }
        fd.append("ranges", ranges);
    }

    // ------------ ROTATE PDF ------------
    if (tool === "rotate-pdf") {
        const angle = document.getElementById("angleInput").value;
        fd.append("angle", angle);
    }

    // ------------ PASSWORD TOOLS ------------
    if (tool === "protect-pdf" || tool === "unlock-pdf") {
        const pwd = document.getElementById("passwordInput").value;
        if (!pwd) {
            alert("Enter password");
            return;
        }
        fd.append("password", pwd);
    }

    // ---------------- SEND TO BACKEND ----------------
    const res = await fetch(`${API_BASE}/${tool}`, {
        method: "POST",
        body: fd
    });

    if (!res.ok) {
        alert(`Error (${res.status}): Could not process`);
        return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const download = document.getElementById("downloadLink");
    download.href = url;
    download.download = "output.pdf";
    download.innerText = "Download File";
    download.style.display = "block";
}
