// preapprover.js
import { checkSession, initIdleTimer, logoutUser } from "./session.js";

let currentPermits = []; // store permits globally for modal use

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkSession();
    if (!user) return;
    initIdleTimer();

    // ✅ Role guard (case-insensitive)
    if (user.role.toLowerCase() !== "preapprover") {
        window.location.href = "index.html";
        return;
    }

    // Wire logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => logoutUser());
    }

    // Load initial data
    loadStats();
    loadPermits();
});

// 🔹 Load stats and render chart + counters
async function loadStats() {
    try {
        const res = await fetch("/pre-approver/stats", { credentials: "include" });
        const stats = await res.json();

        document.getElementById("statPending").textContent = stats.pending || 0;
        document.getElementById("statInProgress").textContent = stats.inProgress || 0;
        document.getElementById("statApproved").textContent = stats.approved || 0;
        document.getElementById("statRejected").textContent = stats.rejected || 0;

        const ctx = document.getElementById("permitStatusChart").getContext("2d");
        if (window.permitChart) window.permitChart.destroy();

        window.permitChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Pending", "In Progress", "Approved", "Rejected"],
                datasets: [{
                    data: [
                        stats.pending || 0,
                        stats.inProgress || 0,
                        stats.approved || 0,
                        stats.rejected || 0
                    ],
                    backgroundColor: ["#f1c40f", "#3498db", "#2ecc71", "#e74c3c"]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" },
                    title: { display: true, text: "Permit Status Overview" }
                }
            }
        });
    } catch (err) {
        console.error("Failed to load stats", err);
    }
}

// 🔹 Load permits into table
async function loadPermits() {
    try {
        const res = await fetch("/pre-approver/permits", { credentials: "include" });
        const permits = await res.json();
        currentPermits = permits;

        const tbody = document.querySelector("#preApproverPermitTable tbody");
        tbody.innerHTML = "";

        if (!permits.length) {
            tbody.innerHTML = `<tr><td colspan="6">No permits found.</td></tr>`;
            return;
        }

        permits.forEach((permit, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${permit.startDateTime ? new Date(permit.startDateTime).toLocaleString() : ""}</td>
        <td>${permit.permitTitle || ""}</td>
        <td>${permit.requester?.username || ""}</td>
        <td><span class="status-badge ${permit.status.toLowerCase()}">${permit.status}</span></td>
        <td><button class="viewBtn" data-id="${permit._id}">View</button></td>
      `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll(".viewBtn").forEach(btn =>
            btn.addEventListener("click", () => openModal(btn.dataset.id))
        );
    } catch (err) {
        console.error("Failed to load permits", err);
    }
}

// 🔹 Modal logic
function openModal(permitId) {
    const permit = currentPermits.find(p => p._id === permitId);
    if (!permit) return;

    document.getElementById("modalPermitTitle").textContent = permit.permitTitle || "";
    document.getElementById("modalRequester").textContent = permit.requester?.username || "";
    document.getElementById("modalStatus").textContent = permit.status;
    document.getElementById("modalSubmitted").textContent = permit.startDateTime ? new Date(permit.startDateTime).toLocaleString() : "";
    document.getElementById("modalComments").textContent = permit.preApproverComments || "";

    document.getElementById("modalApproveBtn").onclick = () => handleAction(permit._id, "approve");
    document.getElementById("modalRejectBtn").onclick = () => handleAction(permit._id, "reject");

    document.getElementById("permitDetailModal").style.display = "block";
}

// Close modal
document.querySelector(".closeBtn").onclick = () => {
    document.getElementById("permitDetailModal").style.display = "none";
};

// 🔹 Handle Approve/Reject
async function handleAction(permitId, action) {
    const comments = prompt(`Enter comments for ${action}:`) || "";

    try {
        const res = await fetch(`/pre-approver/${action}/${permitId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ comments })
        });

        if (!res.ok) throw new Error("Action failed");

        alert(`Permit ${action}d successfully`);
        document.getElementById("permitDetailModal").style.display = "none";
        loadStats();
        loadPermits();
    } catch (err) {
        console.error(err);
        alert("Error performing action");
    }
}
