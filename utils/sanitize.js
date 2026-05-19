/**
 * Escapes characters that have special meaning in regular expressions.
 * Prevents ReDoS (Regular Expression Denial of Service) by ensuring
 * user-provided input is treated as a literal string.
 * 
 * @param {string} string - The string to escape
 * @returns {string} - The escaped string
 */
const escapeRegex = (string) => {
  if (!string || typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = { escapeRegex };
