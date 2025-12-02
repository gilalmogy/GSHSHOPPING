/**
 * Safe DOM manipulation utilities to prevent XSS attacks
 * Use these instead of innerHTML when dealing with user-generated content
 */

/**
 * Create a text node safely (prevents XSS)
 * @param {string} text - Text content
 * @returns {Text}
 */
export function createTextNode(text) {
  return document.createTextNode(String(text || ''));
}

/**
 * Set text content safely (prevents XSS)
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text content
 */
export function setTextContent(element, text) {
  if (element) {
    element.textContent = String(text || '');
  }
}

/**
 * Create an element with attributes safely
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {string|HTMLElement|Text} content - Text content or child elements
 * @returns {HTMLElement}
 */
export function createElement(tag, attributes = {}, content = null) {
  const element = document.createElement(tag);
  
  // Set attributes
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (key === 'className' || key === 'class') {
      element.className = String(value || '');
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'style' && typeof value === 'string') {
      element.style.cssText = value;
    } else if (key.startsWith('on')) {
      // Event handlers - skip for security
      console.warn('Event handlers should be added via addEventListener, not attributes');
    } else if (value !== null && value !== undefined) {
      element.setAttribute(key, String(value));
    }
  });
  
  // Set content
  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof Node) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(child => {
        if (child instanceof Node) {
          element.appendChild(child);
        }
      });
    }
  }
  
  return element;
}

/**
 * Create a safe HTML fragment from template string (only for trusted content)
 * For user-generated content, use createElement instead
 * @param {string} html - HTML string (must be trusted)
 * @returns {DocumentFragment}
 */
export function createFragment(html) {
  const template = document.createElement('template');
  template.innerHTML = html; // Only use with trusted HTML
  return template.content.cloneNode(true);
}

/**
 * Safely set innerHTML (only use with trusted content)
 * For user content, always use textContent or createElement
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML string (must be trusted)
 */
export function setInnerHTML(element, html) {
  if (element) {
    element.innerHTML = String(html || '');
  }
}

