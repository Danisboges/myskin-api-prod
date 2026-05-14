const users = [
  { name: "Dr. Elena Aris", id: "#SKN-2041", role: "doctor", email: "elenaaris@icloud.com", status: "active", initials: "EA", photo: true },
  { name: "Sarah Johnson", id: "#SKN-2041", role: "patient", email: "sarahjohnson@icloud.com", status: "active", initials: "SJ", patient: true },
  { name: "Minaj Kim", id: "#SKN-2041", role: "patient", email: "minajkim@icloud.com", status: "active", initials: "SD" },
  { name: "Niki As", id: "#SKN-2041", role: "doctor", email: "nikias@icloud.com", status: "pending", initials: "SD" },
  { name: "Niki As", id: "#SKN-2041", role: "doctor", email: "nikias@icloud.com", status: "pending", initials: "SD" },
  { name: "Niki As", id: "#SKN-2041", role: "doctor", email: "nikias@icloud.com", status: "pending", initials: "SD" },
  { name: "Niki As", id: "#SKN-2041", role: "doctor", email: "nikias@icloud.com", status: "pending", initials: "SD" },
  { name: "Niki As", id: "#SKN-2041", role: "doctor", email: "nikias@icloud.com", status: "pending", initials: "SD" },
];

const doctors = [
  { name: "Dr. Elena Aris", id: "#SKN-2041", email: "elenaaris@icloud.com", date: "Jan 12, 2024", load: 1, photo: true, initials: "EA" },
  { name: "Dr. Elena Aris", id: "#SKN-2041", email: "elenaaris@icloud.com", date: "Jan 12, 2024", load: 1, photo: true, initials: "EA" },
];

const icon = {
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3.2 5 5.85v5.3c0 4.45 2.83 8.43 7 9.85 4.17-1.42 7-5.4 7-9.85v-5.3L12 3.2Zm0 1.6 5.5 2.1v4.25c0 3.56-2.15 6.8-5.5 8.25-3.35-1.45-5.5-4.69-5.5-8.25V6.9L12 4.8Zm3.53 5.26-4.3 4.3a.75.75 0 0 1-1.06 0l-1.7-1.69a.75.75 0 0 1 1.06-1.06l1.17 1.16 3.77-3.77a.75.75 0 0 1 1.06 1.06Z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="m15.23 5.23 3.54 3.54-9.9 9.9-4.08.54.54-4.08 9.9-9.9Zm1.06-1.06a1.5 1.5 0 0 1 2.12 0l1.42 1.42a1.5 1.5 0 0 1 0 2.12l-.53.53-3.54-3.54.53-.53Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M9.75 3.5h4.5c.97 0 1.75.78 1.75 1.75V6h3.25a.75.75 0 0 1 0 1.5h-1.08l-.72 11.23A2.75 2.75 0 0 1 14.71 21H9.29a2.75 2.75 0 0 1-2.74-2.27L5.83 7.5H4.75a.75.75 0 0 1 0-1.5H8v-.75c0-.97.78-1.75 1.75-1.75ZM9.5 6h5v-.75a.25.25 0 0 0-.25-.25h-4.5a.25.25 0 0 0-.25.25V6Zm-2.16 1.5.7 11a1.25 1.25 0 0 0 1.25 1h5.42a1.25 1.25 0 0 0 1.25-1l.7-11H7.34Zm2.91 2.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Zm3.5 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Z"/></svg>',
};

const userRows = document.querySelector("#userRows");
const doctorRows = document.querySelector("#doctorRows");
const sidebar = document.querySelector(".sidebar");
const userModal = document.querySelector("#userModal");
const verificationModal = document.querySelector("#verificationModal");
const modalTitle = document.querySelector("#userModalTitle");
const modalSubtitle = document.querySelector("#userModalSubtitle");
const modalSubmit = document.querySelector("#modalSubmit");

function avatarTemplate(user) {
  const classes = ["avatar"];
  if (user.photo) classes.push("photo");
  if (user.patient) classes.push("patient");
  return `<span class="${classes.join(" ")}">${user.initials}</span>`;
}

function renderUsers(filter = "all") {
  const filtered = filter === "all" ? users : users.filter((user) => user.role === filter);
  userRows.innerHTML = filtered.map((user, index) => `
    <div class="table-grid users table-row">
      <div class="name-cell">
        ${avatarTemplate(user)}
        <div>
          <strong>${user.name}</strong>
          <small>ID: ${user.id}</small>
        </div>
      </div>
      <span class="role-pill">${user.role}</span>
      <span>${user.email}</span>
      <span class="status-dot ${user.status === "pending" ? "pending" : ""}">${capitalize(user.status)}</span>
      <div class="row-actions">
        <button class="action-button shield" data-open-verification type="button" aria-label="Open verification request">${icon.shield}</button>
        <button class="action-button" data-edit-index="${index}" type="button" aria-label="Edit user">${icon.pencil}</button>
        <button class="action-button delete" type="button" aria-label="Delete user">${icon.trash}</button>
      </div>
    </div>
  `).join("");
}

function renderDoctors() {
  doctorRows.innerHTML = doctors.map((doctor) => `
    <div class="table-grid doctors table-row">
      <div class="name-cell">
        ${avatarTemplate(doctor)}
        <div>
          <strong>${doctor.name}</strong>
          <small>ID: ${doctor.id}</small>
        </div>
      </div>
      <span>${doctor.date}</span>
      <span>${doctor.email}</span>
      <span class="status-dot">${doctor.load}</span>
      <button class="details-link" data-open-verification type="button">Details</button>
    </div>
  `).join("");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#view-${name}`)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === name);
  });

  sidebar.classList.remove("open");
  window.location.hash = name;
}

function openUserModal(mode, user) {
  const isEdit = mode === "edit";
  modalTitle.textContent = isEdit ? "Edit User" : "Add New User";
  modalSubtitle.textContent = isEdit ? "Edit a professional in the clinic portal" : "Register a new professional to the clinic portal";
  modalSubmit.textContent = isEdit ? "Save changes" : "Create Account";

  document.querySelector("#modalName").value = user?.name || "";
  document.querySelector("#modalRole").value = user?.role ? capitalize(user.role) : "Doctor";
  document.querySelector("#modalGender").value = user?.gender || "Female";
  document.querySelector("#modalEmail").value = user?.email || "";
  document.querySelector("#modalPhone").value = user?.phone || "";
  document.querySelector("#modalBirth").value = user?.birth || "";
  document.querySelector("#modalPassword").value = isEdit ? "password123" : "";
  showModal(userModal);
}

function showModal(modal) {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModals() {
  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  });
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.view));
});

document.querySelector(".profile-chip").addEventListener("click", () => showView("profile"));
document.querySelector(".mobile-menu").addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelector("#openAddUser").addEventListener("click", () => openUserModal("add"));

document.querySelector(".segmented").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  renderUsers(button.dataset.filter);
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-index]");
  const verifyButton = event.target.closest("[data-open-verification]");
  const closeButton = event.target.closest("[data-close-modal]");

  if (editButton) {
    const user = users[Number(editButton.dataset.editIndex)] || users[0];
    openUserModal("edit", {
      ...user,
      gender: user.role === "doctor" ? "Female" : "Male",
      phone: "+628134567890",
      birth: "April 23, 1996",
    });
  }

  if (verifyButton) showModal(verificationModal);
  if (closeButton) closeModals();
  if (event.target.classList.contains("modal-backdrop")) closeModals();
});

document.querySelectorAll(".switch").forEach((button) => {
  button.addEventListener("click", () => button.classList.toggle("on"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModals();
});

renderUsers();
renderDoctors();

const initialView = window.location.hash.replace("#", "");
if (["users", "doctors", "settings", "profile"].includes(initialView)) {
  showView(initialView);
}
