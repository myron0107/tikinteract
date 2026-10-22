import {WIDTH} from './config.js';

// Keep the original 480-unit course and physics. Wide windows reveal more
// scenery rather than magnifying the portrait world until it no longer fits.
export function sceneViewport(width, height) {
    const unitsPerPixel = Math.max(WIDTH / Math.max(1, width), 640 / Math.max(1, height));
    const calculatedWidth = Math.max(1, width) * unitsPerPixel;
    const viewWidth = Math.abs(calculatedWidth - WIDTH) < 1e-6 ? WIDTH : calculatedWidth;
    return {viewWidth, height: Math.max(1, height) * unitsPerPixel,
        offsetX: (viewWidth - WIDTH) / 2, pixelsPerUnit: 1 / unitsPerPixel};
}
