export const DEMO_IMAGE_FALLBACK = '/images/demo-mark-light.png';

export function handleImageFallback(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = DEMO_IMAGE_FALLBACK;
}
