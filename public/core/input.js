const PREVENT_DEFAULT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space'
]);

export function createInput() {
  const held = new Set();
  const pressed = new Set();

  window.addEventListener('keydown', (e) => {
    if (PREVENT_DEFAULT_KEYS.has(e.code)) {
      e.preventDefault();
    }

    if (!held.has(e.code)) {
      pressed.add(e.code);
    }
    held.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    if (PREVENT_DEFAULT_KEYS.has(e.code)) {
      e.preventDefault();
    }
    held.delete(e.code);
  });

  return {
    held,
    pressed,
    down(code) {
      return held.has(code);
    },
    tap(code) {
      return pressed.has(code);
    },
    endFrame() {
      pressed.clear();
    }
  };
}
