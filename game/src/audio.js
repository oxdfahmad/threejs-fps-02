// Procedural WebAudio sounds: every effect is synthesised from oscillators
// and filtered noise, so the game ships no audio files and makes no network
// request. The context is created lazily on the first user gesture, because
// browsers block audio before one.
export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.32;
      master.connect(context.destination);
      const length = Math.floor(context.sampleRate * 0.5);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && context.state === 'suspended') context.resume();
  }

  // A short burst of white noise through a low-pass filter: the body of a shot.
  function noiseBurst(duration, filterFreq, gainValue, when = 0) {
    if (!ensure()) return;
    const t0 = context.currentTime + when;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(t0, Math.random() * 0.3);
    source.stop(t0 + duration + 0.02);
  }

  // A pitched tone with a fast decay: clicks, beeps and the tail of a shot.
  function tone(freqStart, freqEnd, duration, gainValue, type = 'square', when = 0) {
    if (!ensure()) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    unlock: resume,
    shot(kind) {
      // Rifle cracks loud and low; pistol snaps short; shotgun booms wide.
      if (kind === 'shotgun') {
        noiseBurst(0.22, 900, 0.9);
        tone(160, 45, 0.18, 0.5, 'sawtooth');
      } else if (kind === 'pistol') {
        noiseBurst(0.09, 2400, 0.6);
        tone(700, 180, 0.07, 0.35, 'square');
      } else {
        noiseBurst(0.13, 1600, 0.75);
        tone(320, 90, 0.11, 0.45, 'sawtooth');
      }
    },
    // A distant, muffled enemy shot: quieter, low-passed harder.
    distantShot() {
      noiseBurst(0.14, 700, 0.22);
    },
    dryFire() {
      tone(1400, 900, 0.03, 0.18, 'square');
    },
    reload() {
      tone(900, 500, 0.04, 0.2, 'square', 0);
      tone(600, 900, 0.04, 0.2, 'square', 0.18);
      tone(1100, 700, 0.05, 0.25, 'square', 0.42);
    },
    hit(kill) {
      tone(kill ? 1320 : 990, kill ? 990 : 990, 0.06, 0.3, 'sine');
      if (kill) tone(1980, 1980, 0.09, 0.25, 'sine', 0.07);
    },
    hurt() {
      tone(220, 110, 0.16, 0.4, 'sawtooth');
      noiseBurst(0.1, 500, 0.25);
    },
    step() {
      noiseBurst(0.05, 420, 0.08);
    },
    plantTick() {
      tone(1200, 1200, 0.05, 0.2, 'sine');
    },
    beep() {
      tone(880, 880, 0.08, 0.25, 'sine');
    },
    explosion() {
      noiseBurst(0.9, 320, 1.0);
      tone(90, 28, 0.8, 0.8, 'sine');
      noiseBurst(0.5, 1200, 0.4, 0.05);
    },
    roundWin() {
      tone(523, 523, 0.14, 0.3, 'triangle');
      tone(659, 659, 0.14, 0.3, 'triangle', 0.13);
      tone(784, 784, 0.28, 0.32, 'triangle', 0.26);
    },
    roundLose() {
      tone(392, 392, 0.16, 0.3, 'triangle');
      tone(330, 330, 0.16, 0.3, 'triangle', 0.15);
      tone(262, 262, 0.32, 0.32, 'triangle', 0.3);
    },
    buy() {
      tone(1046, 1046, 0.07, 0.25, 'sine');
      tone(1568, 1568, 0.1, 0.22, 'sine', 0.06);
    },
  };
}
