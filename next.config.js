/** @type {import('next').NextConfig} */
module.exports = {
  // Lets a test build use its own folder (NEXT_DIST_DIR=.next-test) without touching a running dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
