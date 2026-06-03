// Wrap an async Express handler so rejected promises are forwarded to next()
// instead of becoming unhandled rejections (Express 4 does not do this itself).
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
