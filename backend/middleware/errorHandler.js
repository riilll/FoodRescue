// Menangani endpoint yang tidak terdaftar (404 dalam format JSON, bukan HTML)
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
}

// Menangani error global Express (misal body JSON tidak valid atau error tak terduga)
function errorHandler(err, req, res, next) {
  console.error("[Global Error]", err);

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Format JSON pada request body tidak valid.",
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Terjadi kesalahan internal pada server.",
  });
}

module.exports = { notFoundHandler, errorHandler };
