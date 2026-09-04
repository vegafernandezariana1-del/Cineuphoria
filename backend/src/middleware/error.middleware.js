function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(error.statusCode || 500).json({
    error: error.publicMessage || "Internal server error"
  });
}

module.exports = { notFound, errorHandler };
