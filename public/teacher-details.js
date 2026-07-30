function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  return digits ? `+91 ${digits}` : "—";
}

function formatAadhaar(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 12);
  return digits ? digits.replace(/(\d{4})(?=\d)/g, "$1 ") : "—";
}

function renderTeacherDetails() {
  const card = document.querySelector(".details-card");
  const errorMessage = document.getElementById("errorMessage");
  try {
    const encoded = window.location.hash.slice(1);
    if (!encoded) throw new Error("This QR link does not contain teacher details.");
    const values = base64UrlDecode(encoded).split("\u001f");
    if (values.length !== 6) throw new Error("The teacher details in this QR link are incomplete.");
    const [name, designation, mobile, address, bloodGroup, aadhaarNo] = values;

    document.getElementById("teacherName").textContent = name || "—";
    document.getElementById("designation").textContent = designation || "—";
    document.getElementById("address").textContent = address || "—";
    document.getElementById("bloodGroup").textContent = bloodGroup || "—";
    document.getElementById("aadhaarNo").textContent = formatAadhaar(aadhaarNo);

    const mobileLink = document.getElementById("mobile");
    mobileLink.textContent = formatPhone(mobile);
    mobileLink.href = mobile ? `tel:+91${String(mobile).replace(/\D/g, "").slice(0, 10)}` : "#";
  } catch (error) {
    card.classList.add("has-error");
    errorMessage.textContent = error.message || "This teacher ID link could not be read.";
  }
}

renderTeacherDetails();
