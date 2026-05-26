const multer = require("multer");
const path = require("path");

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 40 MB

// Storage configuration
//File upload size is restricted using Multer’s limits.fileSize (30MB), which enforces a hard content-length limit at middleware level.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const name = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${name}-${Date.now()}${ext}`;
    cb(null, uniqueSuffix);
  },
});

// File filter (only PDFs allowed)
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

module.exports = upload;
