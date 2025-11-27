// Image caching utility
import { IMAGE_CACHE } from '../constants.js';

export async function loadImageWithCache(imgElement, url) {
  if (!url || url.startsWith('data:') || url.startsWith('/')) {
    imgElement.src = url || '/buy.png';
    return;
  }
  
  // Firebase Storage URLs should be used directly (they handle CORS properly)
  // Only use cache API for other external URLs
  if (url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app')) {
    imgElement.src = url;
    return;
  }
  
  try {
    // Try to get from cache first
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(url);
    if (cached) {
      const blob = await cached.blob();
      imgElement.src = URL.createObjectURL(blob);
      return;
    }
    
    // If not in cache, fetch and cache it
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response.clone());
      const blob = await response.blob();
      imgElement.src = URL.createObjectURL(blob);
    } else {
      // If fetch fails, try to use the URL directly
      imgElement.src = url;
    }
  } catch (e) {
    // Silently handle cache errors - just use the URL directly
    // Don't log to console as this is expected for some images
    try {
      imgElement.src = url;
    } catch (err) {
      // If even setting src fails, use fallback
      imgElement.src = '/buy.png';
    }
  }
}

