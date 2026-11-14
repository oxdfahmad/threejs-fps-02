// Keyboard + mouse input, with pointer lock. The game reads plain state from
// here; this module never decides what a key does, it only reports it.
// Edge-triggered actions (reload, grenade, buy keys) are consumed by the caller
// through takePressed() so one press never fires twice.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = new Set();
  const look = { x: 0, y: 0 };
  let firing = false;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (!locked) return;
    look.x += event.movementX;
    look.y += event.movementY;
  }
  function onMouseDown(event) {
    if (!locked) return;
    if (event.button === 0) firing = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }
  function onLock() {
    locked = document.pointerLockElement === canvas;
    if (!locked) firing = false;
    onLockChange(locked);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLock);

  return {
    keys,
    get firing() {
      return firing;
    },
    get locked() {
      return locked;
    },
    requestLock() {
      canvas.requestPointerLock();
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    // Mouse movement since the last call, in raw pixels.
    takeLook() {
      const out = { x: look.x, y: look.y };
      look.x = 0;
      look.y = 0;
      return out;
    },
    // True once per physical press; the caller clears it by reading.
    takePressed(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    // Any of these codes pressed since the last frame.
    takeAnyPressed(codes) {
      for (const code of codes) {
        if (pressed.has(code)) {
          pressed.delete(code);
          return code;
        }
      }
      return null;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
