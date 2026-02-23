export function createInput() {
  const held = new Set();
  const pressed = new Set();

  window.addEventListener('keydown', (e) => {
    if (!held.has(e.code)) {
      pressed.add(e.code);
    }
    held.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
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
