/** Default width used for fake client rects (the QA phone viewport). */
const RECT_WIDTH = 360;

/** A full DOMRect for mocking getBoundingClientRect in jsdom (which always returns zeros). */
export function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: RECT_WIDTH, width: RECT_WIDTH, height: bottom - top, x: 0, y: top, toJSON: () => ({}) };
}
