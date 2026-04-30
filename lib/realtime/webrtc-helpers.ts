/** iOS Safari (not Chrome/Firefox on iOS). */
export function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  const isEdge = /EdgiOS/.test(ua);
  return !isChrome && !isFirefox && !isEdge;
}

export function getBrowserMicConstraints(): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

export function createHighpassChain(
  stream: MediaStream,
  frequencyHz: number
): { outStream: MediaStream; dispose: () => void } | null {
  const AC =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC({ latencyHint: "interactive" });
    const source = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = frequencyHz;
    hp.Q.value = 0.707;
    const dest = ctx.createMediaStreamDestination();
    source.connect(hp);
    hp.connect(dest);
    return {
      outStream: dest.stream,
      dispose: () => {
        try {
          source.disconnect();
          hp.disconnect();
          dest.disconnect();
        } catch {
          /* ignore */
        }
        void ctx.close();
      },
    };
  } catch {
    return null;
  }
}
