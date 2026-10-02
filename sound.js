// Score for the page: a steady processional drum on every beat, with an occasional bell
// landing on the beat, ringing in a long stone hall. Samples load on first use.
(() => {
  const BEAT = 60 / 20;                       // one stroke every three seconds
  const D = 9 / 8, F = 4 / 3;                 // playback rates for D and F from the C bell
  // An eight-bar cycle of four beats each. Bells only ever fall on a beat: [beat, sample, rate].
  const BELLS = {
    0: [[0, 'bell_c', 1]],
    1: [[0, 'bell_g', 1]],
    2: [[0, 'bell_c', D], [2, 'bell_c', 1]],
    4: [[0, 'bell_c', 1]],
    5: [[0, 'bell_c', F]],
    6: [[0, 'bell_c', D], [2, 'bell_g', 1]],
  };

  function loadSamples(src) {
    if (window.PARADE_SAMPLES) return Promise.resolve(window.PARADE_SAMPLES);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(window.PARADE_SAMPLES); s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function hall(ac, seconds, decay) {
    const len = Math.round(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  async function score(ac, dest, src = 'audio/samples.js') {
    const urls = await loadSamples(src);
    const buf = {};
    await Promise.all(Object.entries(urls).map(async ([k, url]) => {
      buf[k] = await ac.decodeAudioData(await (await fetch(url)).arrayBuffer());
    }));

    // Hall: a short pre-delay, then a long dark tail.
    const wet = ac.createGain(), pre = ac.createDelay(), rev = ac.createConvolver(), tone = ac.createBiquadFilter();
    pre.delayTime.value = .035; rev.buffer = hall(ac, 5.5, 3);
    tone.type = 'lowpass'; tone.frequency.value = 4200;
    wet.connect(pre).connect(rev).connect(tone).connect(dest);

    function play(name, t, gain, { rate = 1, dry = .8, send = .5 } = {}) {
      const s = ac.createBufferSource(), g = ac.createGain(), d = ac.createGain(), w = ac.createGain();
      s.buffer = buf[name]; s.playbackRate.value = rate; g.gain.value = gain;
      d.gain.value = dry; w.gain.value = send;
      s.connect(g); g.connect(d).connect(dest); g.connect(w).connect(wet);
      s.start(t);
    }

    let next = ac.currentTime + .25, beat = 0;
    return {
      // Queue every beat that starts before `until` (seconds on the context clock).
      schedule(until) {
        if (next < ac.currentTime) {               // after a pause, keep the grid but skip ahead
          const missed = Math.ceil((ac.currentTime - next) / BEAT);
          next += missed * BEAT; beat += missed;
        }
        while (next < until) {
          const bar = Math.floor(beat / 4), b = beat % 4;
          if (b === 0) play('drum_accent', next, .9, { send: .55 });
          else play('drum', next, .5, { send: .5 });
          if (b === 0) for (const [at, name, rate] of BELLS[bar % 8] || []) {
            play(name, next + at * BEAT, .32, { rate, dry: .55, send: .85 });
          }
          next += BEAT; beat++;
        }
      },
      // A soft gong on the next beat to mark a change of scene.
      cue() { play('gong', next, .32, { dry: .4, send: .9 }); },
    };
  }

  window.ParadeSound = { score };
})();
