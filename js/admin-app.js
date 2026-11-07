import {
  adminDeleteRating,
  adminListRatings,
  adminLogin,
  adminLogout,
  adminUpdateRating,
  getAdminToken,
} from "./admin-api.js";

const loginPanel = document.getElementById("login-panel");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const tbody = document.getElementById("admin-rows");
const statusLine = document.getElementById("status-line");
const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editError = document.getElementById("edit-error");

let ratings = [];
let editingId = null;

function showLogin() {
  loginPanel.hidden = false;
  adminPanel.hidden = true;
}

function showAdmin() {
  loginPanel.hidden = true;
  adminPanel.hidden = false;
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.style.color = isError ? "#ff6b6b" : "#9ccc9c";
}

function overallSummary(payload) {
  const list = payload.overall_experience;
  if (!Array.isArray(list) || !list.length) return "—";
  return list.map((x) => x.text).join(", ");
}

function renderRows() {
  tbody.replaceChildren();
  for (const row of ratings) {
    const tr = document.createElement("tr");
    const p = row.payload || {};

    const cells = [
      String(row.id),
      p.bus_number || "",
      p.route_number || "",
      p.destination || "",
      p.start_timestamp || "",
      overallSummary(p),
      (p.comments || "").slice(0, 80),
    ];

    for (const text of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }

    const actions = document.createElement("td");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEdit(row));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "destructive";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeRow(row));

    actions.append(editBtn, delBtn);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  }
}

async function refresh() {
  setStatus("Loading…");
  try {
    ratings = await adminListRatings();
    renderRows();
    setStatus(`${ratings.length} rating(s) loaded.`);
  } catch (error) {
    setStatus(error.message, true);
    if (error.message.includes("Sign in")) showLogin();
  }
}

function openEdit(row) {
  editingId = row.id;
  const p = row.payload || {};
  editForm.bus_number.value = p.bus_number || "";
  editForm.route_number.value = p.route_number || "";
  editForm.destination.value = p.destination || "";
  editForm.start_timestamp.value = p.start_timestamp || "";
  editForm.comments.value = p.comments || "";
  editForm.overall_experience.value = JSON.stringify(p.overall_experience || [], null, 2);
  editError.textContent = "";
  editDialog.showModal();
}

async function removeRow(row) {
  const label = `route ${row.payload?.route_number || "?"} (${row.id})`;
  if (!confirm(`Delete rating ${label}? This cannot be undone.`)) return;
  try {
    await adminDeleteRating(row.id);
    setStatus(`Deleted #${row.id}.`);
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const password = loginForm.password.value;
  try {
    await adminLogin(password);
    loginForm.reset();
    showAdmin();
    await refresh();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  adminLogout();
  showLogin();
  setStatus("Signed out.");
});

document.getElementById("refresh-btn").addEventListener("click", () => refresh());

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  editError.textContent = "";
  let overall;
  try {
    overall = JSON.parse(editForm.overall_experience.value || "[]");
  } catch {
    editError.textContent = "Overall experience must be valid JSON.";
    return;
  }

  const payload = {
    bus_number: editForm.bus_number.value.trim(),
    route_number: editForm.route_number.value.trim(),
    destination: editForm.destination.value.trim(),
    start_timestamp: editForm.start_timestamp.value.trim(),
    comments: editForm.comments.value.trim(),
    overall_experience: overall,
  };

  try {
    await adminUpdateRating(editingId, payload);
    editDialog.close();
    setStatus(`Updated #${editingId}.`);
    await refresh();
  } catch (error) {
    editError.textContent = error.message;
  }
});

document.getElementById("edit-cancel").addEventListener("click", () => editDialog.close());

if (getAdminToken()) {
  showAdmin();
  refresh();
} else {
  showLogin();
}
