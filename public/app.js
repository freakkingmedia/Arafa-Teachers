const TEMPLATE_WIDTH = 673;
const TEMPLATE_HEIGHT = 1063;
const QR_PUBLIC_ORIGIN = "https://arafa-teachers.vercel.app";
const PDF_WIDTH_PT = (5.7 / 2.54) * 72;
const PDF_HEIGHT_PT = (9 / 2.54) * 72;
const FONT_FAMILY = '"DM Sans", Arial, sans-serif';
const PRINT_POINT_SCALE = 3.52;
const PHOTO_LIMIT_MB = 2;
const PHOTO_SIZE_ROUNDING_BUFFER_BYTES = 512 * 1024;
const MAX_PHOTO_BYTES = PHOTO_LIMIT_MB * 1024 * 1024 + PHOTO_SIZE_ROUNDING_BUFFER_BYTES;
const UPLOAD_RETRY_COUNT = 3;
const PHOTO_SIZE_ERROR = `Photo must be ${PHOTO_LIMIT_MB} MB or smaller.`;
const SUBMIT_FAILURE_MESSAGE = "Failed. Please contact +91 8111985415 or snehastudiopynkulam@gmail.com and send the details manually.";

function pt(value) {
  return Math.round(value * PRINT_POINT_SCALE);
}

const templates = {
  template17: {
    name: "Arafa English School - Teachers",
    image: "/assets/templates/template-17.bmp?v=20260730-arafa-teachers-only-v1",
    mode: "teacher",
    options: {
      admissionNo: false,
      classDivision: false,
      dob: false,
      bloodGroup: false
    },
    photo: { x: 151, y: 309, w: 360, h: 360, radius: 180 },
    qr: { x: 257, y: 840, size: 159, margin: 4, level: "L" },
    fields: {
      teacherName: { x: 170, y: 681, w: 333, size: pt(11.5), minSize: pt(4.2), weight: 800, align: "center", color: "#ffffff", transform: "upper", fitPadding: 24 },
      designation: { x: 210, y: 748, w: 318, size: pt(7.4), minSize: pt(4.6), weight: 600, color: "#2d0755", prefix: "Designation: " },
      teacherPhone: { x: 210, y: 799, w: 318, size: pt(7.4), minSize: pt(4.6), weight: 600, color: "#2d0755", prefix: "Mobile No: " }
    }
  }
};
const schoolOptions = Object.entries(templates).map(([key, template]) => ({
  key,
  name: template.name,
  search: template.name.toLowerCase()
}));

const state = {
  templateKey: "template17",
  cardId: makeCardId(),
  croppedPhoto: "",
  cropImage: null,
  qrBaseOrigin: QR_PUBLIC_ORIGIN,
  submitting: false,
  crop: { zoom: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0 }
};

const form = document.getElementById("studentForm");
const message = document.getElementById("message");
const cardPreview = document.getElementById("cardPreview");
const templateBg = document.getElementById("templateBg");
const photoLayer = document.getElementById("photoLayer");
const editableLayer = document.getElementById("editableLayer");
const renderedCardCanvas = document.getElementById("renderedCardCanvas");
const renderedCardCtx = renderedCardCanvas.getContext("2d");
const qrLayer = document.getElementById("qrLayer");
const schoolSearch = document.getElementById("schoolSearch");
const schoolResults = document.getElementById("schoolResults");
const cropDialog = document.getElementById("cropDialog");
const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");
const zoomRange = document.getElementById("zoomRange");
const photoInput = document.getElementById("photoInput");
const submitBtn = document.getElementById("submitBtn");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");

const inputs = {
  templateKey: document.getElementById("templateKey"),
  schoolSearch,
  studentName: document.getElementById("studentName"),
  admissionNo: document.getElementById("admissionNo"),
  studentClass: document.getElementById("studentClass"),
  division: document.getElementById("division"),
  bloodGroup: document.getElementById("bloodGroup"),
  academicYear: document.getElementById("academicYear"),
  programme: document.getElementById("programme"),
  busRoute: document.getElementById("busRoute"),
  dobDay: document.getElementById("dobDay"),
  dobMonth: document.getElementById("dobMonth"),
  dobYear: document.getElementById("dobYear"),
  guardianName: document.getElementById("guardianName"),
  houseName: document.getElementById("houseName"),
  place: document.getElementById("place"),
  phone: document.getElementById("phone"),
  teacherName: document.getElementById("teacherName"),
  designation: document.getElementById("designation"),
  teacherPhone: document.getElementById("teacherPhone"),
  teacherAddress: document.getElementById("teacherAddress"),
  teacherBloodGroup: document.getElementById("teacherBloodGroup"),
  aadhaarNo: document.getElementById("aadhaarNo")
};

const defaultStudentClassOptions = Array.from(inputs.studentClass.options).map(option => ({
  value: option.value,
  text: option.textContent
}));
const defaultDivisionOptions = Array.from(inputs.division.options).map(option => ({
  value: option.value,
  text: option.textContent
}));

function makeCardId() {
  return `ID-${Math.floor(1000 + Math.random() * 9000)}`;
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase());
}

function cleanNameValue(value) {
  return value.replace(/[^a-z\s.'-]/gi, "").replace(/\s{2,}/g, " ");
}

function makeTwoDigit(value) {
  return String(value).padStart(2, "0");
}

function getDobValue() {
  const day = inputs.dobDay.value;
  const month = inputs.dobMonth.value;
  const year = inputs.dobYear.value;
  if (!day || !month || !year) return "";
  return `${year}-${makeTwoDigit(month)}-${makeTwoDigit(day)}`;
}

function getFormData() {
  const phoneDigits = inputs.phone.value.replace(/\D/g, "").slice(0, 10);
  const teacherPhoneDigits = inputs.teacherPhone.value.replace(/\D/g, "").slice(0, 10);
  const teacherName = titleCase(inputs.teacherName.value);
  return {
    studentName: teacherName,
    admissionNo: inputs.admissionNo.value.trim().replace(/[^a-z0-9/-]/gi, "").toUpperCase(),
    studentClass: inputs.studentClass.value,
    division: inputs.division.value,
    bloodGroup: inputs.bloodGroup.value.trim(),
    academicYear: inputs.academicYear.value,
    programme: inputs.programme.value,
    busRoute: inputs.busRoute.value.trim().replace(/\s{2,}/g, " "),
    dob: getDobValue(),
    guardianName: titleCase(inputs.guardianName.value),
    houseName: titleCase(inputs.houseName.value),
    place: titleCase(inputs.place.value),
    phone: phoneDigits ? `+91 ${phoneDigits}` : "",
    rawPhone: phoneDigits,
    teacherName,
    designation: inputs.designation.value.trim().replace(/\s{2,}/g, " "),
    teacherPhone: teacherPhoneDigits ? `+91 ${teacherPhoneDigits}` : "",
    rawTeacherPhone: teacherPhoneDigits,
    teacherAddress: inputs.teacherAddress.value.trim().replace(/\s{2,}/g, " "),
    teacherBloodGroup: inputs.teacherBloodGroup.value.trim(),
    aadhaarNo: inputs.aadhaarNo.value.replace(/\D/g, "").slice(0, 12),
    cardId: state.cardId
  };
}

function displayDob(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function fieldValue(key, data) {
  if (key === "dob") return displayDob(data.dob);
  if (key === "studentClass") return [data.studentClass, data.division].filter(Boolean).join(" ");
  if (key === "academicYear") return (data.academicYear || "").split("|")[0] || "";
  if (key === "academicYearExpiry") return (data.academicYear || "").split("|")[1] || "";
  return data[key] || "";
}

function makeTeacherQrPayload(data) {
  if (!data.teacherAddress && !data.teacherBloodGroup && !data.aadhaarNo) return "";
  const values = [
    data.teacherName,
    data.designation,
    data.rawTeacherPhone,
    data.teacherAddress,
    data.teacherBloodGroup,
    data.aadhaarNo
  ].map(value => String(value || "").replace(/\u001f/g, " "));
  return `${state.qrBaseOrigin}/t#${base64UrlEncode(values.join("\u001f"))}`;
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function applyTemplate() {
  const template = templates[state.templateKey];
  const scale = getPreviewScale();
  renderEditableHtml(template);
  applyTemplateOptions(template);
  applyClassOptions(template);
  applyDivisionOptions(template);
  applyProgrammeOptions(template);
  applyAcademicYearOptions(template);
  applyFormMode(template);
  applySchoolLock();
  templateBg.src = template.image;
  const scalePhoto = template.photo;
  photoLayer.style.left = percent(scalePhoto.x, TEMPLATE_WIDTH);
  photoLayer.style.top = percent(scalePhoto.y, TEMPLATE_HEIGHT);
  photoLayer.style.width = percent(scalePhoto.w, TEMPLATE_WIDTH);
  photoLayer.style.height = percent(scalePhoto.h, TEMPLATE_HEIGHT);
  photoLayer.style.borderRadius = scalePhoto.radius ? "50%" : "0";
  photoLayer.style.border = scalePhoto.stroke ? `${Math.max(1, scalePhoto.strokeWidth * scale)}px solid ${scalePhoto.stroke}` : "";
  photoLayer.style.boxSizing = "border-box";
  photoLayer.style.clipPath = scalePhoto.clipBottomY
    ? `inset(0 0 ${Math.max(0, scalePhoto.y + scalePhoto.h - scalePhoto.clipBottomY) * scale}px 0 round 50%)`
    : "";
  photoLayer.style.display = state.croppedPhoto ? "block" : "none";
  photoLayer.src = state.croppedPhoto;

  if (template.qr) {
    qrLayer.style.left = percent(template.qr.x, TEMPLATE_WIDTH);
    qrLayer.style.top = percent(template.qr.y, TEMPLATE_HEIGHT);
    qrLayer.style.width = percent(template.qr.size, TEMPLATE_WIDTH);
    qrLayer.style.height = percent(template.qr.size, TEMPLATE_HEIGHT);
  }

  for (const [key, config] of Object.entries(template.fields)) {
    const node = editableLayer.querySelector(`[data-field="${key}"]`);
    if (!node) continue;
    node.style.left = percent(config.x, TEMPLATE_WIDTH);
    node.style.top = percent(config.y, TEMPLATE_HEIGHT);
    node.style.width = percent(config.w, TEMPLATE_WIDTH);
    node.style.height = `${Math.ceil((config.coverHeight || config.size * (config.lines || 1) * (config.lineHeight || 1.35)) * scale)}px`;
    node.style.fontSize = `${Math.max(8, config.size * scale)}px`;
    node.style.lineHeight = config.lineHeight || 1.08;
    node.style.color = config.color;
    node.style.fontWeight = config.weight || 700;
    node.style.background = "transparent";
    node.style.whiteSpace = config.lines && config.lines > 1 ? "normal" : "nowrap";
    node.style.overflowWrap = config.lines && config.lines > 1 ? "break-word" : "normal";
    node.style.transform = config.rotate ? `rotate(${config.rotate}deg)` : "";
    node.style.transformOrigin = "left top";
    node.style.textAlign = config.align || "left";
    node.style.justifyContent = config.align === "center"
      ? "center"
      : config.align === "right"
        ? "flex-end"
        : "flex-start";
  }
  renderPreview();
}

function applyFormMode(template) {
  const mode = template.mode === "teacher" ? "teacher" : "student";
  document.querySelectorAll("[data-card-mode]").forEach(node => {
    node.classList.toggle("is-hidden", node.dataset.cardMode !== mode);
  });
  formTitle.textContent = mode === "teacher" ? "Teacher details" : "Student details";
  formSubtitle.textContent = mode === "teacher"
    ? "Complete every field exactly as it should appear in the official record."
    : "Enter the card content and submit.";
}

function applyTemplateOptions(template) {
  document.querySelectorAll("[data-template-option]").forEach(node => {
    const option = node.dataset.templateOption;
    const hasOption = template.options && Object.prototype.hasOwnProperty.call(template.options, option);
    const hiddenByDefault = option === "academicYear" || option === "programme" || option === "busRoute";
    const visible = hasOption ? template.options[option] !== false : !hiddenByDefault;
    node.classList.toggle("is-hidden", !visible);
  });
}

function applyClassOptions(template) {
  const currentValue = inputs.studentClass.value;
  const classOptions = template.classOptions
    ? [{ value: "", text: "Select" }, ...template.classOptions.map(value => ({ value, text: value }))]
    : defaultStudentClassOptions;
  const currentOptions = Array.from(inputs.studentClass.options).map(option => option.value).join("|");
  const nextOptions = classOptions.map(option => option.value).join("|");

  if (currentOptions !== nextOptions) {
    inputs.studentClass.innerHTML = classOptions
      .map(option => `<option value="${option.value}">${option.text}</option>`)
      .join("");
  }

  inputs.studentClass.value = classOptions.some(option => option.value === currentValue) ? currentValue : "";
}

function applyDivisionOptions(template) {
  const currentValue = inputs.division.value;
  const divisionOptions = template.divisionOptions
    ? [{ value: "", text: "Select" }, ...template.divisionOptions.map(value => ({ value, text: value }))]
    : defaultDivisionOptions;
  const currentOptions = Array.from(inputs.division.options).map(option => option.value).join("|");
  const nextOptions = divisionOptions.map(option => option.value).join("|");

  if (currentOptions !== nextOptions) {
    inputs.division.innerHTML = divisionOptions
      .map(option => `<option value="${option.value}">${option.text}</option>`)
      .join("");
  }

  inputs.division.value = divisionOptions.some(option => option.value === currentValue) ? currentValue : "";
}

function applyProgrammeOptions(template) {
  const currentValue = inputs.programme.value;
  const programmeOptions = template.programmeOptions
    ? [{ value: "", text: "Select" }, ...template.programmeOptions.map(value => ({ value, text: value }))]
    : [{ value: "", text: "Select" }];
  const currentOptions = Array.from(inputs.programme.options).map(option => option.value).join("|");
  const nextOptions = programmeOptions.map(option => option.value).join("|");

  if (currentOptions !== nextOptions) {
    inputs.programme.innerHTML = programmeOptions
      .map(option => `<option value="${option.value}">${option.text}</option>`)
      .join("");
  }

  inputs.programme.value = programmeOptions.some(option => option.value === currentValue) ? currentValue : "";
}

function applyAcademicYearOptions(template) {
  const currentValue = inputs.academicYear.value;
  const values = template.academicYearOptions || [];
  const academicYearOptions = [
    { value: "", text: "Select" },
    ...values.map(option => typeof option === "string" ? { value: option, text: option } : option)
  ];
  const currentOptions = Array.from(inputs.academicYear.options).map(option => option.value).join("|");
  const nextOptions = academicYearOptions.map(option => option.value).join("|");

  if (currentOptions !== nextOptions) {
    inputs.academicYear.innerHTML = academicYearOptions
      .map(option => `<option value="${option.value}">${option.text}</option>`)
      .join("");
  }

  inputs.academicYear.value = academicYearOptions.some(option => option.value === currentValue) ? currentValue : "";
}

function renderEditableHtml(template) {
  const html = Object.keys(template.fields)
    .map(key => `<span class="card-text card-field-${key}" data-field="${key}"></span>`)
    .join("");

  if (editableLayer.dataset.templateKey !== state.templateKey || editableLayer.innerHTML !== html) {
    editableLayer.dataset.templateKey = state.templateKey;
    editableLayer.innerHTML = html;
  }
}

function percent(value, total) {
  return `${(value / total) * 100}%`;
}

function getPreviewScale() {
  return (cardPreview.clientWidth || TEMPLATE_WIDTH) / TEMPLATE_WIDTH;
}

function renderPreview() {
  const data = getFormData();
  inputs.studentName.value = data.studentName;
  inputs.guardianName.value = data.guardianName;
  inputs.houseName.value = data.houseName;
  inputs.place.value = data.place;
  inputs.phone.value = data.rawPhone;
  inputs.admissionNo.value = data.admissionNo;
  inputs.busRoute.value = data.busRoute;
  inputs.teacherName.value = data.teacherName;
  inputs.designation.value = data.designation;
  inputs.teacherPhone.value = data.rawTeacherPhone;
  inputs.teacherAddress.value = data.teacherAddress;
  inputs.aadhaarNo.value = data.aadhaarNo;

  const template = templates[state.templateKey];
  const scale = getPreviewScale();
  for (const [key, config] of Object.entries(template.fields)) {
    const node = editableLayer.querySelector(`[data-field="${key}"]`);
    if (!node) continue;
    const value = fieldValue(key, getFormData());
    node.textContent = formatTemplateText(value, config);
    fitPreviewText(node, config, scale);
  }
  applyInlinePreviewPositions(template, scale);
  renderQrPreview(template, getFormData());
  scheduleCanvasPreviewRender();
}

function renderQrPreview(template, data) {
  const payload = template.qr ? makeTeacherQrPayload(data) : "";
  if (!payload) {
    qrLayer.style.display = "none";
    return;
  }
  drawQrCode(qrLayer, payload, template.qr.size, template.qr.margin, template.qr.level);
  qrLayer.style.display = "block";
}

function drawQrCode(canvas, payload, size, marginModules = 4, errorCorrectionLevel = "M") {
  if (typeof qrcode !== "function") {
    throw new Error("QR generator is unavailable.");
  }
  const code = qrcode(0, errorCorrectionLevel);
  code.addData(payload, "Byte");
  code.make();
  const moduleCount = code.getModuleCount();
  const totalModules = moduleCount + marginModules * 2;
  const cellSize = Math.max(1, Math.floor(size / totalModules));
  const drawnSize = cellSize * totalModules;
  const offset = Math.floor((size - drawnSize) / 2);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!code.isDark(row, col)) continue;
      ctx.fillRect(
        offset + (col + marginModules) * cellSize,
        offset + (row + marginModules) * cellSize,
        cellSize,
        cellSize
      );
    }
  }
  return canvas;
}

function fitPreviewText(node, config, scale) {
  let size = Math.max(8, config.size * scale);
  const minSize = Math.max(6, (config.minSize || 8) * scale);
  node.style.fontSize = `${size}px`;
  const fitPadding = config.fitPadding ? config.fitPadding * scale : 4;
  const availableWidth = Math.max(0, node.clientWidth - fitPadding);
  while ((measurePreviewText(node) > availableWidth || node.scrollHeight > node.clientHeight) && size > minSize) {
    size -= 0.5;
    node.style.fontSize = `${size}px`;
  }
}

function applyInlinePreviewPositions(template, scale) {
  for (const [key, config] of Object.entries(template.fields)) {
    if (!config.inlineAfter) continue;
    const node = editableLayer.querySelector(`[data-field="${key}"]`);
    const anchor = editableLayer.querySelector(`[data-field="${config.inlineAfter}"]`);
    if (!node || !anchor) continue;
    const anchorConfig = template.fields[config.inlineAfter];
    const anchorWidth = measurePreviewText(anchor);
    const spaceWidth = measurePreviewSpace(anchor, config.inlineGapSpaces || 1);
    const nextX = anchorConfig.x + (anchorWidth + spaceWidth) / scale;
    node.style.left = percent(nextX, TEMPLATE_WIDTH);
    node.style.width = percent(Math.max(80, config.x + config.w - nextX), TEMPLATE_WIDTH);
  }
}

function measurePreviewText(node) {
  if (!node.textContent) return 0;
  const range = document.createRange();
  range.selectNodeContents(node);
  const width = range.getBoundingClientRect().width;
  range.detach();
  return width;
}

function measurePreviewSpace(node, count = 1) {
  const style = getComputedStyle(node);
  const canvas = measurePreviewSpace.canvas || (measurePreviewSpace.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return ctx.measureText(" ".repeat(count)).width;
}

let previewRenderToken = 0;

function scheduleCanvasPreviewRender() {
  const token = ++previewRenderToken;
  requestAnimationFrame(async () => {
    try {
      const canvas = await renderCardCanvas({ syncPreview: false });
      if (token !== previewRenderToken) return;
      renderedCardCtx.clearRect(0, 0, renderedCardCanvas.width, renderedCardCanvas.height);
      renderedCardCtx.drawImage(canvas, 0, 0);
    } catch (error) {
      console.warn("Preview render failed", error);
    }
  });
}

function formatTemplateText(value, config) {
  if (!value) return "";
  let text = String(value);
  if (config.transform === "upper") text = text.toUpperCase();
  return `${config.prefix || ""}${text}${config.suffix || ""}`;
}

function showMessage(text, ok = false) {
  message.textContent = text;
  message.classList.toggle("ok", ok);
}

function showSubmitError(error) {
  const detail = error && error.message ? ` (${error.message})` : "";
  showMessage(`${SUBMIT_FAILURE_MESSAGE}${detail}`);
}

function setSubmitSending(isSending) {
  state.submitting = isSending;
  submitBtn.disabled = isSending;
  submitBtn.textContent = isSending ? "Uploading..." : "Submit";
}

function validateCardDetails() {
  const template = templates[state.templateKey];

  const data = getFormData();
  if (template.mode === "teacher") {
    const requiredTeacherFields = [
      ["teacherName", "Name"],
      ["designation", "Designation"],
      ["teacherPhone", "Mobile"],
      ["teacherAddress", "Address"],
      ["teacherBloodGroup", "Blood group"],
      ["aadhaarNo", "Aadhaar no."]
    ];
    for (const [key, label] of requiredTeacherFields) {
      if (!String(data[key]).trim()) return `${label} is required.`;
    }
    if (!/^\d{10}$/.test(data.rawTeacherPhone)) return "Mobile must be 10 digits after +91.";
    if (!/^\d{12}$/.test(data.aadhaarNo)) return "Aadhaar no. must be 12 digits.";
    if (!state.croppedPhoto) return "Photo is required.";
    return "";
  }

  const required = [
    ["studentName", "Student name"],
    ["guardianName", "Guardian name"],
    ["houseName", "House name"],
    ["place", "Place"],
    ["phone", "Phone"]
  ];

  if (template.fields.studentClass) {
    required.splice(1, 0, ["studentClass", "Class"], ["division", "Division"]);
  }
  if (template.fields.admissionNo) {
    required.splice(1, 0, ["admissionNo", "Admission no."]);
  }
  if (template.fields.dob) {
    required.splice(template.fields.admissionNo ? 4 : 3, 0, ["dob", "Date of birth"]);
  }
  if (template.fields.academicYear) {
    required.splice(1, 0, ["academicYear", "Academic year"]);
  }
  if (template.fields.programme) {
    required.splice(1, 0, ["programme", "Programme"]);
  }
  if (template.fields.busRoute) {
    required.push(["busRoute", "Bus route"]);
  }

  for (const [key, label] of required) {
    if (!String(data[key]).trim()) return `${label} is required.`;
  }
  if (!/^\d{10}$/.test(data.rawPhone)) return "Phone must be 10 digits after +91.";
  if (template.options && template.options.bloodGroup && !data.bloodGroup) return "Blood group is required.";
  if (!state.croppedPhoto) return "Photo is required.";
  return "";
}

function isSchoolUnlocked() {
  return true;
}

function applySchoolLock() {
  form.querySelectorAll("input, select, button").forEach(control => {
    control.disabled = control === submitBtn && state.submitting;
  });
  submitBtn.textContent = state.submitting ? "Uploading..." : "Submit";
}

function renderSchoolSearchResults() {
  const query = schoolSearch.value.trim().toLowerCase();
  const matches = schoolOptions
    .filter(option => !query || option.search.includes(query))
    .slice(0, 12);

  if (!matches.length) {
    schoolResults.innerHTML = `<div class="school-empty">No matching schools</div>`;
  } else {
    schoolResults.innerHTML = matches
      .map(option => `<button type="button" class="school-result" role="option" data-template-key="${option.key}">${option.name}</button>`)
      .join("");
  }

  const isOpen = document.activeElement === schoolSearch || Boolean(query);
  schoolResults.classList.toggle("is-open", isOpen);
  schoolSearch.setAttribute("aria-expanded", String(isOpen));
}

function closeSchoolResults() {
  schoolResults.classList.remove("is-open");
  schoolSearch.setAttribute("aria-expanded", "false");
}

function selectSchool(templateKey) {
  if (!templates[templateKey]) return;
  state.templateKey = templateKey;
  inputs.templateKey.value = templateKey;
  schoolSearch.value = templates[templateKey].name;
  closeSchoolResults();
  showMessage("");
  applyTemplate();
}

function openCropper(file) {
  if (file.size > MAX_PHOTO_BYTES) {
    showMessage(PHOTO_SIZE_ERROR);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.cropImage = image;
      state.crop.zoom = Math.max(cropCanvas.width / image.width, cropCanvas.height / image.height);
      state.crop.offsetX = 0;
      state.crop.offsetY = 0;
      zoomRange.value = "1";
      cropDialog.showModal();
      drawCrop();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function drawCrop() {
  const image = state.cropImage;
  if (!image) return;
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.fillStyle = "#111827";
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  const baseScale = Math.max(cropCanvas.width / image.width, cropCanvas.height / image.height);
  const scale = baseScale * Number(zoomRange.value);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (cropCanvas.width - width) / 2 + state.crop.offsetX;
  const y = (cropCanvas.height - height) / 2 + state.crop.offsetY;
  cropCtx.drawImage(image, x, y, width, height);
  drawCropGuide();
}

function drawCropGuide() {
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  cropCtx.lineWidth = 3;
  cropCtx.setLineDash([9, 7]);

  const radius = Math.min(cropCanvas.width, cropCanvas.height) * 0.44;
  const centerX = cropCanvas.width / 2;
  const centerY = cropCanvas.height / 2;

  cropCtx.fillStyle = "rgba(0, 0, 0, 0.34)";
  cropCtx.beginPath();
  cropCtx.rect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  cropCtx.fill("evenodd");

  cropCtx.beginPath();
  cropCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  cropCtx.stroke();

  cropCtx.restore();
}

function applyCrop() {
  const image = state.cropImage;
  if (!image) return;
  const output = document.createElement("canvas");
  output.width = 800;
  output.height = 800;
  const ctx = output.getContext("2d");
  const baseScale = Math.max(cropCanvas.width / image.width, cropCanvas.height / image.height);
  const scale = baseScale * Number(zoomRange.value);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (cropCanvas.width - width) / 2 + state.crop.offsetX;
  const y = (cropCanvas.height - height) / 2 + state.crop.offsetY;

  const sourceRadius = Math.min(cropCanvas.width, cropCanvas.height) * 0.44;
  const cropLeft = cropCanvas.width / 2 - sourceRadius;
  const cropTop = cropCanvas.height / 2 - sourceRadius;
  const factor = output.width / (sourceRadius * 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(output.width / 2, output.height / 2, output.width / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(
    image,
    (x - cropLeft) * factor,
    (y - cropTop) * factor,
    width * factor,
    height * factor
  );
  ctx.restore();
  state.croppedPhoto = output.toDataURL("image/png");
  photoLayer.src = state.croppedPhoto;
  photoLayer.style.display = "block";
  document.getElementById("photoStatus").textContent = "Selected";
  cropDialog.close();
  renderPreview();
}

async function renderCardCanvas(options = {}) {
  if (options.syncPreview !== false) {
    renderPreview();
  }
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TEMPLATE_WIDTH;
  canvas.height = TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  const template = templates[state.templateKey];
  const bg = await loadImage(template.image);
  ctx.drawImage(bg, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);

  if (state.croppedPhoto) {
    const photo = await loadImage(state.croppedPhoto, "selected photo");
    const p = template.photo;
    ctx.save();
    if (p.radius) {
      ctx.beginPath();
      if (p.ellipse) {
        ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 2, 0, Math.PI * 2);
      }
      ctx.clip();
      if (p.clipBottomY) {
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.w, p.clipBottomY - p.y);
        ctx.clip();
      }
    }
    ctx.drawImage(photo, p.x, p.y, p.w, p.h);
    ctx.restore();
    if (p.stroke && p.radius) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 2 - (p.strokeWidth || 1) / 2, 0, Math.PI * 2);
      ctx.lineWidth = p.strokeWidth || 1;
      ctx.strokeStyle = p.stroke;
      ctx.stroke();
      ctx.restore();
    }
  }

  const data = getFormData();
  const drawnFields = {};
  for (const [key, config] of Object.entries(template.fields)) {
    const raw = fieldValue(key, data);
    const text = formatTemplateText(raw, config);
    const drawConfig = { ...config };
    if (config.inlineAfter && drawnFields[config.inlineAfter]) {
      const anchor = drawnFields[config.inlineAfter];
      ctx.font = `${config.weight || 700} ${config.size}px ${FONT_FAMILY}`;
      drawConfig.x = anchor.x + anchor.width + ctx.measureText(" ".repeat(config.inlineGapSpaces || 1)).width;
      drawConfig.w = Math.max(80, config.x + config.w - drawConfig.x);
    }
    drawnFields[key] = drawFittedText(ctx, text, drawConfig) || {
      x: drawConfig.x,
      y: drawConfig.y,
      width: 0,
      size: drawConfig.size
    };
  }

  if (template.qr) {
    const qrPayload = makeTeacherQrPayload(data);
    if (qrPayload) {
      const qrCanvas = document.createElement("canvas");
      drawQrCode(qrCanvas, qrPayload, template.qr.size, template.qr.margin, template.qr.level);
      ctx.drawImage(qrCanvas, template.qr.x, template.qr.y, template.qr.size, template.qr.size);
    }
  }

  return canvas;
}

function drawFittedText(ctx, text, config) {
  if (!text) return;
  let size = config.size;
  const minSize = config.minSize || 12;
  const fitPadding = config.fitPadding || 0;
  const availableWidth = Math.max(1, config.w - fitPadding);
  const contentX = config.x + fitPadding / 2;
  const lineBoxHeight = config.coverHeight || config.size * 1.35;
  const cover = config.cover === false ? "" : config.cover || templates[state.templateKey].cover || "";
  if (cover) {
    ctx.fillStyle = cover;
    ctx.fillRect(config.x - 4, config.y - 3, config.w + 8, config.coverHeight || size * 1.35);
  }
  ctx.fillStyle = config.color;
  ctx.textBaseline = "top";
  ctx.font = `${config.weight || 700} ${size}px ${FONT_FAMILY}`;
  while (ctx.measureText(text).width > availableWidth && size > minSize) {
    size -= 0.5;
    ctx.font = `${config.weight || 700} ${size}px ${FONT_FAMILY}`;
  }
  const y = config.y + Math.max(0, (lineBoxHeight - size) / 2);
  let x = contentX;
  if (config.align === "center") {
    x = contentX + (availableWidth - ctx.measureText(text).width) / 2;
  } else if (config.align === "right") {
    x = contentX + availableWidth - ctx.measureText(text).width;
  }
  if (config.rotate) {
    ctx.save();
    ctx.translate(contentX, y);
    ctx.rotate((config.rotate * Math.PI) / 180);
    const rotatedX = config.align === "center" ? (availableWidth - ctx.measureText(text).width) / 2 : 0;
    ctx.fillText(text, rotatedX, 0);
    ctx.restore();
    return { x, y, width: ctx.measureText(text).width, size };
  }
  if (config.lines && config.lines > 1) {
    drawWrappedText(ctx, text, config, size);
    return { x: config.x, y: config.y, width: config.w, size };
  }
  ctx.fillText(text, x, y);
  return { x, y, width: ctx.measureText(text).width, size };
}

function drawWrappedText(ctx, text, config, size) {
  const fittedSize = fitWrappedCanvasText(ctx, text, config, size);
  if (fittedSize !== size) {
    size = fittedSize;
    ctx.font = `${config.weight || 700} ${size}px ${FONT_FAMILY}`;
  }
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= config.w || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === config.lines - 1) break;
    }
  }

  const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remaining = words.slice(usedWords).join(" ");
  if (remaining || current) lines.push(remaining || current);

  const lineHeight = size * (config.lineHeight || 1.14);
  lines.slice(0, config.lines).forEach((line, index) => {
    let output = line;
    while (ctx.measureText(output).width > config.w && output.length > 1) {
      output = output.slice(0, -2).trimEnd();
    }
    if (index === config.lines - 1 && output !== line) output = `${output}...`;
    ctx.fillText(output, config.x, config.y + index * lineHeight);
  });
}

function fitWrappedCanvasText(ctx, text, config, size) {
  const minSize = config.minSize || 12;
  let fittedSize = size;
  while (fittedSize > minSize && wrappedLineCount(ctx, text, config.w, config.lines) > config.lines) {
    fittedSize -= 1;
    ctx.font = `${config.weight || 700} ${fittedSize}px ${FONT_FAMILY}`;
  }
  return fittedSize;
}

function wrappedLineCount(ctx, text, width, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  let count = 1;
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= width || !current) {
      current = next;
    } else {
      count += 1;
      current = word;
      if (count > maxLines) return count;
    }
  }
  return words.length ? count : 0;
}

function loadImage(src, label = "template image") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        if (image.decode) await image.decode();
      } catch (error) {
        // Some browsers reject decode() for already-loaded data URLs. onload is enough here.
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Could not load ${label}.`));
    image.src = src;
  });
}

async function createPdfBase64() {
  const canvas = await renderCardCanvas();
  const jpegBase64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
  const pdfBytes = buildImagePdf(jpegBase64, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
  return bytesToBase64(pdfBytes);
}

function buildImagePdf(jpegBase64, width, height) {
  const jpegBytes = base64ToBytes(jpegBase64);
  const pageWidth = PDF_WIDTH_PT;
  const pageHeight = PDF_HEIGHT_PT;
  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatPdfNumber(pageWidth)} ${formatPdfNumber(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  objects.push({ stream: jpegBytes, dict: `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>` });
  const content = asciiBytes(`q\n${formatPdfNumber(pageWidth)} 0 0 ${formatPdfNumber(pageHeight)} 0 0 cm\n/Im0 Do\nQ\n`);
  objects.push({ stream: content, dict: `<< /Length ${content.length} >>` });

  const chunks = [asciiBytes("%PDF-1.4\n")];
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(totalLength(chunks));
    chunks.push(asciiBytes(`${i + 1} 0 obj\n`));
    if (typeof objects[i] === "string") {
      chunks.push(asciiBytes(`${objects[i]}\nendobj\n`));
    } else {
      chunks.push(asciiBytes(`${objects[i].dict}\nstream\n`));
      chunks.push(objects[i].stream);
      chunks.push(asciiBytes("\nendstream\nendobj\n"));
    }
  }
  const xrefOffset = totalLength(chunks);
  chunks.push(asciiBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (let i = 1; i < offsets.length; i += 1) {
    chunks.push(asciiBytes(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`));
  }
  chunks.push(asciiBytes(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concatBytes(chunks);
}

function asciiBytes(text) {
  return new TextEncoder().encode(text);
}

function formatPdfNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function totalLength(chunks) {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0);
}

function concatBytes(chunks) {
  const output = new Uint8Array(totalLength(chunks));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function makePdfFileName() {
  const data = getFormData();
  const schoolName = templates[state.templateKey].name;
  const classDivision = [data.studentClass, data.division].filter(Boolean).join("-");
  const parts = [schoolName, data.studentName, classDivision].filter(Boolean);
  return parts.join("-").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "student-id-card";
}

async function submitPdfUpload() {
  if (state.submitting) return;
  try {
    const validationError = validateCardDetails();
    if (validationError) {
      showMessage(validationError);
      return;
    }

    setSubmitSending(true);
    showMessage("Generating PDF...", true);
    const data = getFormData();
    const pdfBase64 = await createPdfBase64();

    showMessage("Uploading...", true);
    const fileName = `${makePdfFileName()}.pdf`;
    const response = await fetch("/api/create-pdf-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: data.studentName,
        schoolName: templates[state.templateKey].name,
        classDivision: [data.studentClass, data.division].filter(Boolean).join(" "),
        fileName
      })
    });
    const responseText = await response.text();
    const result = parseJsonText(responseText);
    if (!response.ok) {
      const detail = result.detail ? ` ${String(result.detail).slice(0, 240)}` : "";
      throw new Error(`${result.error || responseText || "Upload setup failed."}${detail}`);
    }

    await uploadPdfToSignedUrl(result.signedUrl, pdfBase64, fileName);

    showMessage("Submitted successfully. PDF uploaded.", true);
  } catch (error) {
    showSubmitError(error);
  } finally {
    if (state.submitting) setSubmitSending(false);
  }
}

async function uploadPdfToSignedUrl(signedUrl, pdfBase64, fileName) {
  if (!signedUrl) {
    throw new Error("Upload URL is missing.");
  }

  const pdfBlob = base64ToBlob(pdfBase64, "application/pdf");
  let lastError = null;

  for (let attempt = 1; attempt <= UPLOAD_RETRY_COUNT; attempt += 1) {
    try {
      await uploadPdfAttempt(signedUrl, pdfBlob, fileName);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < UPLOAD_RETRY_COUNT) {
        await delay(700 * attempt);
      }
    }
  }

  throw lastError || new Error("PDF upload failed.");
}

async function uploadPdfAttempt(signedUrl, pdfBlob, fileName) {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", pdfBlob, fileName);

  let response;
  try {
    response = await fetch(signedUrl, {
      method: "PUT",
      body: formData
    });
  } catch (error) {
    throw new Error(`Direct Supabase upload failed after retries. Check Storage CORS/settings for this domain. ${error.message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Supabase upload failed (${response.status}).`);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function base64ToBlob(base64, contentType) {
  const bytes = base64ToBytes(base64);
  return new Blob([bytes], { type: contentType });
}

function parseJsonText(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function populateDobSelects() {
  appendNumberOptions(inputs.dobDay, 1, 31, makeTwoDigit);
  appendNumberOptions(inputs.dobMonth, 1, 12, makeTwoDigit);
  appendNumberOptions(inputs.dobYear, 2000, 2026, value => String(value));
}

function appendNumberOptions(select, start, end, formatLabel) {
  for (let value = start; value <= end; value += 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = formatLabel(value);
    select.appendChild(option);
  }
}

populateDobSelects();

for (const input of Object.values(inputs).filter(input => input !== inputs.templateKey && input !== inputs.schoolSearch)) {
  const updateFromInput = () => {
    if (input === inputs.studentName || input === inputs.guardianName) {
      input.value = cleanNameValue(input.value);
    }
    applyTemplate();
  };
  input.addEventListener("input", updateFromInput);
  input.addEventListener("change", updateFromInput);
}

schoolSearch.value = templates[state.templateKey].name;
schoolSearch.addEventListener("input", renderSchoolSearchResults);
schoolSearch.addEventListener("focus", renderSchoolSearchResults);
schoolSearch.addEventListener("keydown", event => {
  if (event.key === "Escape") closeSchoolResults();
});
schoolResults.addEventListener("click", event => {
  const button = event.target.closest("[data-template-key]");
  if (!button) return;
  selectSchool(button.dataset.templateKey);
});
document.addEventListener("click", event => {
  if (event.target === schoolSearch || schoolResults.contains(event.target)) return;
  closeSchoolResults();
});

photoInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file && file.size > MAX_PHOTO_BYTES) {
    showMessage(PHOTO_SIZE_ERROR);
    event.target.value = "";
    return;
  }
  if (file) openCropper(file);
});

document.getElementById("applyCropBtn").addEventListener("click", applyCrop);
document.getElementById("cancelCropBtn").addEventListener("click", () => cropDialog.close());
submitBtn.addEventListener("click", submitPdfUpload);
zoomRange.addEventListener("input", drawCrop);
window.addEventListener("resize", applyTemplate);

cropCanvas.addEventListener("pointerdown", event => {
  state.crop.dragging = true;
  state.crop.startX = event.clientX - state.crop.offsetX;
  state.crop.startY = event.clientY - state.crop.offsetY;
  cropCanvas.setPointerCapture(event.pointerId);
});

cropCanvas.addEventListener("pointermove", event => {
  if (!state.crop.dragging) return;
  state.crop.offsetX = event.clientX - state.crop.startX;
  state.crop.offsetY = event.clientY - state.crop.startY;
  drawCrop();
});

cropCanvas.addEventListener("pointerup", () => {
  state.crop.dragging = false;
});

applyTemplate();
